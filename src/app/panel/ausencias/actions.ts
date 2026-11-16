"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { ausenciaAdjuntos, ausencias, trabajadores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { mensajeError } from "@/lib/db-errores";
import { puede, type Plan } from "@/lib/planes";
import { diasDe, type TipoAusencia } from "@/lib/rrhh-comun";

export type ResultadoAusencias = { ok: true } | { ok: false; error: string };

const aTexto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.");

const ausenciaSchema = z.object({
  trabajadorId: z.string().min(1, "Elige a la persona.").max(64),
  tipo: z.enum(["VACACIONES", "LICENCIA", "PERMISO"]),
  desde: fecha,
  hasta: fecha,
  estado: z.enum(["SOLICITADA", "APROBADA", "RECHAZADA"]),
  detalle: z.string().trim().max(200).nullable(),
  sinGoce: z.boolean(),
  /** Un permiso por horas: cuántas (de un solo día). */
  horas: z.number().min(0.25, "Las horas deben ser al menos un cuarto de hora.").max(12, "Un permiso por horas no puede pasar de 12 horas.").nullable(),
  nota: z.string().trim().max(500).nullable(),
});

const ADJUNTO_MAX_BYTES = 3 * 1024 * 1024;

/** Los primeros bytes de cada tipo de archivo: no se confía en el tipo que declara el navegador. */
function tipoReal(b: Buffer): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (b.length >= 5 && b.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

/** Guarda el archivo de una licencia (PDF, PNG o JPG de hasta 3 MB), reemplazando el que tenía. Devuelve el error, o null si salió bien. */
async function guardarAdjunto(aprId: string, ausenciaId: string, archivo: File): Promise<string | null> {
  if (archivo.size > ADJUNTO_MAX_BYTES) return "El archivo pesa más de 3 MB. Prueba con una versión más liviana.";
  const bytes = Buffer.from(await archivo.arrayBuffer());
  const tipo = tipoReal(bytes);
  if (!tipo) return "Solo se pueden adjuntar PDF, PNG o JPG.";
  const nombre = archivo.name.replace(/[\\/\r\n]+/g, " ").trim().slice(0, 120) || "Licencia médica";
  await db.transaction(async (tx) => {
    await tx.delete(ausenciaAdjuntos).where(and(eq(ausenciaAdjuntos.ausenciaId, ausenciaId), eq(ausenciaAdjuntos.aprId, aprId)));
    await tx.insert(ausenciaAdjuntos).values({ aprId, ausenciaId, nombre, tipo, tamano: bytes.length, contenido: bytes.toString("base64") });
  });
  return null;
}

function refrescar() {
  revalidatePath("/panel/vacaciones");
  revalidatePath("/panel/licencias");
  revalidatePath("/panel/asistencia");
}

/** Registra unas vacaciones, una licencia o un permiso, o lo corrige si viene con `id`. Calcula los días solo. */
export async function guardarAusencia(_prev: ResultadoAusencias | null, formData: FormData): Promise<ResultadoAusencias> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: "RR.HH. está disponible en el plan Grande." };

  const parsed = ausenciaSchema.safeParse({
    trabajadorId: formData.get("trabajadorId"),
    tipo: formData.get("tipo"),
    desde: formData.get("desde"),
    hasta: formData.get("hasta"),
    estado: formData.get("estado"),
    detalle: aTexto(formData.get("detalle")),
    sinGoce: formData.get("tipo") === "PERMISO" && formData.get("sinGoce") === "si",
    horas: formData.get("tipo") === "PERMISO" && String(formData.get("horas") ?? "").trim() !== "" ? Number(String(formData.get("horas")).replace(",", ".")) : null,
    nota: aTexto(formData.get("nota")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.hasta < d.desde) return { ok: false, error: "La fecha de término no puede ser antes que la de inicio." };

  // Un permiso por horas es de un solo día y no gasta días: cuenta las horas.
  if (d.horas !== null && d.hasta !== d.desde) return { ok: false, error: "Un permiso por horas es de un solo día." };
  const dias = d.horas !== null ? 0 : diasDe(d.tipo as TipoAusencia, d.desde, d.hasta);
  if (d.horas === null && dias <= 0) return { ok: false, error: "Ese período no tiene días hábiles. Revisa las fechas." };

  const [persona] = await db
    .select({ id: trabajadores.id })
    .from(trabajadores)
    .where(and(eq(trabajadores.id, d.trabajadorId), eq(trabajadores.aprId, apr.id)))
    .limit(1);
  if (!persona) return { ok: false, error: "No encontramos a esa persona." };

  const id = String(formData.get("id") ?? "");
  const archivo = formData.get("archivo");
  const conArchivo = archivo instanceof File && archivo.size > 0 && d.tipo === "LICENCIA" ? archivo : null;
  try {
    let ausenciaId = id;
    // Un rechazo guarda su motivo; al volver a otro estado, el motivo se borra.
    const motivoRechazo = d.estado === "RECHAZADA" ? aTexto(formData.get("motivoRechazo")) : null;
    if (id) {
      const [editada] = await db
        .update(ausencias)
        .set({ ...d, dias, motivoRechazo })
        .where(and(eq(ausencias.id, id), eq(ausencias.aprId, apr.id)))
        .returning({ id: ausencias.id });
      if (!editada) return { ok: false, error: "No encontramos ese registro." };
    } else {
      const [nueva] = await db.insert(ausencias).values({ ...d, dias, motivoRechazo, aprId: apr.id }).returning({ id: ausencias.id });
      ausenciaId = nueva.id;
    }
    if (conArchivo) {
      const falla = await guardarAdjunto(apr.id, ausenciaId, conArchivo);
      if (falla) {
        refrescar();
        return { ok: false, error: `Se guardó la licencia, pero el archivo no: ${falla}` };
      }
    }
  } catch (e) {
    console.error("RR.HH.: no se pudo guardar la ausencia:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar. Inténtalo de nuevo en un momento.") };
  }

  refrescar();
  return { ok: true };
}

