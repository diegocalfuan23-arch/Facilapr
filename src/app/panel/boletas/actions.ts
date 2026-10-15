"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { boletas, pagos, repactaciones, socios } from "@/lib/db/schema";
import { urlComprobante } from "@/lib/comprobante-enlace";
import { requireAdmin } from "@/lib/apr-session";
import { leerTabla } from "@/lib/tabla";
import {
  aMonto,
  calcularDesdeLecturas,
  tarifasPara,
  estadoQueCorresponde,
  normalizarPeriodo,
  type EstadoBoleta,
} from "@/lib/boletas";
import { normalizarRut, normalizarTelefono } from "@/lib/formato";
import { usoDeSocio } from "@/lib/tarifas";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

export type ResultadoImportacion =
  | {
      ok: true;
      creadas: number;
      actualizadas: number;
      omitidas: { linea: number; motivo: string }[];
    }
  | { ok: false; error: string };

const boletaSchema = z.object({
  socioId: z.string().trim().min(1, "Elige un socio."),
  periodo: z.string().trim().min(1, "El período es obligatorio."),
  fechaEmision: z.date(),
  fechaVencimiento: z.date(),
  lecturaAnterior: z.number().int().min(0).nullable(),
  lecturaActual: z.number().int().min(0).nullable(),
  montoTotal: z.number().int().min(0).nullable(),
  observacion: z.string().trim().max(300).optional(),
});

function aEntero(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").replace(/[^\d]/g, "");
  return texto === "" ? null : Number(texto);
}

function aFecha(valor: FormDataEntryValue | null): Date | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;

  // En Chile se escribe día/mes/año: new Date("06/11/2026") lo leería como
  // 11 de junio. Se arma a mediodía UTC para que la zona horaria no corra el día.
  const dma = texto.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dma || iso) {
    const [anio, mes, dia] = dma
      ? [dma[3], dma[2], dma[1]]
      : [iso![1], iso![2], iso![3]];
    const f = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia), 12));
    return Number.isNaN(f.getTime()) ? null : f;
  }

  const f = new Date(texto);
  return Number.isNaN(f.getTime()) ? null : f;
}

/**
 * Drizzle envuelve el error de Postgres y su mensaje solo trae la consulta,
 * no la constraint: hay que mirar la causa original. Sin esto, un período
 * repetido le mostraría al comité la pantalla de error en vez de un aviso.
 */
function esDuplicadoDePeriodo(e: unknown): boolean {
  for (let actual: unknown = e, i = 0; actual && i < 5; i++) {
    const err = actual as { code?: string; constraint?: string; cause?: unknown };
    if (err.code === "23505" && err.constraint === "Boleta_socio_periodo_key") {
      return true;
    }
    actual = err.cause;
  }
  return false;
}

/**
 * Confirma que el socio pertenece al comité en sesión. Sin esto, alguien
 * podría crear una boleta a nombre de un socio de otro comité mandando su id.
 */
async function socioDelApr(socioId: string, aprId: string) {
  return db.query.socios.findFirst({
    where: and(eq(socios.id, socioId), eq(socios.aprId, aprId)),
    columns: { id: true },
  });
}

