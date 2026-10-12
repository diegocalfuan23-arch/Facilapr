import { and, desc, eq, gt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, lecturas, mensajesSocio, pagos, socios } from "@/lib/db/schema";
import { usoIaChat } from "@/lib/ia-chat-cuota";
import { responder, type Mensaje } from "@/lib/ia";
import { enviarMensajeChat } from "@/lib/chat-socio";
import { formatearRut, formatearTelefono } from "@/lib/formato";
import { cuentasDelSocio } from "@/lib/socio-session";
import { textoMedioPago } from "@/lib/pagos";
import { formatearPeriodo, saldo } from "@/lib/boletas";
import { puede, type Plan } from "@/lib/planes";
import { inArray } from "drizzle-orm";

/**
 * Asistente de IA dentro del chat del socio con su comité (desde el plan Estándar).
 *
 * Responde en segundos las consultas de dato (cuánto debo, cuándo vence, cómo
 * pago) y le pasa la conversación a una persona cuando no sabe o se trata de
 * algo delicado. Solo lee: no promete plazos ni descuentos y no toca datos.
 */

/**
 * Si la directiva escribió hace menos de esto, la IA se queda callada: hay una
 * persona atendiendo. Pasado ese rato vuelve a responder sola, para que un socio
 * nunca quede esperando.
 */
const PAUSA_MINUTOS = 10;
/** Marca con la que el modelo avisa que necesita una persona. */
const MARCA_HUMANO = "[HUMANO]";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const fecha = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long" });

/** Se llama después de guardar el mensaje de un socio. Nunca lanza: el chat sigue igual si la IA falla. */
export async function responderConIaSiCorresponde(socioId: string) {
  try {
    await intentar(socioId);
  } catch (e) {
    console.error("IA del chat:", e);
  }
}

