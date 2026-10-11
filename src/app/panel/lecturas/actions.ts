"use server";

import { revalidatePath } from "next/cache";
import { and, count, desc, eq, gt, isNull, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { lecturas, socios, boletas, invitaciones } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/auth-schema";
import { LIMITE_TECNICOS, NOMBRE_PLAN, type Plan } from "@/lib/planes";
import { requireApr, requireAdmin } from "@/lib/apr-session";
import { crearInvitacion } from "@/lib/invitaciones";
import {
  calcularDesdeLecturas,
  estadoQueCorresponde,
  normalizarPeriodo,
  type EstadoBoleta,
} from "@/lib/boletas";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

/**
 * `codigo` le dice a la pantalla POR QUÉ no se pudo aprobar, para ofrecer la
 * salida correcta (usarla como lectura inicial) en vez de solo un error.
 */
export type ResultadoAprobacion =
  | { ok: true }
  | { ok: false; error: string; codigo?: "PRIMERA_LECTURA" | "LECTURA_MENOR" };

const lecturaSchema = z.object({
  socioId: z.string().trim().min(1, "Elige un socio."),
  periodo: z.string().trim().min(1, "El período es obligatorio."),
  valor: z.number().int().min(0, "La lectura no puede ser negativa."),
  observacion: z.string().trim().max(300).optional(),
});

function aEntero(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").replace(/[^\d]/g, "");
  return texto === "" ? null : Number(texto);
}

/**
 * Cualquiera de los dos roles puede registrar una lectura: el operador la
 * toma en terreno, pero nada impide que el propio administrador la cargue
 * si él mismo hizo la ronda. Las dos vías quedan igual en PENDIENTE.
 */
export async function registrarLectura(
  _prev: ResultadoAccion | null,
  formData: FormData
): Promise<ResultadoAccion> {
  const { user, apr } = await requireApr();

  const parsed = lecturaSchema.safeParse({
    socioId: formData.get("socioId"),
    periodo: formData.get("periodo"),
    valor: aEntero(formData.get("valor")),
    observacion: formData.get("observacion") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const datos = parsed.data;

  const periodo = normalizarPeriodo(datos.periodo);
  if (!periodo) {
    return {
      ok: false,
      error: "El período debe ser un mes válido, por ejemplo 2026-07.",
    };
  }

  const socio = await db.query.socios.findFirst({
    where: and(eq(socios.id, datos.socioId), eq(socios.aprId, apr.id)),
    columns: { id: true },
  });
  if (!socio) {
    return { ok: false, error: "Ese socio no pertenece a tu comité." };
  }

  const pendienteExistente = await db.query.lecturas.findFirst({
    where: and(
      eq(lecturas.socioId, datos.socioId),
      eq(lecturas.periodo, periodo),
      eq(lecturas.estado, "PENDIENTE")
    ),
    columns: { id: true },
  });
  if (pendienteExistente) {
    return {
      ok: false,
      error:
        "Ya hay una lectura pendiente de este socio para ese período. Espera a que se revise antes de cargar otra.",
    };
  }

  await db.insert(lecturas).values({
    socioId: datos.socioId,
    periodo,
    valor: datos.valor,
    observacion: datos.observacion ?? null,
    registradaPorId: user.id,
  });

  revalidatePath("/panel/lecturas");
  return { ok: true };
}

/**
 * Aprobar vuelca la lectura a la Boleta del período: si no existe, la crea;
 * si existe, la recalcula con la lectura actual como nueva lectura actual y
 * la anterior aprobada de este socio.
 *
 * Si el arranque NO tiene lectura anterior, el consumo saldría como el medidor
 * completo (un medidor en 1.250 cobraría 1.250 m³). Por eso se niega, salvo que
 * se pida expresamente `cobrarDesdeCero` (un medidor realmente nuevo, en 0).
 * Lo normal para la primera lectura es `aprobarComoLecturaInicial`.
 */
type Sesion = Awaited<ReturnType<typeof requireAdmin>>;

async function aprobarNucleo(
  { user, apr }: Sesion,
  lecturaId: string,
  opciones: { cobrarDesdeCero?: boolean }
): Promise<ResultadoAprobacion> {

  const lectura = await db
    .select({
      id: lecturas.id,
      socioId: lecturas.socioId,
      periodo: lecturas.periodo,
      valor: lecturas.valor,
      estado: lecturas.estado,
    })
    .from(lecturas)
    .innerJoin(socios, eq(lecturas.socioId, socios.id))
    .where(and(eq(lecturas.id, lecturaId), eq(socios.aprId, apr.id)))
    .limit(1);

  if (lectura.length === 0) {
    return { ok: false, error: "No encontramos esa lectura." };
  }
  if (lectura[0].estado !== "PENDIENTE") {
    return { ok: false, error: "Esa lectura ya fue revisada." };
  }

  const actual = lectura[0];

  // La lectura anterior aprobada más reciente de este socio, para calcular
  // el consumo. Si no hay ninguna, se asume que parte de 0.
  const anterior = await db
    .select({ valor: lecturas.valor })
    .from(lecturas)
    .where(
      and(
        eq(lecturas.socioId, actual.socioId),
        eq(lecturas.estado, "APROBADA")
      )
    )
    .orderBy(desc(lecturas.createdAt))
    .limit(1);

  if (anterior.length === 0 && !opciones.cobrarDesdeCero) {
    return {
      ok: false,
      codigo: "PRIMERA_LECTURA",
      error:
        "Es la primera lectura de este arranque: no hay una anterior para calcular el consumo. Úsala como lectura inicial, o confirma que quieres cobrar desde 0.",
    };
  }

  const lecturaAnterior = anterior[0]?.valor ?? 0;

  const calculo = calcularDesdeLecturas(lecturaAnterior, actual.valor, {
    cargoFijo: apr.tarifaCargoFijo,
    valorM3: apr.tarifaMetroCubico,
  });

  if (calculo && "error" in calculo) {
    return {
      ok: false,
      error: calculo.error,
      codigo: actual.valor < lecturaAnterior ? "LECTURA_MENOR" : undefined,
    };
  }
  if (!calculo) {
    return {
      ok: false,
      error: "No se pudo calcular el consumo con esa lectura.",
    };
  }

  const fechaEmision = new Date();
  const fechaVencimiento = new Date(
    fechaEmision.getTime() + apr.diasVencimiento * 86_400_000
  );

  const boletaExistente = await db.query.boletas.findFirst({
    where: and(eq(boletas.socioId, actual.socioId), eq(boletas.periodo, actual.periodo)),
    columns: { id: true, montoPagado: true, estado: true },
  });

  if (boletaExistente) {
    await db
      .update(boletas)
      .set({
        lecturaAnterior,
        lecturaActual: actual.valor,
        consumoM3: calculo.consumoM3,
        cargoFijo: calculo.cargoFijo,
        valorM3: calculo.valorM3,
        montoTotal: calculo.montoTotal,
        estado: estadoQueCorresponde(
          calculo.montoTotal,
          boletaExistente.montoPagado,
          fechaVencimiento,
          boletaExistente.estado as EstadoBoleta
        ),
        updatedAt: new Date(),
      })
      .where(eq(boletas.id, boletaExistente.id));
  } else {
    await db.insert(boletas).values({
      socioId: actual.socioId,
      periodo: actual.periodo,
      montoTotal: calculo.montoTotal,
      montoPagado: 0,
      estado: estadoQueCorresponde(calculo.montoTotal, 0, fechaVencimiento, "PENDIENTE"),
      fechaEmision,
      fechaVencimiento,
      lecturaAnterior,
      lecturaActual: actual.valor,
      consumoM3: calculo.consumoM3,
      cargoFijo: calculo.cargoFijo,
      valorM3: calculo.valorM3,
    });
  }

  await db
    .update(lecturas)
    .set({ estado: "APROBADA", revisadaPorId: user.id, updatedAt: new Date() })
    .where(eq(lecturas.id, lecturaId));

  return { ok: true };
}

function refrescarPantallas() {
  revalidatePath("/panel/lecturas");
  revalidatePath("/panel/boletas");
  revalidatePath("/panel");
}

export async function aprobarLectura(
  lecturaId: string,
  opciones: { cobrarDesdeCero?: boolean } = {}
): Promise<ResultadoAprobacion> {
  const sesion = await requireAdmin();
  const r = await aprobarNucleo(sesion, lecturaId, opciones);
  if (r.ok) refrescarPantallas();
  return r;
}

export type ResultadoAprobacionMasiva =
  | { ok: true; aprobadas: number; fallidas: { id: string; error: string }[] }
  | { ok: false; error: string };

/**
 * Aprueba varias lecturas de una vez y genera sus boletas. Cada una pasa por las
 * mismas reglas que al aprobar de a una: una primera lectura (sin anterior) o una
 * menor que la anterior NO se aprueba aquí, queda como fallida con su motivo.
 */
export async function aprobarLecturasListas(
  ids: string[]
): Promise<ResultadoAprobacionMasiva> {
  const sesion = await requireAdmin();

  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "No hay lecturas para aprobar." };
  }
  if (ids.length > 2000) {
    return { ok: false, error: "Máximo 2.000 lecturas por vez." };
  }

  let aprobadas = 0;
  const fallidas: { id: string; error: string }[] = [];
  for (const id of ids) {
    const r = await aprobarNucleo(sesion, String(id), {});
    if (r.ok) aprobadas++;
    else fallidas.push({ id: String(id), error: r.error });
  }

  refrescarPantallas();
  return { ok: true, aprobadas, fallidas };
}

/**
 * Aprueba una lectura como PUNTO DE PARTIDA: queda registrada y será la
 * "anterior" de la próxima, pero no genera boleta ni cobra consumo. Sirve para
 * la primera lectura de un arranque y para un medidor que se cambió por otro.
 */
export async function aprobarComoLecturaInicial(
  lecturaId: string
): Promise<ResultadoAccion> {
  const { user, apr } = await requireAdmin();

  const lectura = await db
    .select({ id: lecturas.id, estado: lecturas.estado })
    .from(lecturas)
    .innerJoin(socios, eq(lecturas.socioId, socios.id))
    .where(and(eq(lecturas.id, lecturaId), eq(socios.aprId, apr.id)))
    .limit(1);

  if (lectura.length === 0) {
    return { ok: false, error: "No encontramos esa lectura." };
  }
  if (lectura[0].estado !== "PENDIENTE") {
    return { ok: false, error: "Esa lectura ya fue revisada." };
  }

  await db
    .update(lecturas)
    .set({ estado: "APROBADA", revisadaPorId: user.id, updatedAt: new Date() })
    .where(eq(lecturas.id, lecturaId));

  revalidatePath("/panel/lecturas");
  return { ok: true };
}

/** La lectura con el id dado, solo si es de un arranque del comité. */
async function lecturaDelComite(lecturaId: string, aprId: string) {
  const r = await db
    .select({
      id: lecturas.id,
      socioId: lecturas.socioId,
      periodo: lecturas.periodo,
      valor: lecturas.valor,
      estado: lecturas.estado,
      createdAt: lecturas.createdAt,
    })
    .from(lecturas)
    .innerJoin(socios, eq(lecturas.socioId, socios.id))
    .where(and(eq(lecturas.id, lecturaId), eq(socios.aprId, aprId)))
    .limit(1);
  return r[0] ?? null;
}

type LecturaCargada = NonNullable<Awaited<ReturnType<typeof lecturaDelComite>>>;

/**
 * Una lectura aprobada es la base del consumo de la siguiente. Por eso solo se
 * puede tocar la ULTIMA aprobada de un arranque: si hay una posterior, ya se
 * calculó contra esta y cambiarla dejaría sus números incoherentes.
 */
async function esUltimaAprobada(l: LecturaCargada) {
  const posterior = await db.query.lecturas.findFirst({
    where: and(
      eq(lecturas.socioId, l.socioId),
      eq(lecturas.estado, "APROBADA"),
      gt(lecturas.createdAt, l.createdAt),
      ne(lecturas.id, l.id)
    ),
    columns: { id: true },
  });
  return !posterior;
}

const MENSAJE_HAY_POSTERIORES =
  "Este arranque ya tiene lecturas más nuevas que parten de esta. Modifica primero la más reciente.";

/** La boleta del período, si salió de ESTA lectura (sus números coinciden); una boleta hecha a mano no. */
async function boletaDeLectura(l: LecturaCargada) {
  const boleta = await db.query.boletas.findFirst({
    where: and(eq(boletas.socioId, l.socioId), eq(boletas.periodo, l.periodo)),
  });
  return boleta && boleta.lecturaActual === l.valor ? boleta : null;
}

export type ResultadoEdicion =
  | { ok: true; boletaActualizada: boolean }
  | { ok: false; error: string };

/**
 * Corrige el valor (o la observación) de una lectura. Pendiente: se cambia y
 * listo. Aprobada: solo la última del arranque, y se recalcula la boleta que
 * generó, conservando lo ya pagado.
 */
export async function editarLectura(
  lecturaId: string,
  valorCrudo: number,
  observacion: string
): Promise<ResultadoEdicion> {
  const { apr } = await requireAdmin();

  const valor = Number(valorCrudo);
  if (!Number.isInteger(valor) || valor < 0) {
    return { ok: false, error: "La lectura debe ser un número entero, 0 o más." };
  }
  const nota = String(observacion ?? "").trim().slice(0, 300) || null;

  const l = await lecturaDelComite(lecturaId, apr.id);
  if (!l) return { ok: false, error: "No encontramos esa lectura." };

  if (l.estado === "RECHAZADA") {
    return {
      ok: false,
      error: "Una lectura rechazada no se edita: elimínala y carga la correcta.",
    };
  }

  if (l.estado === "PENDIENTE") {
    await db
      .update(lecturas)
      .set({ valor, observacion: nota, updatedAt: new Date() })
      .where(eq(lecturas.id, l.id));
    refrescarPantallas();
    return { ok: true, boletaActualizada: false };
  }

  if (!(await esUltimaAprobada(l))) {
    return { ok: false, error: MENSAJE_HAY_POSTERIORES };
  }

  // La anterior de esta: la aprobada inmediatamente antes.
  const previa = await db
    .select({ valor: lecturas.valor })
    .from(lecturas)
    .where(
      and(
        eq(lecturas.socioId, l.socioId),
        eq(lecturas.estado, "APROBADA"),
        ne(lecturas.id, l.id),
        lt(lecturas.createdAt, l.createdAt)
      )
    )
    .orderBy(desc(lecturas.createdAt))
    .limit(1);
  const anterior = previa[0]?.valor ?? null;

  if (anterior !== null && valor < anterior) {
    return {
      ok: false,
      error: `La lectura no puede ser menor que la anterior (${anterior}).`,
    };
  }

  const boleta = await boletaDeLectura(l);
  let calculo: ReturnType<typeof calcularDesdeLecturas> = null;
  if (boleta) {
    calculo = calcularDesdeLecturas(anterior ?? 0, valor, {
      cargoFijo: apr.tarifaCargoFijo,
      valorM3: apr.tarifaMetroCubico,
    });
    if (calculo && "error" in calculo) return { ok: false, error: calculo.error };
    if (!calculo) {
      return { ok: false, error: "No se pudo recalcular la boleta con esa lectura." };
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(lecturas)
      .set({ valor, observacion: nota, updatedAt: new Date() })
      .where(eq(lecturas.id, l.id));

    if (boleta && calculo && !("error" in calculo)) {
      await tx
        .update(boletas)
        .set({
          lecturaAnterior: anterior ?? 0,
          lecturaActual: valor,
          consumoM3: calculo.consumoM3,
          cargoFijo: calculo.cargoFijo,
          valorM3: calculo.valorM3,
          montoTotal: calculo.montoTotal,
          estado: estadoQueCorresponde(
            calculo.montoTotal,
            boleta.montoPagado,
            boleta.fechaVencimiento,
            boleta.estado as EstadoBoleta
          ),
          updatedAt: new Date(),
        })
        .where(eq(boletas.id, boleta.id));
    }
  });

  refrescarPantallas();
  return { ok: true, boletaActualizada: Boolean(boleta) };
}

export type ResultadoEliminacion =
  | { ok: true }
  | { ok: false; error: string; codigo?: "TIENE_BOLETA" };

/**
 * Elimina una lectura. Pendiente o rechazada: se borra. Aprobada: solo la última
 * del arranque; si generó una boleta, hay que confirmar que se elimina también,
 * y no se permite si ya tiene pagos registrados.
 */
export async function eliminarLectura(
  lecturaId: string,
  opciones: { tambienBoleta?: boolean } = {}
): Promise<ResultadoEliminacion> {
  const { apr } = await requireAdmin();

  const l = await lecturaDelComite(lecturaId, apr.id);
  if (!l) return { ok: false, error: "No encontramos esa lectura." };

  if (l.estado !== "APROBADA") {
    await db.delete(lecturas).where(eq(lecturas.id, l.id));
    refrescarPantallas();
    return { ok: true };
  }

  if (!(await esUltimaAprobada(l))) {
    return { ok: false, error: MENSAJE_HAY_POSTERIORES };
  }

  const boleta = await boletaDeLectura(l);

  if (boleta) {
    if (!opciones.tambienBoleta) {
      return {
        ok: false,
        codigo: "TIENE_BOLETA",
        error: `Esta lectura generó la boleta de ${l.periodo}. Para eliminarla hay que eliminar también esa boleta.`,
      };
    }
    if (boleta.montoPagado > 0) {
      return {
        ok: false,
        error:
          "La boleta ya tiene pagos registrados. Anúlala o elimínala primero desde Boletas.",
      };
    }
    await db.transaction(async (tx) => {
      await tx.delete(boletas).where(eq(boletas.id, boleta.id));
      await tx.delete(lecturas).where(eq(lecturas.id, l.id));
    });
  } else {
    await db.delete(lecturas).where(eq(lecturas.id, l.id));
  }

  refrescarPantallas();
  return { ok: true };
}

export async function rechazarLectura(
  lecturaId: string,
  motivo: string
): Promise<ResultadoAccion> {
  const { user, apr } = await requireAdmin();

  const motivoLimpio = motivo.trim();
  if (!motivoLimpio) {
    return { ok: false, error: "Indica por qué se rechaza, para que el operador sepa qué corregir." };
  }

  const lectura = await db
    .select({ id: lecturas.id, estado: lecturas.estado })
    .from(lecturas)
    .innerJoin(socios, eq(lecturas.socioId, socios.id))
    .where(and(eq(lecturas.id, lecturaId), eq(socios.aprId, apr.id)))
    .limit(1);

  if (lectura.length === 0) {
    return { ok: false, error: "No encontramos esa lectura." };
  }
  if (lectura[0].estado !== "PENDIENTE") {
    return { ok: false, error: "Esa lectura ya fue revisada." };
  }

  await db
    .update(lecturas)
    .set({
      estado: "RECHAZADA",
      revisadaPorId: user.id,
      motivoRechazo: motivoLimpio,
      updatedAt: new Date(),
    })
    .where(eq(lecturas.id, lecturaId));

  revalidatePath("/panel/lecturas");
  return { ok: true };
}

export type ResultadoInvitacion =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function generarInvitacionOperador(): Promise<ResultadoInvitacion> {
  const { apr } = await requireAdmin();

  // Técnicos con acceso + invitaciones sin usar: el tope del plan los cuenta a todos.
  const limite = LIMITE_TECNICOS[apr.plan as Plan];
  if (Number.isFinite(limite)) {
    const [{ n: tecnicos }] = await db
      .select({ n: count() })
      .from(userTable)
      .where(and(eq(userTable.aprId, apr.id), eq(userTable.rol, "OPERADOR")));
    const [{ n: pendientes }] = await db
      .select({ n: count() })
      .from(invitaciones)
      .where(
        and(
          eq(invitaciones.aprId, apr.id),
          isNull(invitaciones.usadaPor),
          gt(invitaciones.expiraEn, new Date())
        )
      );
    if (tecnicos + pendientes >= limite) {
      return {
        ok: false,
        error: `Tu plan ${NOMBRE_PLAN[apr.plan as Plan]} permite ${limite} ${limite === 1 ? "técnico" : "técnicos"}. Pasa a un plan mayor para invitar a más.`,
      };
    }
  }

  const invitacion = await crearInvitacion(apr.id);

  const dominio = process.env.NEXT_PUBLIC_DOMINIO_RAIZ ?? "facilapr.cl";
  return { ok: true, url: `https://${dominio}/invitacion/${invitacion.codigo}` };
}