/** Borra un registro de vacaciones, licencia o permiso. */
export async function eliminarAusencia(id: string): Promise<ResultadoAusencias> {
  const { apr } = await requireAdmin();

  const borradas = await db
    .delete(ausencias)
    .where(and(eq(ausencias.id, id), eq(ausencias.aprId, apr.id)))
    .returning({ id: ausencias.id });
  if (borradas.length === 0) return { ok: false, error: "No encontramos ese registro." };

  refrescar();
  return { ok: true };
}

/** Cambia el estado de una solicitud (desde el tablero): aprobarla, rechazarla (con su motivo) o dejarla de nuevo como solicitada. */
export async function cambiarEstadoAusencia(id: string, estado: "SOLICITADA" | "APROBADA" | "RECHAZADA", motivo?: string): Promise<ResultadoAusencias> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: "RR.HH. está disponible en el plan Grande." };
  if (!["SOLICITADA", "APROBADA", "RECHAZADA"].includes(estado)) return { ok: false, error: "El estado no es válido." };

  const [editada] = await db
    .update(ausencias)
    .set({ estado, motivoRechazo: estado === "RECHAZADA" ? (motivo ?? "").trim().slice(0, 300) || null : null })
    .where(and(eq(ausencias.id, id), eq(ausencias.aprId, apr.id)))
    .returning({ id: ausencias.id });
  if (!editada) return { ok: false, error: "No encontramos ese registro." };

  refrescar();
  return { ok: true };
}

/** Adjunta (o reemplaza) el archivo de una licencia médica desde su tarjeta. */
export async function adjuntarLicencia(ausenciaId: string, formData: FormData): Promise<ResultadoAusencias> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: "RR.HH. está disponible en el plan Grande." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "Elige un archivo." };

  try {
    const [licencia] = await db
      .select({ id: ausencias.id })
      .from(ausencias)
      .where(and(eq(ausencias.id, ausenciaId), eq(ausencias.aprId, apr.id), eq(ausencias.tipo, "LICENCIA")))
      .limit(1);
    if (!licencia) return { ok: false, error: "No encontramos esa licencia." };
    const falla = await guardarAdjunto(apr.id, ausenciaId, archivo);
    if (falla) return { ok: false, error: falla };
  } catch (e) {
    console.error("RR.HH.: no se pudo adjuntar la licencia:", e);
    return { ok: false, error: mensajeError(e, "No pudimos adjuntar el archivo. Inténtalo de nuevo en un momento.") };
  }

  refrescar();
  return { ok: true };
}
