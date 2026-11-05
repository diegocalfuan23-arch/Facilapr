/** Lo de las secciones del sitio que también usa el navegador: tipos, límites y validación del enlace del botón. */

export type TipoSeccion = "TEXTO" | "IMAGEN" | "BOTON" | "TARJETAS";

export const TIPOS_SECCION: { valor: TipoSeccion; titulo: string; ayuda: string }[] = [
  { valor: "TEXTO", titulo: "Texto", ayuda: "Un título y un párrafo: quiénes somos, cómo reclamar, normas." },
  { valor: "IMAGEN", titulo: "Imagen con texto", ayuda: "Una foto al lado de un texto." },
  { valor: "BOTON", titulo: "Botón", ayuda: "Un llamado con un botón que lleva a otra página, un WhatsApp o un correo." },
  { valor: "TARJETAS", titulo: "Cuadros", ayuda: "De 2 a 6 cuadros con título y texto: servicios, requisitos, pasos." },
];

export const textoTipoSeccion = (t: string) => TIPOS_SECCION.find((x) => x.valor === t)?.titulo ?? "Sección";

export const MAX_SECCIONES = 12;
export const MAX_TARJETAS = 6;

export type TarjetaSeccion = { titulo: string; texto: string };

export type SeccionSitio = {
  id: string;
  tipo: TipoSeccion;
  titulo: string | null;
  texto: string | null;
  imagenId: string | null;
  botonTexto: string | null;
  botonUrl: string | null;
  tarjetas: TarjetaSeccion[];
  visible: boolean;
  orden: number;
};

/**
 * El enlace de un botón: solo https, http, correo, teléfono o una dirección interna del sitio. Así un botón
 * nunca puede ejecutar código (javascript:) ni abrir algo raro.
 */
export function urlBotonValida(url: string): boolean {
  const u = url.trim();
  if (u.length === 0 || u.length > 500) return false;
  if (/^https?:\/\/[^\s]+$/i.test(u)) return true;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(u)) return true;
  if (/^tel:\+?[\d\s-]{6,20}$/i.test(u)) return true;
  return /^\/[a-z0-9/_-]*$/i.test(u);
}

/** Lo que escribe quien administra → un enlace: «56912345678» pasa a WhatsApp; «www.algo.cl» lleva https. */
export function normalizarUrlBoton(entrada: string): string {
  const u = entrada.trim();
  if (/^\+?\d[\d\s-]{7,}$/.test(u)) return `https://wa.me/${u.replace(/\D/g, "")}`;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(u)) return `mailto:${u}`;
  if (/^www\./i.test(u) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(u) && !u.includes("@")) return `https://${u}`;
  return u;
}
