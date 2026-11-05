import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, avisos } from "@/lib/db/schema";
import { puede, type Plan } from "@/lib/planes";
import type { AvisoSitio, DatosSitio } from "@/components/sitio/sitio-apr";
import { imagenesDelSitio, type ImagenesDelSitio } from "@/lib/sitio-imagenes";

/**
 * Busca el comité dueño de una landing. Devuelve null —y la ruta responde
 * 404— si el sitio no está publicado o si el plan ya no lo permite: al bajar
 * de plan la landing deja de servirse sin que haya que borrar nada.
 */
export async function cargarSitio(
  filtro: { slug: string } | { dominio: string }
): Promise<{ apr: DatosSitio; avisos: AvisoSitio[]; imagenes: ImagenesDelSitio } | null> {
  const condicion =
    "slug" in filtro
      ? eq(aprs.slug, filtro.slug)
      : eq(aprs.dominioPropio, filtro.dominio);

  const apr = await db.query.aprs.findFirst({
    where: and(condicion, eq(aprs.activo, true), eq(aprs.sitioPublicado, true)),
    columns: {
      id: true,
      plan: true,
      nombre: true,
      comuna: true,
      region: true,
      direccion: true,
      telefono: true,
      email: true,
      sitioDescripcion: true,
      horarioAtencion: true,
      tarifaCargoFijo: true,
      tarifaMetroCubico: true,
      infoPago: true,
    },
  });

  if (!apr) return null;
  if (!puede(apr.plan as Plan, "landing")) return null;
  // El dominio propio es exclusivo de Premium.
  if ("dominio" in filtro && !puede(apr.plan as Plan, "dominioPropio")) {
    return null;
  }

  const listado = await db.query.avisos.findMany({
    where: and(eq(avisos.aprId, apr.id), eq(avisos.publicado, true)),
    orderBy: [desc(avisos.createdAt)],
    limit: 5,
    columns: {
      id: true,
      tipo: true,
      titulo: true,
      cuerpo: true,
      sectores: true,
      inicia: true,
      termina: true,
    },
  });

  return { apr, avisos: listado, imagenes: await imagenesDelSitio(apr.id) };
}
