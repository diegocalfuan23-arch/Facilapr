"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { aprs, avisos, sitioTema } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, slugDisponible, type Plan } from "@/lib/planes";
import { generarSitio, type SitioGenerado } from "@/lib/ia";
import { colorUsable, MENSAJE_COLOR_CLARO } from "@/lib/sitio-tema-comun";
import { mensajeError } from "@/lib/db-errores";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

const sitioSchema = z.object({
  slug: z.string().trim().toLowerCase(),
  sitioDescripcion: z.string().trim().max(500).optional(),
  horarioAtencion: z.string().trim().max(300).optional(),
  tarifaCargoFijo: z.number().int().min(0).nullable(),
  tarifaMetroCubico: z.number().int().min(0).nullable(),
  infoPago: z.string().trim().max(1000).optional(),
});

const avisoSchema = z.object({
  tipo: z.enum(["CORTE", "MANTENCION", "NOTICIA"]),
  titulo: z.string().trim().min(1, "El título es obligatorio.").max(160),
  cuerpo: z.string().trim().max(1000).optional(),
  sectores: z.string().trim().max(300).optional(),
  inicia: z.date().nullable(),
  termina: z.date().nullable(),
});

/** Convierte "$12.500" o "12500" a 12500. Devuelve null si viene vacío. */
function aEntero(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").replace(/[^\d]/g, "");
  return texto === "" ? null : Number(texto);
}

function aFecha(valor: FormDataEntryValue | null): Date | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * Comprueba el plan en el servidor. Ocultar el formulario en el cliente no
 * es control de acceso: sin esto, un POST directo saltaría el gate.
 */
async function exigirLanding() {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "landing")) {
    return { apr, error: "Tu plan actual no incluye el sitio público." };
  }
  return { apr, error: null };
}

