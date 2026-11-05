/** Lo del color del sitio que también usa el navegador: la paleta, la validación y el contraste. */

/** Colores listos para elegir. El primero (sin color propio) es el índigo de Facilapr. */
export const PALETA_SITIO: { nombre: string; hex: string | null }[] = [
  { nombre: "Índigo", hex: null },
  { nombre: "Azul", hex: "#1d4ed8" },
  { nombre: "Turquesa", hex: "#0f766e" },
  { nombre: "Verde", hex: "#15803d" },
  { nombre: "Naranja", hex: "#c2410c" },
  { nombre: "Rojo", hex: "#b91c1c" },
  { nombre: "Rosa", hex: "#be185d" },
  { nombre: "Violeta", hex: "#6d28d9" },
  { nombre: "Pizarra", hex: "#334155" },
];

export const esColorHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

/** Luminancia relativa (0 negro, 1 blanco) de un color #rrggbb. */
function luminancia(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Cuánto contraste tiene el color contra el blanco (1 a 21). Con 3 o más, el texto en ese color se lee. */
export const contrasteConBlanco = (hex: string) => 1.05 / (luminancia(hex) + 0.05);

export const MENSAJE_COLOR_CLARO = "Ese color es muy claro: los textos y botones no se leerían bien. Elige uno más oscuro.";

/** El color es válido y se lee bien sobre fondo blanco. */
export const colorUsable = (hex: string) => esColorHex(hex) && contrasteConBlanco(hex) >= 3;