export async function guardarBoleta(
  _prev: ResultadoAccion | null,
  formData: FormData
): Promise<ResultadoAccion> {
  const { apr } = await requireAdmin();
  const boletaId = String(formData.get("boletaId") ?? "").trim();

  const parsed = boletaSchema.safeParse({
    socioId: formData.get("socioId"),
    periodo: formData.get("periodo"),
    fechaEmision: aFecha(formData.get("fechaEmision")) ?? new Date(),
    fechaVencimiento: aFecha(formData.get("fechaVencimiento")) ?? new Date(),
    lecturaAnterior: aEntero(formData.get("lecturaAnterior")),
    lecturaActual: aEntero(formData.get("lecturaActual")),
    montoTotal: aEntero(formData.get("montoTotal")),
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

  if (!(await socioDelApr(datos.socioId, apr.id))) {
    return { ok: false, error: "Ese socio no pertenece a tu comité." };
  }

  if (datos.fechaVencimiento < datos.fechaEmision) {
    return {
      ok: false,
      error: "El vencimiento no puede ser anterior a la emisión.",
    };
  }

  // Las lecturas van las dos o ninguna: con una sola no hay consumo que calcular.
  const conLecturas =
    datos.lecturaAnterior !== null && datos.lecturaActual !== null;
  if ((datos.lecturaAnterior === null) !== (datos.lecturaActual === null)) {
    return {
      ok: false,
      error: "Escribe las dos lecturas del medidor (anterior y actual), o ninguna.",
    };
  }

  // Un medidor no retrocede: casi siempre es un error de tipeo o un cambio de medidor.
  if (conLecturas && datos.lecturaActual! < datos.lecturaAnterior!) {
    return {
      ok: false,
      error:
        "La lectura actual es menor que la anterior. Revisa los valores o registra el cambio de medidor.",
    };
  }

  // El consumo (m3) se guarda siempre que haya dos lecturas. Si además hay
  // tarifas, el monto se calcula con ellas; si no, se usa el que escribieron.
  const consumoDirecto = conLecturas
    ? datos.lecturaActual! - datos.lecturaAnterior!
    : null;
  const tarifasSocio = tarifasPara(apr, await usoDeSocio(datos.socioId));
  const hayTarifas = tarifasSocio.cargoFijo !== null && tarifasSocio.valorM3 !== null;
  const calculo =
    conLecturas && hayTarifas
      ? calcularDesdeLecturas(datos.lecturaAnterior, datos.lecturaActual, tarifasSocio)
      : null;

  if (calculo && "error" in calculo) {
    return { ok: false, error: calculo.error };
  }

  const montoTotal = calculo ? calculo.montoTotal : datos.montoTotal;

  if (montoTotal === null) {
    return {
      ok: false,
      error:
        "Ingresa el monto de la boleta, o las dos lecturas del medidor para calcularlo.",
    };
  }

  const valores = {
    socioId: datos.socioId,
    periodo,
    montoTotal,
    fechaEmision: datos.fechaEmision,
    fechaVencimiento: datos.fechaVencimiento,
    lecturaAnterior: datos.lecturaAnterior,
    lecturaActual: datos.lecturaActual,
    consumoM3: calculo ? calculo.consumoM3 : consumoDirecto,
    cargoFijo: calculo ? calculo.cargoFijo : null,
    valorM3: calculo ? calculo.valorM3 : null,
    observacion: datos.observacion ?? null,
    updatedAt: new Date(),
  };

  try {
    if (boletaId) {
      // La boleta debe ser de un socio de este comité.
      const actual = await db
        .select({ id: boletas.id, montoPagado: boletas.montoPagado, estado: boletas.estado })
        .from(boletas)
        .innerJoin(socios, eq(boletas.socioId, socios.id))
        .where(and(eq(boletas.id, boletaId), eq(socios.aprId, apr.id)))
        .limit(1);

      if (actual.length === 0) {
        return { ok: false, error: "No encontramos esa boleta." };
      }

      await db
        .update(boletas)
        .set({
          ...valores,
          estado: estadoQueCorresponde(
            montoTotal,
            actual[0].montoPagado,
            datos.fechaVencimiento,
            actual[0].estado as EstadoBoleta
          ),
        })
        .where(eq(boletas.id, boletaId));
    } else {
      await db.insert(boletas).values({
        ...valores,
        montoPagado: 0,
        estado: estadoQueCorresponde(montoTotal, 0, datos.fechaVencimiento, "PENDIENTE"),
      });
    }
  } catch (e) {
    if (esDuplicadoDePeriodo(e)) {
      return {
        ok: false,
        error: "Ese socio ya tiene una boleta de ese período.",
      };
    }
    throw e;
  }

  revalidatePath("/panel/boletas");
  revalidatePath("/panel");
  return { ok: true };
}

/** Pago dentro del comité del usuario; null si no existe o es de otro comité. */
async function pagoDelComite(aprId: string, pagoId: string) {
  const [fila] = await db
    .select({ id: pagos.id, boletaId: pagos.boletaId, repactacionId: pagos.repactacionId })
    .from(pagos)
    .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
    // El socio del pago: el que trae él mismo o, en los antiguos, el de su boleta.
    .innerJoin(socios, eq(socios.id, sql`coalesce(${pagos.socioId}, ${boletas.socioId})`))
    .where(and(eq(pagos.id, pagoId), eq(socios.aprId, aprId)))
    .limit(1);
  return fila ?? null;
}

/** Deja Boleta.montoPagado y el estado de acuerdo con la suma de sus pagos. */
async function recalcularBoleta(boletaId: string) {
  const [suma] = await db
    .select({ total: sql<number>`coalesce(sum(${pagos.monto}), 0)::int` })
    .from(pagos)
    .where(eq(pagos.boletaId, boletaId));
  const [boleta] = await db
    .select({
      montoTotal: boletas.montoTotal,
      fechaVencimiento: boletas.fechaVencimiento,
      estado: boletas.estado,
    })
    .from(boletas)
    .where(eq(boletas.id, boletaId))
    .limit(1);
  if (!boleta) return null;

  const pagado = suma?.total ?? 0;
  await db
    .update(boletas)
    .set({
      montoPagado: pagado,
      estado: estadoQueCorresponde(
        boleta.montoTotal,
        pagado,
        boleta.fechaVencimiento,
        boleta.estado as EstadoBoleta
      ),
      updatedAt: new Date(),
    })
    .where(eq(boletas.id, boletaId));
  return { pagado, montoTotal: boleta.montoTotal };
}

const pagoSchema = z.object({
  monto: z.number().int().min(1, "El monto debe ser mayor a cero."),
  fecha: z.date(),
  medio: z.enum(["EFECTIVO", "TRANSFERENCIA", "CAJA_VECINA", "OTRO"]),
  referencia: z.string().trim().max(80).optional(),
  // Quien pagó, si no es el titular del arranque.
  pagadoPor: z.string().trim().max(120).optional(),
  pagadoPorTelefono: z.string().trim().max(30).optional(),
});

export type ResultadoPago =
  | {
      ok: true;
      pagoId: string;
      comprobanteUrl: string;
      montoPagado: number;
      montoTotal: number;
    }
  | { ok: false; error: string };

/** Registra un pago o abono sobre una boleta y deja listo su comprobante. */
export async function registrarPago(
  boletaId: string,
  datos: {
    monto: number;
    fecha: string;
    medio: string;
    referencia?: string;
    pagadoPor?: string;
    pagadoPorTelefono?: string;
  }
): Promise<ResultadoPago> {
  const { user, apr } = await requireAdmin();

  const parsed = pagoSchema.safeParse({
    monto: Math.round(datos.monto),
    fecha: new Date(`${datos.fecha}T12:00:00`),
    medio: datos.medio,
    referencia: datos.referencia || undefined,
    pagadoPor: datos.pagadoPor || undefined,
    pagadoPorTelefono: datos.pagadoPorTelefono || undefined,
  });
  if (!parsed.success || Number.isNaN(parsed.data.fecha.getTime())) {
    return { ok: false, error: parsed.success ? "La fecha no es válida." : parsed.error.issues[0].message };
  }
  if (parsed.data.fecha.getTime() > Date.now() + 24 * 3600 * 1000) {
    return { ok: false, error: "La fecha del pago no puede ser futura." };
  }

  const [fila] = await db
    .select({
      id: boletas.id,
      socioId: boletas.socioId,
      montoTotal: boletas.montoTotal,
      montoPagado: boletas.montoPagado,
      estado: boletas.estado,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(boletas.id, boletaId), eq(socios.aprId, apr.id)))
    .limit(1);
  if (!fila) return { ok: false, error: "No encontramos esa boleta." };
  if (fila.estado === "ANULADA") {
    return { ok: false, error: "No se puede registrar un pago en una boleta anulada." };
  }

  const falta = Math.max(0, fila.montoTotal - fila.montoPagado);
  if (parsed.data.monto > falta) {
    return {
      ok: false,
      error:
        falta === 0
          ? "Esta boleta ya está pagada completa."
          : `El monto supera lo que falta por pagar (${falta.toLocaleString("es-CL")}).`,
    };
  }

  const [pago] = await db
    .insert(pagos)
    .values({
      boletaId,
      socioId: fila.socioId,
      concepto: "BOLETA",
      monto: parsed.data.monto,
      fecha: parsed.data.fecha,
      medio: parsed.data.medio,
      referencia: parsed.data.referencia ?? null,
      pagadoPor: parsed.data.pagadoPor ?? null,
      pagadoPorTelefono: parsed.data.pagadoPorTelefono ? normalizarTelefono(parsed.data.pagadoPorTelefono) : null,
      registradoPorId: user.id,
    })
    .returning({ id: pagos.id });

  const total = await recalcularBoleta(boletaId);

  revalidatePath("/panel/boletas");
  revalidatePath("/panel/pagos");
  revalidatePath("/panel");
  return {
    ok: true,
    pagoId: pago.id,
    comprobanteUrl: urlComprobante(pago.id),
    montoPagado: total?.pagado ?? fila.montoPagado + parsed.data.monto,
    montoTotal: fila.montoTotal,
  };
}

const cobroSchema = pagoSchema.extend({
  concepto: z.enum(["RECONEXION", "REPARACION", "OTRO"]),
  descripcion: z.string().trim().max(200).optional(),
});

export type ResultadoCobro =
  | { ok: true; pagoId: string; comprobanteUrl: string }
  | { ok: false; error: string };

/**
 * Registra un cobro que no es una boleta: la reposición o reconexión de un
 * socio, una reparación u otro cobro. Queda con su comprobante, igual que un pago.
 */
export async function registrarCobro(
  socioId: string,
  datos: {
    concepto: string;
    monto: number;
    fecha: string;
    medio: string;
    referencia?: string;
    descripcion?: string;
    pagadoPor?: string;
    pagadoPorTelefono?: string;
  }
): Promise<ResultadoCobro> {
  const { user, apr } = await requireAdmin();

  const parsed = cobroSchema.safeParse({
    concepto: datos.concepto,
    monto: Math.round(datos.monto),
    fecha: new Date(`${datos.fecha}T12:00:00`),
    medio: datos.medio,
    referencia: datos.referencia || undefined,
    descripcion: datos.descripcion || undefined,
    pagadoPor: datos.pagadoPor || undefined,
    pagadoPorTelefono: datos.pagadoPorTelefono || undefined,
  });
  if (!parsed.success || Number.isNaN(parsed.data.fecha.getTime())) {
    return { ok: false, error: parsed.success ? "La fecha no es válida." : parsed.error.issues[0].message };
  }
  if (parsed.data.fecha.getTime() > Date.now() + 24 * 3600 * 1000) {
    return { ok: false, error: "La fecha del pago no puede ser futura." };
  }
  if (parsed.data.concepto === "OTRO" && !parsed.data.descripcion) {
    return { ok: false, error: "Escribe qué se está cobrando." };
  }

  const [socio] = await db
    .select({ id: socios.id })
    .from(socios)
    .where(and(eq(socios.id, socioId), eq(socios.aprId, apr.id)))
    .limit(1);
  if (!socio) return { ok: false, error: "No encontramos a ese socio." };

  const [pago] = await db
    .insert(pagos)
    .values({
      boletaId: null,
      socioId: socio.id,
      concepto: parsed.data.concepto,
      descripcion: parsed.data.descripcion ?? null,
      monto: parsed.data.monto,
      fecha: parsed.data.fecha,
      medio: parsed.data.medio,
      referencia: parsed.data.referencia ?? null,
      pagadoPor: parsed.data.pagadoPor ?? null,
      pagadoPorTelefono: parsed.data.pagadoPorTelefono ? normalizarTelefono(parsed.data.pagadoPorTelefono) : null,
      registradoPorId: user.id,
    })
    .returning({ id: pagos.id });

  revalidatePath("/panel/pagos");
  return { ok: true, pagoId: pago.id, comprobanteUrl: urlComprobante(pago.id) };
}

export type PagoRegistrado = {
  id: string;
  monto: number;
  fecha: string;
  medio: string;
  referencia: string | null;
  pagadoPor: string | null;
  pagadoPorTelefono: string | null;
  comprobanteUrl: string;
};

/** Los pagos ya registrados de una boleta, del más reciente al más antiguo. */
export async function pagosDeBoleta(boletaId: string): Promise<PagoRegistrado[]> {
  const { apr } = await requireAdmin();
  const filas = await db
    .select({
      id: pagos.id,
      monto: pagos.monto,
      fecha: pagos.fecha,
      medio: pagos.medio,
      referencia: pagos.referencia,
      pagadoPor: pagos.pagadoPor,
      pagadoPorTelefono: pagos.pagadoPorTelefono,
    })
    .from(pagos)
    .innerJoin(boletas, eq(pagos.boletaId, boletas.id))
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(pagos.boletaId, boletaId), eq(socios.aprId, apr.id)))
    .orderBy(desc(pagos.fecha), desc(pagos.createdAt));

  return filas.map((f) => ({
    id: f.id,
    monto: f.monto,
    fecha: f.fecha.toISOString(),
    medio: f.medio,
    referencia: f.referencia,
    pagadoPor: f.pagadoPor,
    pagadoPorTelefono: f.pagadoPorTelefono,
    comprobanteUrl: urlComprobante(f.id),
  }));
}

