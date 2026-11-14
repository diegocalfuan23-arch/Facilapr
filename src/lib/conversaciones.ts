import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ConversacionResumen } from "@/lib/conversaciones-comun";

/** Las conversaciones del comité: primero las que esperan a una persona; después, las más recientes. */
export async function listarConversaciones(aprId: string): Promise<ConversacionResumen[]> {
  const { rows: filas } = await db.execute<{
    socioId: string;
    nombre: string;
    ultimoMensaje: string;
    ultimaFecha: string;
    sinLeer: number;
    necesitaHumano: boolean;
    rut: string | null;
    numeroCliente: string | null;
    tipo: "SOCIO" | "USUARIO";
    telefono: string | null;
    deuda: number;
    iaPausada: boolean;
  }>(sql`
    select distinct on (s.id)
      s.id as "socioId",
      s.nombre,
      s.rut,
      s."numeroCliente",
      s.tipo,
      s.telefono,
      s."iaPausada" as "iaPausada",
      -- Lo que debe la persona: todas sus boletas impagas (una persona con varios
      -- arranques comparte el RUT), sin contar las anuladas.
      (
        select coalesce(sum(b."montoTotal" - b."montoPagado"), 0)::int
        from "Boleta" b
        join "Socio" s2 on s2.id = b."socioId"
        where s2."aprId" = s."aprId"
          and (s2.id = s.id or (s.rut is not null and s2.rut = s.rut))
          and b.estado <> 'ANULADA'
          and b."montoPagado" < b."montoTotal"
      ) as deuda,
      m.contenido as "ultimoMensaje",
      m."createdAt" as "ultimaFecha",
      (
        select count(*)::int from "MensajeSocio" m2
        where m2."socioId" = s.id
          and m2.remitente = 'SOCIO'
          and m2."leidoPorDirectiva" = false
      ) as "sinLeer",
      -- La IA marcó que hace falta una persona y la directiva aún no ha respondido después.
      exists (
        select 1 from "MensajeSocio" x
        where x."socioId" = s.id
          and x."requiereHumano"
          and not exists (
            select 1 from "MensajeSocio" d
            where d."socioId" = s.id
              and d.remitente = 'DIRECTIVA'
              and d."createdAt" > x."createdAt"
          )
      ) as "necesitaHumano"
    from "Socio" s
    join "MensajeSocio" m on m."socioId" = s.id
    where s."aprId" = ${aprId}
    order by s.id, m."createdAt" desc
  `);

  // Primero las que esperan a una persona; después, las más recientes.
  filas.sort(
    (a, b) =>
      Number(b.necesitaHumano) - Number(a.necesitaHumano) ||
      +new Date(b.ultimaFecha) - +new Date(a.ultimaFecha)
  );

  return filas.map((f) => ({
    socioId: f.socioId,
    nombre: f.nombre,
    ultimoMensaje: f.ultimoMensaje,
    ultimaFecha: f.ultimaFecha ? new Date(f.ultimaFecha) : null,
    sinLeer: f.sinLeer,
    necesitaHumano: f.necesitaHumano,
    rut: f.rut,
    numeroCliente: f.numeroCliente,
    tipo: f.tipo,
    telefono: f.telefono,
    deuda: f.deuda,
    iaPausada: f.iaPausada,
  }));
}
