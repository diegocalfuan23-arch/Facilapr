import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sitioImagenes } from "@/lib/db/schema";
import { agruparImagenes, SIN_IMAGENES, type ImagenesDelSitio, type TipoImagenSitio } from "@/lib/sitio-imagenes-comun";

export * from "@/lib/sitio-imagenes-comun";

/** Las imágenes de un comité (sin el archivo). Si la tabla aún no existe, devuelve vacío. */
export async function imagenesDelSitio(aprId: string): Promise<ImagenesDelSitio> {
  try {
    const filas = await db
      .select({ id: sitioImagenes.id, tipo: sitioImagenes.tipo, pie: sitioImagenes.pie })
      .from(sitioImagenes)
      .where(eq(sitioImagenes.aprId, aprId))
      .orderBy(asc(sitioImagenes.orden), asc(sitioImagenes.createdAt))
      .limit(20);
    return agruparImagenes(filas.map((f) => ({ ...f, tipo: f.tipo as TipoImagenSitio })));
  } catch (e) {
    console.error("Sitio: no se pudieron leer las imágenes:", e);
    return SIN_IMAGENES;
  }
}
