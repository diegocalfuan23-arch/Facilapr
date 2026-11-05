import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs } from "@/lib/db/schema";
import { slugDisponible } from "@/lib/planes";

/**
 * Palabras que casi todos los comités comparten y que no distinguen a uno de
 * otro: "Comité de Agua Potable Quema" queda en "quema", no en
 * "comite-de-agua-potable-quema".
 */
const PALABRAS_COMUNES = new Set([
  "comite",
  "comites",
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "agua",
  "potable",
  "rural",
  "apr",
  "ssr",
  "sistema",
  "servicio",
  "cooperativa",
  "coop",
]);

/** El slug que sale del nombre, sin comprobar si ya lo usa otro comité. */
export function slugBase(nombre: string): string {
  const palabras = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  const distintivas = palabras.filter((p) => !PALABRAS_COMUNES.has(p));
  const elegidas = distintivas.length > 0 ? distintivas : palabras;

  const slug = elegidas.join("-").slice(0, 36).replace(/-+$/, "");
  return slugDisponible(slug) ? slug : slug.length >= 2 ? `${slug}-apr` : "comite";
}

/**
 * Un slug libre a partir del nombre. Si "quema" ya lo tiene otro comité, prueba
 * "quema-2", "quema-3"... El slug es la dirección del comité: portal de socios
 * y su portal de socios.
 *
 * `ocupados` permite probar sin base de datos (ver scripts de revisión).
 */
export async function slugUnico(
  nombre: string,
  ocupados?: Set<string>
): Promise<string> {
  const base = slugBase(nombre);

  for (let i = 1; i < 100; i++) {
    const sufijo = i === 1 ? "" : `-${i}`;
    const candidato = `${base.slice(0, 40 - sufijo.length)}${sufijo}`;

    const tomado = ocupados
      ? ocupados.has(candidato)
      : Boolean(
          await db.query.aprs.findFirst({
            where: eq(aprs.slug, candidato),
            columns: { id: true },
          })
        );

    if (!tomado) return candidato;
  }

  // Prácticamente imposible: cien comités con el mismo nombre.
  return `${base.slice(0, 30)}-${Date.now().toString(36)}`;
}

export type ResultadoSlug = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Cambia la dirección (slug) de un comité. La usan el propio comité, desde
 * Configuración, y el panel de super admin, por la API interna: así las reglas
 * viven en un solo lugar. Cambiarlo rompe los enlaces anteriores (el del
 * portal de socios y el del sitio), por eso la pantalla lo advierte.
 */
export async function cambiarSlug(
  aprId: string,
  slugCrudo: string
): Promise<ResultadoSlug> {
  const slug = slugCrudo.trim().toLowerCase();

  if (!slugDisponible(slug)) {
    return {
      ok: false,
      error:
        "La dirección admite letras minúsculas, números y guiones (de 2 a 40 caracteres), y no puede ser una palabra reservada.",
    };
  }

  const tomado = await db.query.aprs.findFirst({
    where: and(eq(aprs.slug, slug), ne(aprs.id, aprId)),
    columns: { id: true },
  });
  if (tomado) {
    return { ok: false, error: "Esa dirección ya la usa otro comité." };
  }

  await db
    .update(aprs)
    .set({ slug, updatedAt: new Date() })
    .where(eq(aprs.id, aprId));

  return { ok: true, slug };
}