/** Quita un pago registrado por error; la boleta vuelve a deber ese monto. */
export async function eliminarPago(pagoId: string): Promise<ResultadoAccion> {
  const { apr } = await requireAdmin();
  const pago = await pagoDelComite(apr.id, pagoId);
  if (!pago) return { ok: false, error: "No encontramos ese pago." };

  await db.delete(pagos).where(eq(pagos.id, pago.id));
  // Un cobro que no es una boleta no tiene nada que recalcular.
  if (pago.boletaId) await recalcularBoleta(pago.boletaId);

  // Si era parte de un acuerdo que estaba cumplido, deja de estarlo: vuelve a deber ese monto.
  if (pago.repactacionId) {
    try {
      await db
        .update(repactaciones)
        .set({ estado: "ACTIVA", updatedAt: new Date() })
        .where(and(eq(repactaciones.id, pago.repactacionId), eq(repactaciones.estado, "CUMPLIDA")));
    } catch {
      // Ya hay otro acuerdo activo de ese socio: el viejo se queda como estaba.
    }
  }

  revalidatePath("/panel/boletas");
  revalidatePath("/panel/pagos");
  revalidatePath("/panel");
  return { ok: true };
}

export async function anularBoleta(boletaId: string): Promise<ResultadoAccion> {
  const { apr } = await requireAdmin();

  const fila = await db
    .select({ id: boletas.id })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(boletas.id, boletaId), eq(socios.aprId, apr.id)))
    .limit(1);

  if (fila.length === 0) {
    return { ok: false, error: "No encontramos esa boleta." };
  }

  await db
    .update(boletas)
    .set({ estado: "ANULADA", updatedAt: new Date() })
    .where(eq(boletas.id, boletaId));

  revalidatePath("/panel/boletas");
  revalidatePath("/panel");
  return { ok: true };
}