async function intentar(socioId: string) {
  const socio = await db.query.socios.findFirst({
    where: eq(socios.id, socioId),
    with: { apr: true },
  });
  if (!socio) return;

  const apr = socio.apr;
  if (!puede(apr.plan as Plan, "iaChat") || apr.iaChatModo !== "SIEMPRE") return;
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) return;

  const recientes = await db.query.mensajesSocio.findMany({
    where: eq(mensajesSocio.socioId, socioId),
    orderBy: [desc(mensajesSocio.createdAt)],
    limit: 12,
    columns: { id: true, remitente: true, contenido: true },
  });
  // Solo se responde a un mensaje del socio, y una sola vez.
  if (recientes.length === 0 || recientes[0].remitente !== "SOCIO") return;
  const respondidoA = recientes[0].id;

  // Si una persona de la directiva escribió hace poco, ella lleva la conversación.
  const desde = new Date(Date.now() - PAUSA_MINUTOS * 60_000);
  const humano = await db.query.mensajesSocio.findFirst({
    where: and(
      eq(mensajesSocio.socioId, socioId),
      eq(mensajesSocio.remitente, "DIRECTIVA"),
      gt(mensajesSocio.createdAt, desde)
    ),
    columns: { id: true },
  });
  if (humano) return;

  // Sin tokens (cuota del mes y packs agotados) la IA calla y responde la directiva.
  const uso = await usoIaChat(apr.id, apr.plan as Plan, apr.iaChatTokensExtra);
  if (uso.disponible <= 0) return;

  // Las boletas de todos los arranques de la persona.
  const cuentas = await cuentasDelSocio(socio);
  const listaBoletas = await db.query.boletas.findMany({
    where: inArray(
      boletas.socioId,
      cuentas.map((c) => c.id)
    ),
    orderBy: [desc(boletas.fechaEmision)],
    limit: 6 * cuentas.length,
    with: { socio: { columns: { nombre: true } } },
  });

  // La ficha de la persona: todos sus arranques (mismo RUT) con sus datos propios.
  const fichas = await db.query.socios.findMany({
    where: and(
      eq(socios.aprId, socio.aprId),
      socio.rut ? or(eq(socios.id, socio.id), eq(socios.rut, socio.rut)) : eq(socios.id, socio.id)
    ),
    columns: {
      id: true,
      nombre: true,
      tipo: true,
      rut: true,
      numeroCliente: true,
      direccion: true,
      telefono: true,
      activo: true,
    },
  });
  const idsCuentas = fichas.map((f) => f.id);

  const pagosRecientes = listaBoletas.length
    ? await db
        .select({
          boletaId: pagos.boletaId,
          monto: pagos.monto,
          fecha: pagos.fecha,
          medio: pagos.medio,
        })
        .from(pagos)
        .where(inArray(pagos.boletaId, listaBoletas.map((b) => b.id)))
        .orderBy(desc(pagos.fecha))
        .limit(6)
    : [];
  const periodoDe = new Map(listaBoletas.map((b) => [b.id, b.periodo]));

  const lecturasRecientes = await db.query.lecturas.findMany({
    where: and(inArray(lecturas.socioId, idsCuentas), eq(lecturas.estado, "APROBADA")),
    orderBy: [desc(lecturas.createdAt)],
    limit: 4 * idsCuentas.length,
    columns: { socioId: true, valor: true, periodo: true },
  });
  const nombreDe = new Map(fichas.map((f) => [f.id, f.nombre]));

  const system = construirPrompt({
    comite: {
      nombre: apr.nombre,
      infoPago: apr.infoPago,
      telefono: apr.telefono,
      horario: apr.horarioAtencion,
      instrucciones: apr.iaChatInstrucciones,
    },
    nombreSocio: socio.nombre,
    variosArranques: cuentas.length > 1,
    fichas: fichas.map((f) => ({
      ...f,
      rut: f.rut ? formatearRut(f.rut) : null,
      telefono: f.telefono ? formatearTelefono(f.telefono) : null,
    })),
    pagos: pagosRecientes.map((p) => ({
      periodo: periodoDe.get(p.boletaId) ?? "",
      monto: p.monto,
      fecha: p.fecha,
      medio: textoMedioPago(p.medio),
    })),
    lecturas: lecturasRecientes.map((l) => ({
      arranque: nombreDe.get(l.socioId) ?? "",
      valor: l.valor,
      periodo: l.periodo,
    })),
    boletas: listaBoletas.map((b) => ({ ...b, arranque: b.socio.nombre })),
  });

  const { stream, proveedor } = await responder({
    system,
    mensajes: historial(recientes.slice().reverse()),
    maxTokens: 400,
    forzarSimple: true,
    respuestaEnlatada: "",
    aprId: apr.id,
    origen: "chat-ia",
  });
  // Si ningún proveedor respondió, mejor callar que mandar un texto genérico.
  if (proveedor === "enlatada") return;

  let texto = (await new Response(stream).text()).trim();
  if (!texto) return;

  let requiereHumano = false;
  if (texto.startsWith(MARCA_HUMANO)) {
    requiereHumano = true;
    texto =
      texto.slice(MARCA_HUMANO.length).trim() ||
      "Le avisé a la directiva para que te responda personalmente.";
  }

  // Si mientras la IA pensaba entró otro mensaje, esa nueva entrada tendrá su propia respuesta.
  const ultimo = await db.query.mensajesSocio.findFirst({
    where: eq(mensajesSocio.socioId, socioId),
    orderBy: [desc(mensajesSocio.createdAt)],
    columns: { id: true },
  });
  if (ultimo?.id !== respondidoA) return;

  await enviarMensajeChat({
    socioId,
    remitente: "IA",
    autorId: null,
    contenido: texto,
    requiereHumano,
  });
}

/** El modelo exige que la conversación empiece con el usuario y alterne los turnos. */
function historial(
  mensajes: { remitente: "SOCIO" | "DIRECTIVA" | "IA"; contenido: string }[]
): Mensaje[] {
  const salida: Mensaje[] = [];
  for (const m of mensajes) {
    const rol = m.remitente === "SOCIO" ? "user" : "assistant";
    const anterior = salida.at(-1);
    if (anterior && anterior.rol === rol) anterior.texto += `\n${m.contenido}`;
    else salida.push({ rol, texto: m.contenido });
  }
  while (salida.length > 0 && salida[0].rol === "assistant") salida.shift();
  return salida;
}

