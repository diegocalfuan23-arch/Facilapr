import { NextRequest } from "next/server";
import { exigirSecreto, respuesta } from "@/lib/interno";
import { LIMITE_SOCIOS, NOMBRE_PLAN, puede, type Capacidad, type Plan } from "@/lib/planes";
import { PLANES_COMERCIALES } from "@/lib/planes-comerciales";

export const dynamic = "force-dynamic";

/**
 * Qué incluye cada plan y cuánto cuesta, para la pantalla «Planes» del super admin. Sale de la misma fuente que usa la
 * aplicación, así las dos nunca dicen cosas distintas.
 */

const PLANES: Plan[] = ["BASICO", "ESTANDAR", "PREMIUM"];

/** Sin `capacidad`, viene en todos los planes. */
const CARACTERISTICAS: { categoria: string; nombre: string; capacidad?: Capacidad; sinPrueba?: boolean }[] = [
  { categoria: "Gestión", nombre: "Socios y boletas" },
  { categoria: "Gestión", nombre: "Subsidios" },
  { categoria: "Gestión", nombre: "Caja, compras y reportes", capacidad: "finanzas" },
  { categoria: "Gestión", nombre: "Datos tarifarios", capacidad: "finanzas" },
  { categoria: "Gestión", nombre: "Inventario y labores", capacidad: "inventario" },
  { categoria: "Gestión", nombre: "Activos fijos", capacidad: "activos" },
  { categoria: "Gestión", nombre: "RR.HH.", capacidad: "personal" },
  { categoria: "Terreno", nombre: "Lecturas desde el celular" },
  { categoria: "Terreno", nombre: "Rutas" },
  { categoria: "Terreno", nombre: "Órdenes de corte y reposición" },
  { categoria: "Terreno", nombre: "Incidentes", capacidad: "incidentes" },
  { categoria: "Terreno", nombre: "Registro de arranques", capacidad: "arranques" },
  { categoria: "Socios", nombre: "Portal del socio" },
  // La prueba gratuita no envía WhatsApp automático.
  { categoria: "Socios", nombre: "WhatsApp automático", sinPrueba: true },
  { categoria: "Socios", nombre: "Chat con socios", capacidad: "chat" },
  { categoria: "Socios", nombre: "IA en el chat", capacidad: "iaChat" },
];

export async function POST(req: NextRequest) {
  const noAutorizado = exigirSecreto(req);
  if (noAutorizado) return noAutorizado;

  const planes = PLANES.map((clave) => {
    const comercial = PLANES_COMERCIALES.find((p) => p.clave === clave);
    return {
      clave,
      nombre: NOMBRE_PLAN[clave],
      uf: comercial?.mensual ?? null,
      desde: comercial?.desde ?? null,
      limiteSocios: Number.isFinite(LIMITE_SOCIOS[clave]) ? LIMITE_SOCIOS[clave] : null,
    };
  });

  const caracteristicas = CARACTERISTICAS.map((c) => ({
    categoria: c.categoria,
    nombre: c.nombre,
    en: {
      // La prueba gratuita trae todo lo del plan Grande.
      PRUEBA: !c.sinPrueba && (!c.capacidad || puede("PREMIUM", c.capacidad)),
      ...Object.fromEntries(PLANES.map((p) => [p, !c.capacidad || puede(p, c.capacidad)])),
    },
  }));

  return respuesta(200, { ok: true, planes, caracteristicas });
}