export async function guardarSitio(
  _prev: ResultadoAccion | null,
  formData: FormData
): Promise<ResultadoAccion> {
  const { apr, error } = await exigirLanding();
  if (error) return { ok: false, error };

  const parsed = sitioSchema.safeParse({
    slug: formData.get("slug"),
    sitioDescripcion: formData.get("sitioDescripcion") || undefined,
    horarioAtencion: formData.get("horarioAtencion") || undefined,
    tarifaCargoFijo: aEntero(formData.get("tarifaCargoFijo")),
    tarifaMetroCubico: aEntero(formData.get("tarifaMetroCubico")),
    infoPago: formData.get("infoPago") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const datos = parsed.data;

  if (!slugDisponible(datos.slug)) {
    return {
      ok: false,
      error:
        "La dirección solo admite letras, números y guiones, y no puede ser una palabra reservada.",
    };
  }

  // El índice único es parcial, así que un slug repetido daría error de base
  // en vez de un mensaje entendible. Lo comprobamos antes.
  const tomado = await db.query.aprs.findFirst({
    where: and(eq(aprs.slug, datos.slug), ne(aprs.id, apr.id)),
    columns: { id: true },
  });

  if (tomado) {
    return { ok: false, error: "Esa dirección ya está tomada por otro comité." };
  }

  // El color del sitio: vacío es el de Facilapr. Se valida antes de guardar nada.
  const color = String(formData.get("sitioColor") ?? "").trim().toLowerCase();
  if (color && !colorUsable(color)) return { ok: false, error: MENSAJE_COLOR_CLARO };

  await db
    .update(aprs)
    .set({
      slug: datos.slug,
      sitioDescripcion: datos.sitioDescripcion ?? null,
      horarioAtencion: datos.horarioAtencion ?? null,
      // Las tarifas se editan en Configuración -> Facturación. Aquí solo se
      // actualizan si vienen completas: un campo vacío no debe borrar las que
      // ya estaban guardadas.
      ...(datos.tarifaCargoFijo !== null && datos.tarifaMetroCubico !== null
        ? {
            tarifaCargoFijo: datos.tarifaCargoFijo,
            tarifaMetroCubico: datos.tarifaMetroCubico,
          }
        : {}),
      infoPago: datos.infoPago ?? null,
      updatedAt: new Date(),
    })
    .where(eq(aprs.id, apr.id));

  try {
    if (color) {
      await db
        .insert(sitioTema)
        .values({ aprId: apr.id, color })
        .onConflictDoUpdate({ target: sitioTema.aprId, set: { color, updatedAt: new Date() } });
    } else {
      await db.delete(sitioTema).where(eq(sitioTema.aprId, apr.id));
    }
  } catch (e) {
    console.error("Sitio: no se pudo guardar el color:", e);
    // Sin la tabla, el resto ya quedó guardado: solo se avisa del color.
    if (color) return { ok: false, error: mensajeError(e, "Se guardó todo, menos el color. Inténtalo de nuevo.") };
  }

  revalidatePath("/panel/sitio");
  revalidatePath(`/sitio/${datos.slug}`);
  return { ok: true };
}

export async function alternarPublicado(
  publicar: boolean
): Promise<ResultadoAccion> {
  const { apr, error } = await exigirLanding();
  if (error) return { ok: false, error };

  // Sin dirección el sitio no tiene dónde vivir.
  if (publicar && !apr.slug) {
    return {
      ok: false,
      error: "Primero define la dirección de tu sitio y guarda los cambios.",
    };
  }

  await db
    .update(aprs)
    .set({ sitioPublicado: publicar, updatedAt: new Date() })
    .where(eq(aprs.id, apr.id));

  revalidatePath("/panel/sitio");
  if (apr.slug) revalidatePath(`/sitio/${apr.slug}`);
  return { ok: true };
}

export async function crearAviso(
  _prev: ResultadoAccion | null,
  formData: FormData
): Promise<ResultadoAccion> {
  const { apr, error } = await exigirLanding();
  if (error) return { ok: false, error };

  const parsed = avisoSchema.safeParse({
    tipo: formData.get("tipo"),
    titulo: formData.get("titulo"),
    cuerpo: formData.get("cuerpo") || undefined,
    sectores: formData.get("sectores") || undefined,
    inicia: aFecha(formData.get("inicia")),
    termina: aFecha(formData.get("termina")),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const datos = parsed.data;

  if (datos.inicia && datos.termina && datos.termina <= datos.inicia) {
    return { ok: false, error: "El término debe ser posterior al inicio." };
  }

  await db.insert(avisos).values({
    aprId: apr.id,
    tipo: datos.tipo,
    titulo: datos.titulo,
    cuerpo: datos.cuerpo ?? null,
    sectores: datos.sectores ?? null,
    inicia: datos.inicia,
    termina: datos.termina,
  });

  revalidatePath("/panel/sitio");
  revalidatePath("/panel/sitio/administrar");
  if (apr.slug) revalidatePath(`/sitio/${apr.slug}`);
  return { ok: true };
}

export type ResultadoGenerar =
  | { ok: true; datos: SitioGenerado }
  | { ok: false; error: string };

/**
 * Completa descripción, horario e info de pago desde un par de frases
 * sueltas del dirigente. Solo devuelve el texto sugerido: no escribe en la
 * base, para que el dirigente pueda revisarlo antes de guardar.
 */
export async function generarSitioIA(
  texto: string
): Promise<ResultadoGenerar> {
  const { apr, error } = await exigirLanding();
  if (error) return { ok: false, error };

  const limpio = texto.trim();
  if (!limpio) {
    return { ok: false, error: "Escribe algo sobre tu comité primero." };
  }
  if (limpio.length > 800) {
    return { ok: false, error: "Muy largo. Intenta con menos de 800 caracteres." };
  }

  const datos = await generarSitio(limpio, apr.id);
  if (!datos) {
    return {
      ok: false,
      error: "No se pudo generar el texto en este momento. Intenta de nuevo.",
    };
  }

  return { ok: true, datos };
}

export async function eliminarAviso(id: string): Promise<ResultadoAccion> {
  const { apr, error } = await exigirLanding();
  if (error) return { ok: false, error };

  // El filtro por aprId impide borrar el aviso de otro comité.
  await db
    .delete(avisos)
    .where(and(eq(avisos.id, id), eq(avisos.aprId, apr.id)));

  revalidatePath("/panel/sitio");
  revalidatePath("/panel/sitio/administrar");
  if (apr.slug) revalidatePath(`/sitio/${apr.slug}`);
  return { ok: true };
}
