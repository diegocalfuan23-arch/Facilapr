import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sitioSecciones } from "@/lib/db/schema";
import type { SeccionSitio, TarjetaSeccion, TipoSeccion } from "@/lib/sitio-secciones-comun";

export * from "@/lib/sitio-secciones-comun";

function leerTarjetas(json: string | null): TarjetaSeccion[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v
      .filter((t): t is TarjetaSeccion => typeof t?.titulo === "string" && typeof t?.texto === "string")
      .map((t) => ({ titulo: t.titulo, texto: t.texto }));
  } catch {
    return [];
  }
}

/** Las secciones del sitio de un comité, en orden. Si la tabla aún no existe, devuelve vacío. */
export async function listarSecciones(aprId: string, soloVisibles = false): Promise<SeccionSitio[]> {
  try {
    const filas = await db.select().from(sitioSecciones).where(eq(sitioSecciones.aprId, aprId)).orderBy(asc(sitioSecciones.orden), asc(sitioSecciones.createdAt)).limit(40);
    return filas
      .filter((f) => !soloVisibles || f.visible)
      .map((f) => ({
        id: f.id,
        tipo: f.tipo as TipoSeccion,
        titulo: f.titulo,
        texto: f.texto,
        imagenId: f.imagenId,
        botonTexto: f.botonTexto,
        botonUrl: f.botonUrl,
        tarjetas: leerTarjetas(f.tarjetas),
        visible: f.visible,
        orden: f.orden,
      }));
  } catch (e) {
    console.error("Sitio: no se pudieron leer las secciones:", e);
    return [];
  }
}
