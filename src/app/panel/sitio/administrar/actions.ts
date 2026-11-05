"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { avisos, sitioImagenes } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { mensajeError } from "@/lib/db-errores";
import { BYTES_MAXIMOS_IMAGEN, REGLAS_IMAGEN, type TipoImagenSitio } from "@/lib/sitio-imagenes-comun";

export type ResultadoImagen = { ok: true } | { ok: false; error: string };

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

/**
 * Sube una imagen del sitio (el navegador ya la comprimió). Logo y portada reemplazan a la anterior;
 * la galería admite hasta 8.
 */
export async function subirImagen(formData: FormData): Promise<ResultadoImagen> {
  const { apr, error } = await exigirLanding();
  if (error) return { ok: false, error };

  const tipo = String(formData.get("tipo") ?? "") as TipoImagenSitio;
  const regla = REGLAS_IMAGEN[tipo];
  // Las imágenes de las secciones se suben junto con la sección (secciones-actions), no por aquí.
  if (!regla || tipo === "SECCION") return { ok: false, error: "Tipo de imagen no válido." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "Elige una imagen." };
  if (archivo.size > BYTES_MAXIMOS_IMAGEN) return { ok: false, error: "La imagen es muy pesada. Prueba con otra más chica." };

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const mime = tipoReal(buffer);
  if (!mime) return { ok: false, error: "Solo se aceptan imágenes JPG, PNG o WebP." };

  const pie = String(formData.get("pie") ?? "").trim().slice(0, 140) || null;

  try {
    const r = await db.transaction(async (tx) => {
      if (tipo === "GALERIA") {
        const [{ total }] = await tx
          .select({ total: count() })
          .from(sitioImagenes)
          .where(and(eq(sitioImagenes.aprId, apr.id), eq(sitioImagenes.tipo, "GALERIA")));
        if (total >= regla.max) return { ok: false as const, error: `La galería admite hasta ${regla.max} fotos. Borra alguna para agregar otra.` };
      } else {
        await tx.delete(sitioImagenes).where(and(eq(sitioImagenes.aprId, apr.id), eq(sitioImagenes.tipo, tipo)));
      }
      await tx.insert(sitioImagenes).values({
        aprId: apr.id,
        tipo,
        mime,
        datos: buffer.toString("base64"),
        bytes: buffer.length,
        pie,
        orden: Date.now() % 2_000_000_000,
      });
      return { ok: true as const };
    });
    if (!r.ok) return r;
  } catch (e) {
    console.error("Sitio: no se pudo subir la imagen:", e);
    return { ok: false, error: mensajeError(e, "No pudimos subir la imagen. Inténtalo de nuevo.") };
  }

  refrescar(apr.slug);
  return { ok: true };
}

export async function eliminarImagen(id: string): Promise<ResultadoImagen> {
  const { apr, error } = await exigirLanding();
  if (error) return { ok: false, error };

  try {
    // El filtro por aprId impide borrar la imagen de otro comité.
    await db.delete(sitioImagenes).where(and(eq(sitioImagenes.id, id), eq(sitioImagenes.aprId, apr.id)));
  } catch (e) {
    console.error("Sitio: no se pudo borrar la imagen:", e);
    return { ok: false, error: mensajeError(e, "No pudimos borrar la imagen.") };
  }

  refrescar(apr.slug);
  return { ok: true };
}

export async function cambiarPieImagen(id: string, pie: string): Promise<ResultadoImagen> {
  const { apr, error } = await exigirLanding();
  if (error) return { ok: false, error };

  try {
    await db
      .update(sitioImagenes)
      .set({ pie: pie.trim().slice(0, 140) || null })
      .where(and(eq(sitioImagenes.id, id), eq(sitioImagenes.aprId, apr.id)));
  } catch (e) {
    console.error("Sitio: no se pudo cambiar el pie:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar el texto.") };
  }

  refrescar(apr.slug);
  return { ok: true };
}

/** Oculta o vuelve a mostrar un aviso en el sitio sin borrarlo. */
export async function alternarAviso(id: string, publicado: boolean): Promise<ResultadoImagen> {
  const { apr, error } = await exigirLanding();
  if (error) return { ok: false, error };

  await db
    .update(avisos)
    .set({ publicado, updatedAt: new Date() })
    .where(and(eq(avisos.id, id), eq(avisos.aprId, apr.id)));

  refrescar(apr.slug);
  return { ok: true };
}
