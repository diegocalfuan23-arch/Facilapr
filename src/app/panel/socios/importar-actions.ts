"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { socios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { normalizarRut, normalizarTelefono } from "@/lib/formato";
import { leerTabla } from "@/lib/tabla";
import {
  detectarSocios,
  validarFilas,
  type Existente,
  type FilaSocio,
} from "@/lib/importar-socios";

/**
 * Importar el padrón en DOS pasos: primero se lee el archivo y se muestra qué
 * se detectó (sin guardar nada); recién cuando la directiva lo revisa y lo
 * confirma, se carga. Así un archivo desordenado no ensucia la base.
 */

const MAX_BYTES = 4_000_000;
const MAX_FILAS = 2000;

export type Previsualizacion =
  | { ok: true; filas: FilaSocio[]; notas: string[]; existentes: Existente[] }
  | { ok: false; error: string };

export type ResultadoConfirmacion =
  | { ok: true; creados: number; actualizados: number; desactivados: number }
  | { ok: false; error: string };

async function existentesDe(aprId: string): Promise<Existente[]> {
  return db.query.socios.findMany({
    where: eq(socios.aprId, aprId),
    columns: {
      id: true,
      tipo: true,
      numeroCliente: true,
      rut: true,
      nombre: true,
      activo: true,
    },
  });
}

/** Paso 1: lee el archivo (CSV, Excel o PDF con texto) y detecta las filas. No guarda nada. */
export async function previsualizarSocios(
  formData: FormData
): Promise<Previsualizacion> {
  const { apr } = await requireAdmin();

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "Elige un archivo CSV, Excel (.xlsx) o PDF." };
  }
  if (archivo.size > MAX_BYTES) {
    return { ok: false, error: "El archivo es demasiado grande (máximo 4 MB)." };
  }

  const tabla = await leerTabla(archivo, { conservarVacias: true });
  if (!tabla.ok) return { ok: false, error: tabla.error };

  const deteccion = detectarSocios(tabla.filas);
  if (!deteccion.ok) return { ok: false, error: deteccion.error };
  if (deteccion.filas.length > MAX_FILAS) {
    return {
      ok: false,
      error: `El archivo trae ${deteccion.filas.length} filas; el máximo por carga es ${MAX_FILAS}.`,
    };
  }

  return {
    ok: true,
    filas: deteccion.filas,
    notas: deteccion.notas,
    existentes: await existentesDe(apr.id),
  };
}

/**
 * Paso 2: guarda las filas que la directiva revisó. Se valida DE NUEVO aquí:
 * lo que llega del navegador no se da por bueno.
 */
export async function importarSociosRevisados(
  filas: FilaSocio[],
  opciones: { desactivarAusentes?: boolean } = {}
): Promise<ResultadoConfirmacion> {
  const { apr } = await requireAdmin();

  if (!Array.isArray(filas) || filas.length === 0) {
    return { ok: false, error: "No hay filas para importar." };
  }
  if (filas.length > MAX_FILAS) {
    return { ok: false, error: `Máximo ${MAX_FILAS} filas por carga.` };
  }

  const texto = (v: unknown, largo: number) => String(v ?? "").trim().slice(0, largo);
  const limpias: FilaSocio[] = filas.map((f, i) => ({
    id: texto(f.id, 40) || `x${i}`,
    linea: Number(f.linea) || i + 1,
    tipo: f.tipo === "USUARIO" ? "USUARIO" : "SOCIO",
    nombre: texto(f.nombre, 200),
    rut: texto(f.rut, 20),
    telefono: texto(f.telefono, 30),
    direccion: texto(f.direccion, 200),
    numeroCliente: texto(f.numeroCliente, 30),
    uso: f.uso === "COMERCIAL" || f.uso === "RESIDENCIAL" ? f.uso : "",
  }));

  const existentes = await existentesDe(apr.id);
  const veredictos = validarFilas(limpias, existentes);

  const mala = veredictos.findIndex((v) => v.errores.length > 0);
  if (mala >= 0) {
    return {
      ok: false,
      error: `Fila ${limpias[mala].linea}: ${veredictos[mala].errores[0]}.`,
    };
  }

  const aCrear: (typeof socios.$inferInsert)[] = [];
  const aActualizar: { id: string; datos: Partial<typeof socios.$inferInsert> }[] = [];

  limpias.forEach((f, i) => {
    const rut = f.rut ? normalizarRut(f.rut) : null;
    // Reimportar no borra lo que ya había: una celda vacía no pisa el dato.
    const opcionales = {
      ...(f.telefono ? { telefono: normalizarTelefono(f.telefono) } : {}),
      ...(f.direccion ? { direccion: f.direccion } : {}),
      ...(f.numeroCliente ? { numeroCliente: f.numeroCliente } : {}),
      // Sin columna de uso, un socio nuevo parte residencial y uno existente conserva el suyo.
      ...(f.uso ? { uso: f.uso } : {}),
    };

    const v = veredictos[i];
    if (v.accion === "actualizar" && v.existenteId) {
      aActualizar.push({
        id: v.existenteId,
        datos: {
          nombre: f.nombre,
          tipo: f.tipo,
          // Si estaba desactivado y vuelve a aparecer en la lista, se reactiva.
          activo: true,
          ...(rut ? { rut } : {}),
          ...opcionales,
        },
      });
    } else {
      aCrear.push({ nombre: f.nombre, tipo: f.tipo, rut, ...opcionales, aprId: apr.id });
    }
  });

  // Cuentas del sistema que no están entre las filas a cargar (fallecidos, sin
  // agua, números que ya no existen). Solo se desactivan si se pide: no se borra
  // nada, así conservan su historial y se pueden reactivar.
  const tocados = new Set(
    veredictos.flatMap((v) => (v.existenteId ? [v.existenteId] : []))
  );
  const ausentes = opciones.desactivarAusentes
    ? existentes.filter((e) => e.activo && !tocados.has(e.id)).map((e) => e.id)
    : [];

  try {
    // Todo o nada: si algo falla a mitad, no queda el padrón a medio cargar.
    await db.transaction(async (tx) => {
      if (ausentes.length > 0) {
        await tx
          .update(socios)
          .set({ activo: false, updatedAt: new Date() })
          .where(and(eq(socios.aprId, apr.id), inArray(socios.id, ausentes)));
      }
      for (let i = 0; i < aCrear.length; i += 500) {
        await tx.insert(socios).values(aCrear.slice(i, i + 500));
      }
      for (const { id, datos } of aActualizar) {
        await tx
          .update(socios)
          .set({ ...datos, updatedAt: new Date() })
          .where(and(eq(socios.id, id), eq(socios.aprId, apr.id)));
      }
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "";
    if (mensaje.includes("Socio_apr_tipo_numero_key")) {
      return {
        ok: false,
        error: "Hay un N.º de arranque que ya existe en tu padrón. Vuelve a revisar el archivo.",
      };
    }
    return {
      ok: false,
      error: "No pudimos guardar los socios. No se cargó nada; inténtalo otra vez.",
    };
  }

  revalidatePath("/panel/socios");
  revalidatePath("/panel");

  return {
    ok: true,
    creados: aCrear.length,
    actualizados: aActualizar.length,
    desactivados: ausentes.length,
  };
}
