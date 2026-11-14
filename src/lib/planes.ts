/**
 * Qué habilita cada plan. Es la única fuente de verdad: el panel, la landing
 * pública y las server actions consultan aquí, nunca comparan el plan a mano.
 */

export type Plan = "BASICO" | "ESTANDAR" | "PREMIUM";

export type Capacidad =
  | "chat"
  | "iaChat"
  | "finanzas"
  | "inventario"
  | "personal"
  | "incidentes"
  | "activos"
  | "arranques"
  | "buscador";

const CAPACIDADES: Record<Plan, Capacidad[]> = {
  BASICO: [],
  // Finanzas (Pagos, Caja, Compras, Reportes), Inventario, Labores, Activos fijos y el buscador de módulos (Ctrl K): desde el plan Estándar.
  ESTANDAR: ["chat", "iaChat", "finanzas", "inventario", "activos", "buscador"],
  // RR.HH. (personal) y Operación (incidentes y arranques): solo del plan Grande.
  PREMIUM: ["chat", "iaChat", "finanzas", "inventario", "personal", "incidentes", "activos", "arranques", "buscador"],
};


/** Los nombres con que se venden (landing): Pequeño, Estándar y Grande. */
export const NOMBRE_PLAN: Record<Plan, string> = {
  BASICO: "Pequeño",
  ESTANDAR: "Estándar",
  PREMIUM: "Grande",
};

/** Cuántos socios (arranques) incluye cada plan. Hoy se muestra en "Mi plan"; no bloquea la carga. */
export const LIMITE_SOCIOS: Record<Plan, number> = {
  BASICO: 200,
  ESTANDAR: 800,
  PREMIUM: Number.POSITIVE_INFINITY,
};

/** Cuántos operadores puede tener el comité (con acceso o con invitación pendiente). */
export const LIMITE_TECNICOS: Record<Plan, number> = {
  BASICO: 1,
  ESTANDAR: 3,
  PREMIUM: Number.POSITIVE_INFINITY,
};

export function puede(plan: Plan, capacidad: Capacidad): boolean {
  return CAPACIDADES[plan].includes(capacidad);
}

/** El plan mínimo que habilita una capacidad, para el mensaje de upsell. */
export function planMinimoPara(capacidad: Capacidad): Plan {
  const orden: Plan[] = ["BASICO", "ESTANDAR", "PREMIUM"];
  return orden.find((p) => puede(p, capacidad)) ?? "PREMIUM";
}

/**
 * Convierte el nombre del comité en un subdominio válido.
 * "APR Pitrelahué" → "apr-pitrelahue"
 */
export function generarSlug(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Subdominios que no puede tomar un comité porque ya los usa la app. */
const RESERVADOS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "panel",
  "login",
  "registro",
  "blog",
  "mail",
  "soporte",
  "ayuda",
  "cuenta",
  "facilapr",
]);

export function slugDisponible(slug: string): boolean {
  return (
    /^[a-z0-9][a-z0-9-]{1,39}$/.test(slug) &&
    !slug.endsWith("-") &&
    !RESERVADOS.has(slug)
  );
}
