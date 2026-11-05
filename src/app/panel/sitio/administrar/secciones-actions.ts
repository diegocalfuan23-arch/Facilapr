"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sitioImagenes, sitioSecciones } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { mensajeError } from "@/lib/db-errores";
import { BYTES_MAXIMOS_IMAGEN, REGLAS_IMAGEN } from "@/lib/sitio-imagenes-comun";
import { MAX_SECCIONES, MAX_TARJETAS, normalizarUrlBoton, urlBotonValida } from "@/lib/sitio-secciones-comun";

export type ResultadoSeccion = { ok: true } | { ok: false; error: string };

async function exigirLanding() {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "landing")) return { apr, error: "Tu plan actual no incluye el sitio público." };
  return { apr, error: null };
}

function refrescar(slug: string | null) {
  revalidatePath("/panel/sitio");
  revalidatePath("/panel/sitio/administrar");
  if (slug) revalidatePath(`/sitio/${slug}`);
}

/** Lee los primeros bytes para saber qué es el archivo de verdad, sin fiarse de lo que declare el navegador. */
function tipoReal(b: Buffer): "image/webp" | "image/jpeg" | "image/png" | null {
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return "image/png";
  return null;
}

const TIPOS = ["TEXTO", "IMAGEN", "BOTON", "TARJETAS"] as const;
const aTexto = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max) || null;

/**
 * Crea una sección del sitio, o la corrige si viene con `id`. Si trae una imagen nueva (el navegador ya la
 * comprimió), reemplaza a la anterior de esa sección.
 */
export async function guardarSeccion(formData: FormData): Promise<ResultadoSeccion> {
  const { apr, error } = await exigirLanding();
  if (error) return { ok: false, error };

  const tipo = String(formData.get("tipo") ?? "") as (typeof TIPOS)[number];
  if (!TIPOS.includes(tipo)) return { ok: false, error: "El tipo de sección no es válido." };

  const titulo = aTexto(formData.get("titulo"), 120);
  const texto = aTexto(formData.get("texto"), 1500);
  let botonTexto: string | null = null;
  let botonUrl: string | null = null;
  let tarjetas: string | null = null;

  if (tipo === "TEXTO" && !titulo && !texto) return { ok: false, error: "Escribe un título o un texto." };
  if (tipo === "IMAGEN" && !texto && !titulo) return { ok: false, error: "Escribe un título o un texto para acompañar la imagen." };

  if (tipo === "BOTON") {
    botonTexto = aTexto(formData.get("botonTexto"), 40);
    const url = normalizarUrlBoton(String(formData.get("botonUrl") ?? ""));
    if (!botonTexto) return { ok: false, error: "Escribe lo que dice el botón." };
    if (!urlBotonValida(url)) return { ok: false, error: "El enlace no es válido. Usa una dirección web (https://…), un correo o un teléfono." };
    botonUrl = url;
  }

  if (tipo === "TARJETAS") {
    let crudas: unknown;
    try {
      crudas = JSON.parse(String(formData.get("tarjetas") ?? "[]"));
    } catch {
      return { ok: false, error: "Los cuadros no son válidos." };
    }
    const lista = (Array.isArray(crudas) ? crudas : [])
      .map((t) => ({ titulo: String(t?.titulo ?? "").trim().slice(0, 80), texto: String(t?.texto ?? "").trim().slice(0, 300) }))
      .filter((t) => t.titulo || t.texto)
      .slice(0, MAX_TARJETAS);
    if (lista.length < 2) return { ok: false, error: "Agrega al menos 2 cuadros con texto." };
    tarjetas = JSON.stringify(lista);
  }

  // La imagen nueva, si la hay.
  const archivo = formData.get("archivo");
  let imagen: { buffer: Buffer; mime: "image/webp" | "image/jpeg" | "image/png" } | null = null;
  if (tipo === "IMAGEN" && archivo instanceof File && archivo.size > 0) {
    if (archivo.size > BYTES_MAXIMOS_IMAGEN) return { ok: false, error: "La imagen es muy pesada. Prueba con otra más chica." };
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const mime = tipoReal(buffer);
    if (!mime) return { ok: false, error: "Solo se aceptan imágenes JPG, PNG o WebP." };
    imagen = { buffer, mime };
  }

  const id = String(formData.get("id") ?? "");

  try {
    const r = await db.transaction(async (tx) => {
      let imagenId: string | null = null;
      let anteriorId: string | null = null;

      if (id) {
        const [actual] = await tx
          .select({ imagenId: sitioSecciones.imagenId })
          .from(sitioSecciones)
          .where(and(eq(sitioSecciones.id, id), eq(sitioSecciones.aprId, apr.id)))
          .limit(1);
        if (!actual) return { ok: false as const, error: "No encontramos esa sección." };
        imagenId = actual.imagenId;
      } else {
        const [{ total }] = await tx.select({ total: count() }).from(sitioSecciones).where(eq(sitioSecciones.aprId, apr.id));
        if (total >= MAX_SECCIONES) return { ok: false as const, error: `Puedes tener hasta ${MAX_SECCIONES} secciones. Borra alguna para agregar otra.` };
      }

      if (tipo === "IMAGEN" && !imagen && !imagenId) return { ok: false as const, error: "Elige una imagen para la sección." };

      if (imagen) {
        const [{ total }] = await tx
          .select({ total: count() })
          .from(sitioImagenes)
          .where(and(eq(sitioImagenes.aprId, apr.id), eq(sitioImagenes.tipo, "SECCION")));
        if (total >= REGLAS_IMAGEN.SECCION.max) return { ok: false as const, error: "Llegaste al máximo de imágenes en secciones." };
        const [nueva] = await tx
          .insert(sitioImagenes)
          .values({ aprId: apr.id, tipo: "SECCION", mime: imagen.mime, datos: imagen.buffer.toString("base64"), bytes: imagen.buffer.length, orden: 0 })
          .returning({ id: sitioImagenes.id });
        anteriorId = imagenId;
        imagenId = nueva.id;
      }
      // Una sección que ya no es de imagen no deja la foto olvidada.
      if (tipo !== "IMAGEN") {
        anteriorId = imagenId;
        imagenId = null;
      }

      const valores = { tipo, titulo, texto, imagenId, botonTexto, botonUrl, tarjetas };
      if (id) {
        await tx.update(sitioSecciones).set(valores).where(and(eq(sitioSecciones.id, id), eq(sitioSecciones.aprId, apr.id)));
      } else {
        const [{ m }] = await tx
          .select({ m: sql<number>`coalesce(max(${sitioSecciones.orden}), 0)::int` })
          .from(sitioSecciones)
          .where(eq(sitioSecciones.aprId, apr.id));
        await tx.insert(sitioSecciones).values({ ...valores, aprId: apr.id, orden: m + 1 });
      }
      if (anteriorId && anteriorId !== imagenId) {
        await tx.delete(sitioImagenes).where(and(eq(sitioImagenes.id, anteriorId), eq(sitioImagenes.aprId, apr.id)));
      }
      return { ok: true as const };
    });
    if (!r.ok) return r;
  } catch (e) {
    console.error("Sitio: no se pudo guardar la sección:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar la sección. Inténtalo de nuevo.") };
  }

  refrescar(apr.slug);
  return { ok: true };
}

