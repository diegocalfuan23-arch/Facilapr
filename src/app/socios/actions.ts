"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { comitesBuscados } from "@/lib/db/schema";
import { avisarComiteBuscado } from "@/lib/correo/comite-buscado";

export type ResultadoAviso = { ok: true } | { ok: false; error: string };

const limpiar = (v: FormDataEntryValue | null, largo: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, largo);
const clave = (nombre: string, comuna: string) =>
  `${nombre}|${comuna}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Un socio dice qué comité busca y no encuentra. Se guarda una fila por comité y se cuentan las veces; la primera vez se
 * avisa por correo. No pide ni guarda nada de la persona. Pública, sin sesión: por eso lleva un campo trampa para los robots.
 */
export async function avisarComiteQueBusco(_prev: ResultadoAviso | null, formData: FormData): Promise<ResultadoAviso> {
  // Un robot llena todos los campos; una persona no ve este.
  if (limpiar(formData.get("sitio"), 100)) return { ok: true };

  const nombre = limpiar(formData.get("nombre"), 80);
  const comuna = limpiar(formData.get("comuna"), 60);
  if (nombre.length < 3) return { ok: false, error: "Escribe el nombre de tu comité." };
  if (comuna.length < 3) return { ok: false, error: "Escribe la comuna." };

  const k = clave(nombre, comuna);
  try {
    const [existente] = await db.select({ id: comitesBuscados.id }).from(comitesBuscados).where(eq(comitesBuscados.clave, k)).limit(1);
    if (existente) {
      await db.update(comitesBuscados).set({ veces: sql`${comitesBuscados.veces} + 1`, updatedAt: new Date() }).where(eq(comitesBuscados.id, existente.id));
    } else {
      await db.insert(comitesBuscados).values({ nombre, comuna, clave: k });
      await avisarComiteBuscado({ nombre, comuna });
    }
  } catch (e) {
    console.error("Socios: no se pudo anotar el comité buscado:", e);
    return { ok: false, error: "No pudimos anotarlo. Inténtalo de nuevo en un momento." };
  }
  return { ok: true };
}