export async function eliminarBoleta(
  boletaId: string
): Promise<ResultadoAccion> {
  const { apr } = await requireAdmin();

  const fila = await db
    .select({ id: boletas.id })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(boletas.id, boletaId), eq(socios.aprId, apr.id)))
    .limit(1);

  if (fila.length === 0) {
    return { ok: false, error: "No encontramos esa boleta." };
  }

  await db.delete(boletas).where(eq(boletas.id, boletaId));

  revalidatePath("/panel/boletas");
  revalidatePath("/panel");
  return { ok: true };
}


/**
 * Importa boletas desde CSV. Columnas: rut, periodo, monto, vencimiento y
 * opcionalmente lecturaAnterior y lecturaActual.
 *
 * Reimportar el mismo período actualiza en vez de duplicar: un comité que
 * corrige su planilla y vuelve a subirla espera eso, no 250 boletas repetidas.
 */
export async function importarBoletas(
  _prev: ResultadoImportacion | null,
  formData: FormData
): Promise<ResultadoImportacion> {
  const { apr } = await requireAdmin();

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "Elige un archivo CSV o Excel (.xlsx)." };
  }

  if (archivo.size > 2_000_000) {
    return { ok: false, error: "El archivo es demasiado grande (máximo 2 MB)." };
  }

  // CSV o Excel (.xlsx): desde aquí todo trabaja sobre filas de texto.
  const tabla = await leerTabla(archivo);
  if (!tabla.ok) return { ok: false, error: tabla.error };
  const filas = tabla.filas;

  const encabezado = filas[0].map((h) =>
    h
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  );

  const col = (...nombres: string[]) =>
    nombres.map((n) => encabezado.indexOf(n)).find((i) => i >= 0) ?? -1;

  const iRut = col("rut", "rut socio", "rutsocio");
  // Cada arranque se cobra aparte y una persona puede tener varios con el mismo
  // RUT: el N.º de arranque es la forma exacta de nombrar una cuenta.
  const iNumero = col("numerocliente", "numero cliente", "n cliente", "arranque", "n arranque");
  const iTipo = col("tipo");
  const iPeriodo = col("periodo", "mes");
  const iMonto = col("monto", "montototal", "monto total", "total");
  const iVence = col("vencimiento", "fechavencimiento", "fecha vencimiento");
  const iEmision = col("emision", "fechaemision", "fecha emision");
  const iLecAnt = col("lecturaanterior", "lectura anterior");
  const iLecAct = col("lecturaactual", "lectura actual");

  if ((iRut < 0 && iNumero < 0) || iPeriodo < 0) {
    return {
      ok: false,
      error:
        "El archivo debe tener al menos las columnas: periodo y rut (o numeroCliente, si hay socios con varios arranques).",
    };
  }

  // Traemos los socios del comité de una vez: evita una consulta por línea.
  const delComite = await db.query.socios.findMany({
    where: eq(socios.aprId, apr.id),
    columns: { id: true, rut: true, tipo: true, numeroCliente: true, uso: true },
  });
  const usoPorId = new Map(delComite.map((s) => [s.id, s.uso]));
  const porRut = new Map<string, string[]>();
  const porNumero = new Map<string, string>(); // "SOCIO|3" → id
  for (const s of delComite) {
    if (s.rut) {
      const clave = normalizarRut(s.rut);
      porRut.set(clave, [...(porRut.get(clave) ?? []), s.id]);
    }
    if (s.numeroCliente) porNumero.set(`${s.tipo}|${s.numeroCliente}`, s.id);
  }

  const omitidas: { linea: number; motivo: string }[] = [];
  const aInsertar: (typeof boletas.$inferInsert)[] = [];
  const vistos = new Set<string>();

  for (let i = 1; i < filas.length; i++) {
    const campos = filas[i];
    const nLinea = i + 1;

    // Primero el N.º de arranque (exacto); si no viene, el RUT, que solo sirve
    // si esa persona tiene un único arranque.
    const numero = iNumero >= 0 ? (campos[iNumero] ?? "").trim().replace(/\.0$/, "") : "";
    const tipo = /usuario/i.test(iTipo >= 0 ? (campos[iTipo] ?? "") : "")
      ? "USUARIO"
      : "SOCIO";
    const rutCrudo = iRut >= 0 ? (campos[iRut] ?? "").trim() : "";

    let socioId: string | undefined;
    if (numero) {
      socioId = porNumero.get(`${tipo}|${numero}`);
      if (!socioId) {
        omitidas.push({
          linea: nLinea,
          motivo: `No hay un ${tipo === "USUARIO" ? "usuario" : "socio"} con N.º ${numero} en tu padrón`,
        });
        continue;
      }
    } else {
      const candidatos = porRut.get(normalizarRut(rutCrudo)) ?? [];
      if (candidatos.length === 1) {
        socioId = candidatos[0];
      } else {
        omitidas.push({
          linea: nLinea,
          motivo:
            candidatos.length === 0
              ? `RUT no está en tu padrón: ${rutCrudo || "vacío"}`
              : `El RUT ${rutCrudo} tiene ${candidatos.length} arranques: agrega la columna numeroCliente para indicar cuál`,
        });
        continue;
      }
    }

    const periodo = normalizarPeriodo(campos[iPeriodo] ?? "");
    if (!periodo) {
      omitidas.push({ linea: nLinea, motivo: `Período inválido: ${campos[iPeriodo] ?? "vacío"}` });
      continue;
    }

    // Dos filas del mismo socio y período dentro del archivo: nos quedamos
    // con la primera y avisamos, en vez de que una pise a la otra en silencio.
    const clave = `${socioId}|${periodo}`;
    if (vistos.has(clave)) {
      omitidas.push({ linea: nLinea, motivo: "Repetida en el archivo (mismo socio y período)" });
      continue;
    }
    vistos.add(clave);

    const lecAnt = iLecAnt >= 0 ? aMonto(campos[iLecAnt] ?? "") : null;
    const lecAct = iLecAct >= 0 ? aMonto(campos[iLecAct] ?? "") : null;

    const calculo = calcularDesdeLecturas(lecAnt, lecAct, tarifasPara(apr, usoPorId.get(socioId)));

    if (calculo && "error" in calculo) {
      omitidas.push({ linea: nLinea, motivo: calculo.error });
      continue;
    }

    const montoCargado = iMonto >= 0 ? aMonto(campos[iMonto] ?? "") : null;
    const montoTotal = calculo ? calculo.montoTotal : montoCargado;

    if (montoTotal === null) {
      omitidas.push({ linea: nLinea, motivo: "Falta el monto y no hay lecturas para calcularlo" });
      continue;
    }

    const emision = iEmision >= 0 ? aFecha(campos[iEmision] ?? "") : null;
    const vence = iVence >= 0 ? aFecha(campos[iVence] ?? "") : null;

    const fechaEmision = emision ?? new Date();
    // Sin vencimiento en el CSV, damos 30 días desde la emisión.
    const fechaVencimiento =
      vence ?? new Date(fechaEmision.getTime() + 30 * 86_400_000);

    aInsertar.push({
      socioId,
      periodo,
      montoTotal,
      montoPagado: 0,
      estado: estadoQueCorresponde(montoTotal, 0, fechaVencimiento, "PENDIENTE"),
      fechaEmision,
      fechaVencimiento,
      lecturaAnterior: lecAnt,
      lecturaActual: lecAct,
      consumoM3: calculo ? calculo.consumoM3 : null,
      cargoFijo: calculo ? calculo.cargoFijo : null,
      valorM3: calculo ? calculo.valorM3 : null,
    });
  }

  if (aInsertar.length === 0) {
    return {
      ok: false,
      error:
        omitidas.length > 0
          ? `No se pudo importar ninguna fila. Primer problema: ${omitidas[0].motivo}`
          : "No se pudo importar ninguna fila.",
    };
  }

  // Cuáles ya existían, para informar creadas vs actualizadas.
  const periodosDelArchivo = [...new Set(aInsertar.map((b) => b.periodo))];
  const yaExistian = await db
    .select({ socioId: boletas.socioId, periodo: boletas.periodo })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(
      and(eq(socios.aprId, apr.id), inArray(boletas.periodo, periodosDelArchivo))
    );

  const existentes = new Set(
    yaExistian.map((b) => `${b.socioId}|${b.periodo}`)
  );

  // No pisamos montoPagado: si el comité ya registró un pago, reimportar la
  // planilla no debe borrarlo.
  await db
    .insert(boletas)
    .values(aInsertar)
    .onConflictDoUpdate({
      target: [boletas.socioId, boletas.periodo],
      set: {
        montoTotal: sql`excluded."montoTotal"`,
        estado: sql`excluded."estado"`,
        fechaEmision: sql`excluded."fechaEmision"`,
        fechaVencimiento: sql`excluded."fechaVencimiento"`,
        lecturaAnterior: sql`excluded."lecturaAnterior"`,
        lecturaActual: sql`excluded."lecturaActual"`,
        consumoM3: sql`excluded."consumoM3"`,
        cargoFijo: sql`excluded."cargoFijo"`,
        valorM3: sql`excluded."valorM3"`,
        updatedAt: new Date(),
      },
    });

  const actualizadas = aInsertar.filter((b) =>
    existentes.has(`${b.socioId}|${b.periodo}`)
  ).length;

  revalidatePath("/panel/boletas");
  revalidatePath("/panel");

  return {
    ok: true,
    creadas: aInsertar.length - actualizadas,
    actualizadas,
    omitidas,
  };
}
