"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, boletas, lecturas, socios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";

/**
 * Derechos de la Ley 21.719 que la política de privacidad promete:
 * portabilidad (exportar todo en un formato reutilizable) y supresión
 * (cerrar la cuenta y borrar los datos).
 *
 * El plazo de borrado vive en @/lib/retencion: un módulo "use server" solo
 * puede exportar funciones asíncronas.
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

export type ResultadoExportar =
  | { ok: true; contenido: string; nombreArchivo: string }
  | { ok: false; error: string };

/**
 * Exporta todos los datos del comité en un solo JSON. La ley pide un formato
 * estructurado y reutilizable; JSON cumple y conserva las relaciones, cosa
 * que un CSV suelto por tabla perdería.
 */
export async function exportarDatos(): Promise<ResultadoExportar> {
  const { apr } = await requireAdmin();

  try {
    const listaSocios = await db.query.socios.findMany({
      where: eq(socios.aprId, apr.id),
    });
    const idsSocios = listaSocios.map((s) => s.id);

    // inArray con lista vacía genera SQL inválido: un comité recién creado
    // no tiene socios todavía.
    const [listaBoletas, listaLecturas] = await Promise.all([
      idsSocios.length
        ? db.query.boletas.findMany({
            where: inArray(boletas.socioId, idsSocios),
          })
        : Promise.resolve([]),
      idsSocios.length
        ? db.query.lecturas.findMany({
            where: inArray(lecturas.socioId, idsSocios),
          })
        : Promise.resolve([]),
    ]);

    const contenido = JSON.stringify(
      {
        exportadoEn: new Date().toISOString(),
        comite: apr,
        socios: listaSocios,
        boletas: listaBoletas,
        lecturas: listaLecturas,
      },
      null,
      2
    );

    const fecha = new Date().toISOString().slice(0, 10);
    return {
      ok: true,
      contenido,
      nombreArchivo: `facilapr-${apr.slug ?? apr.id}-${fecha}.json`,
    };
  } catch {
    return {
      ok: false,
      error: "No pudimos preparar la exportación. Inténtalo de nuevo.",
    };
  }
}

/**
 * Marca la cuenta para cierre. No borra nada todavía: deja constancia de la
 * fecha para que el borrado ocurra a los 90 días, como dice la política, y
 * para que el comité pueda arrepentirse dentro de ese plazo.
 */
export async function solicitarCierre(
  confirmacion: string
): Promise<ResultadoAccion> {
  const { apr } = await requireAdmin();

  // Escribir el nombre del comité evita el clic accidental en algo que
  // termina borrando el padrón completo.
  if (confirmacion.trim().toLowerCase() !== apr.nombre.trim().toLowerCase()) {
    return {
      ok: false,
      error: "Escribe el nombre exacto de tu comité para confirmar.",
    };
  }

  if (apr.cierreSolicitadoEn) {
    return { ok: false, error: "El cierre ya estaba solicitado." };
  }

  await db
    .update(aprs)
    .set({ cierreSolicitadoEn: new Date(), updatedAt: new Date() })
    .where(eq(aprs.id, apr.id));

  revalidatePath("/panel/configuracion");
  return { ok: true };
}

/** Deshace la solicitud de cierre dentro del plazo de gracia. */
export async function cancelarCierre(): Promise<ResultadoAccion> {
  const { apr } = await requireAdmin();

  if (!apr.cierreSolicitadoEn) {
    return { ok: false, error: "Esta cuenta no tiene un cierre pendiente." };
  }

  await db
    .update(aprs)
    .set({ cierreSolicitadoEn: null, updatedAt: new Date() })
    .where(eq(aprs.id, apr.id));

  revalidatePath("/panel/configuracion");
  return { ok: true };
}

/** Cuántos datos hay, para mostrarlos antes de una acción irreversible. */
export async function resumenDatos() {
  const { apr } = await requireAdmin();

  const idsSocios = (
    await db.query.socios.findMany({
      where: eq(socios.aprId, apr.id),
      columns: { id: true },
    })
  ).map((s) => s.id);

  const totalBoletas = idsSocios.length
    ? await db.$count(boletas, inArray(boletas.socioId, idsSocios))
    : 0;

  return {
    socios: idsSocios.length,
    boletas: totalBoletas,
    cierreSolicitadoEn: apr.cierreSolicitadoEn,
  };
}