export function construirPrompt(d: {
  comite: {
    nombre: string;
    infoPago: string | null;
    telefono: string | null;
    horario: string | null;
    instrucciones: string | null;
  };
  nombreSocio: string;
  variosArranques: boolean;
  /** Sus datos personales, uno por arranque. */
  fichas: {
    nombre: string;
    tipo: string;
    rut: string | null;
    numeroCliente: string | null;
    direccion: string | null;
    telefono: string | null;
    activo: boolean;
  }[];
  pagos: { periodo: string; monto: number; fecha: Date; medio: string }[];
  /** Lecturas del medidor aprobadas, de la más nueva a la más antigua. */
  lecturas: { arranque: string; valor: number; periodo: string }[];
  boletas: {
    arranque: string;
    periodo: string;
    montoTotal: number;
    montoPagado: number;
    estado: string;
    fechaVencimiento: Date;
    consumoM3: number | null;
  }[];
}) {
  const partes: string[] = [];

  partes.push(
    `Eres el asistente de IA del ${d.comite.nombre}, un comité de Agua Potable Rural chileno. Atiendes por el chat a ${d.nombreSocio}, que ya inició sesión con su RUT y clave: su identidad está verificada. Detrás del chat hay una directiva de personas que puede tomar la conversación.

Háblale en español chileno, cercano y directo, en dos a cuatro frases.`
  );

  const datosComite = [
    d.comite.infoPago && `Cómo y dónde pagar: ${d.comite.infoPago}`,
    d.comite.telefono && `Teléfono del comité: ${d.comite.telefono}`,
    d.comite.horario && `Horario de atención: ${d.comite.horario}`,
  ].filter(Boolean);
  if (datosComite.length > 0) partes.push(`Datos del comité:\n${datosComite.join("\n")}`);

  if (d.fichas.length > 0) {
    const fichas = d.fichas.map((f) =>
      [
        `- ${f.nombre}`,
        f.tipo === "USUARIO" ? "usuario (no socio)" : "socio",
        f.rut && `RUT ${f.rut}`,
        f.numeroCliente && `N.º de arranque ${f.numeroCliente}`,
        f.direccion && `dirección ${f.direccion}`,
        f.telefono && `teléfono ${f.telefono}`,
        f.activo ? "cuenta activa" : "cuenta inactiva",
      ]
        .filter(Boolean)
        .join(", ")
    );
    partes.push(`Datos personales del socio (los que el comité tiene registrados; puedes compartírselos a él mismo):\n${fichas.join("\n")}`);
  }

  if (d.lecturas.length > 0) {
    const filas = d.lecturas.map(
      (l) => `- ${d.variosArranques ? `[${l.arranque}] ` : ""}${formatearPeriodo(l.periodo)}: ${l.valor} m³ en el medidor`
    );
    partes.push(`Lecturas de su medidor (las más recientes primero):\n${filas.join("\n")}`);
  }

  if (d.pagos.length > 0) {
    const filas = d.pagos.map(
      (p) => `- ${fecha.format(p.fecha)}: ${clp.format(p.monto)} (${p.medio}) por la boleta de ${formatearPeriodo(p.periodo)}`
    );
    partes.push(`Pagos que ya registró el comité (los más recientes primero):\n${filas.join("\n")}`);
  }

  if (d.boletas.length === 0) {
    partes.push("Este socio todavía no tiene boletas emitidas.");
  } else {
    const lista = d.boletas.map((b) => {
      const deuda = saldo(b.montoTotal, b.montoPagado);
      const campos = [
        `- ${d.variosArranques ? `[${b.arranque}] ` : ""}${formatearPeriodo(b.periodo)}: total ${clp.format(b.montoTotal)}, estado ${b.estado.toLowerCase()}, vence ${fecha.format(b.fechaVencimiento)}`,
      ];
      if (deuda > 0) campos.push(`  Saldo pendiente: ${clp.format(deuda)}`);
      if (b.consumoM3 !== null) campos.push(`  Consumo: ${b.consumoM3} m³`);
      return campos.join("\n");
    });
    partes.push(`Sus boletas (las más recientes primero):\n${lista.join("\n")}`);
  }

  if (d.comite.instrucciones?.trim()) {
    partes.push(
      `Instrucciones del comité (síguelas mientras no contradigan las reglas de abajo):\n${d.comite.instrucciones.trim()}`
    );
  }

  partes.push(`Reglas:
- Responde solo con los datos de arriba. Nunca inventes montos, fechas, plazos ni teléfonos.
- Eres una IA y, si te lo preguntan, lo dices. No finjas ser una persona.
- No prometas plazos, descuentos, repactaciones, reconexiones ni condonaciones: eso lo decide la directiva.
- Sus datos personales de arriba son suyos: si los pide, se los das. No hables de otros socios ni de datos que no aparezcan arriba. Si pide cambiar un dato, eso lo ve la directiva.
- Si es un reclamo, una fuga o falta de agua, un corte, un cambio de datos personales, una queja o una persona pide hablar con alguien, o no puedes resolverlo con los datos de arriba, empieza tu respuesta con ${MARCA_HUMANO} y a continuación escribe un mensaje breve diciendo que avisarás a la directiva para que lo atienda personalmente.
- Si la pregunta se resuelve con los datos de arriba, respóndela directamente sin la marca.
- Escribe en texto plano, como en un mensaje de WhatsApp: sin asteriscos, sin negritas y sin listas con símbolos.`);

  return partes.join("\n\n");
}
