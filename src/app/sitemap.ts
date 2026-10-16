import type { MetadataRoute } from "next";
import { ARTICULOS } from "@/lib/ayuda";
import { SITE_URL as SITE_URL_BASE } from "@/lib/site-url";

/**
 * URL canónica del sitio. Sale del entorno porque facilapr.cl se sirve sin
 * www (www.facilapr.cl redirige al dominio raíz): si aquí quedara la
 * variante equivocada, Google indexaría una URL que redirige y se diluiría
 * el posicionamiento entre las dos variantes.
 */
const SITE_URL = SITE_URL_BASE;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/ayuda`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...ARTICULOS.map((a) => ({
      url: `${SITE_URL}/ayuda/${a.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/registro`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/terminos`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacidad`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
