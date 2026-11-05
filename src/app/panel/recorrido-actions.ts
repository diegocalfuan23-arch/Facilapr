"use server";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireApr } from "@/lib/apr-session";

/**
 * Si esta persona ya vio el recorrido guiado. Se guarda en la columna
 * "recorridoVisto" de la tabla user. Se lee con SQL directo, a propósito: si la
 * columna todavía no existe (falta correr el SQL de creación), no se rompe nada
 * ni se toca el esquema que usa el inicio de sesión; devuelve null y el
 * recorrido se apoya en el navegador.
 */
export async function recorridoYaVisto(): Promise<boolean | null> {
  const { user } = await requireApr({ tesorero: true });
  try {
    const r = await db.execute(
      sql`select "recorridoVisto" as visto from "user" where id = ${user.id}`
    );
    return Boolean((r.rows[0] as { visto?: boolean } | undefined)?.visto);
  } catch {
    return null;
  }
}

export async function marcarRecorridoVisto(): Promise<void> {
  const { user } = await requireApr({ tesorero: true });
  try {
    await db.execute(
      sql`update "user" set "recorridoVisto" = true where id = ${user.id}`
    );
  } catch {
    // Sin la columna no se puede guardar en la base: queda el aviso del navegador.
  }
}