export async function eliminarSeccion(id: string): Promise<ResultadoSeccion> {
  const { apr, error } = await exigirLanding();
  if (error) return { ok: false, error };

  try {
    await db.transaction(async (tx) => {
      const [sec] = await tx
        .delete(sitioSecciones)
        .where(and(eq(sitioSecciones.id, id), eq(sitioSecciones.aprId, apr.id)))
        .returning({ imagenId: sitioSecciones.imagenId });
      if (sec?.imagenId) await tx.delete(sitioImagenes).where(and(eq(sitioImagenes.id, sec.imagenId), eq(sitioImagenes.aprId, apr.id)));
    });
  } catch (e) {
    console.error("Sitio: no se pudo borrar la sección:", e);
    return { ok: false, error: mensajeError(e, "No pudimos borrar la sección.") };
  }

  refrescar(apr.slug);
  return { ok: true };
}

export async function alternarSeccion(id: string, visible: boolean): Promise<ResultadoSeccion> {
  const { apr, error } = await exigirLanding();
  if (error) return { ok: false, error };

  try {
    await db.update(sitioSecciones).set({ visible }).where(and(eq(sitioSecciones.id, id), eq(sitioSecciones.aprId, apr.id)));
  } catch (e) {
    return { ok: false, error: mensajeError(e, "No pudimos cambiar la sección.") };
  }
  refrescar(apr.slug);
  return { ok: true };
}

/** Sube o baja una sección en el orden del sitio, intercambiando su lugar con la vecina. */
export async function moverSeccion(id: string, direccion: "ARRIBA" | "ABAJO"): Promise<ResultadoSeccion> {
  const { apr, error } = await exigirLanding();
  if (error) return { ok: false, error };

  try {
    await db.transaction(async (tx) => {
      const todas = await tx
        .select({ id: sitioSecciones.id })
        .from(sitioSecciones)
        .where(eq(sitioSecciones.aprId, apr.id))
        .orderBy(sitioSecciones.orden, sitioSecciones.createdAt);
      const i = todas.findIndex((s) => s.id === id);
      const j = direccion === "ARRIBA" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= todas.length) return;
      [todas[i], todas[j]] = [todas[j], todas[i]];
      // Se reescribe el orden completo: así nunca quedan dos secciones con el mismo número.
      for (const [orden, s] of todas.entries()) {
        await tx.update(sitioSecciones).set({ orden }).where(eq(sitioSecciones.id, s.id));
      }
    });
  } catch (e) {
    console.error("Sitio: no se pudo mover la sección:", e);
    return { ok: false, error: mensajeError(e, "No pudimos mover la sección.") };
  }

  refrescar(apr.slug);
  return { ok: true };
}
