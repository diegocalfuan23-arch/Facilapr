/** Lo de las imágenes del sitio que también usa el navegador: tipos, límites y la compresión previa a subirlas. */

export type TipoImagenSitio = "LOGO" | "PORTADA" | "GALERIA" | "SECCION";

export type ImagenSitio = {
  id: string;
  tipo: TipoImagenSitio;
  pie: string | null;
};

/** Cuántas imágenes admite cada tipo y qué tan grandes se dejan. */
export const REGLAS_IMAGEN: Record<TipoImagenSitio, { max: number; lado: number; titulo: string }> = {
  LOGO: { max: 1, lado: 400, titulo: "Logo" },
  PORTADA: { max: 1, lado: 1600, titulo: "Foto de portada" },
  GALERIA: { max: 8, lado: 1200, titulo: "Galería" },
  SECCION: { max: 24, lado: 1200, titulo: "Sección" },
};

/** Tope del archivo ya comprimido. */
export const BYTES_MAXIMOS_IMAGEN = 400_000;

export const urlImagenSitio = (id: string) => `/api/sitio/imagen/${id}`;

/** Las imágenes del sitio ordenadas por tipo, listas para mostrar. */
export type ImagenesDelSitio = {
  logo: ImagenSitio | null;
  portada: ImagenSitio | null;
  galeria: ImagenSitio[];
};

export const SIN_IMAGENES: ImagenesDelSitio = { logo: null, portada: null, galeria: [] };

export function agruparImagenes(filas: ImagenSitio[]): ImagenesDelSitio {
  return {
    logo: filas.find((f) => f.tipo === "LOGO") ?? null,
    portada: filas.find((f) => f.tipo === "PORTADA") ?? null,
    galeria: filas.filter((f) => f.tipo === "GALERIA"),
  };
}
