import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, socios } from "@/lib/db/schema";
import { telefonoValidoParaWhatsApp } from "@/lib/whatsapp";
import type { ConversacionResumen } from "@/lib/conversaciones-comun";

/**
 * Los socios con un teléfono que sirve para WhatsApp, por nombre, con la forma de una conversación sin mensajes:
 * así se puede elegir a cualquiera para escribirle.
 */
export async function listarContactosWhatsapp(aprId: string): Promise<ConversacionResumen[]> {
  const [todos, pendientes] = await Promise.all([
    db.query.socios.findMany({
      where: eq(socios.aprId, aprId),
      columns: { id: true, nombre: true, rut: true, numeroCliente: true, tipo: true, telefono: true, iaPausada: true, activo: true },
      orderBy: [asc(socios.nombre)],
    }),
    db
      .select({ socioId: boletas.socioId, deuda: sql<number>`sum(${boletas.montoTotal} - ${boletas.montoPagado})::int` })
      .from(boletas)
      .innerJoin(socios, eq(socios.id, boletas.socioId))
      .where(and(eq(socios.aprId, aprId), ne(boletas.estado, "ANULADA"), sql`${boletas.montoPagado} < ${boletas.montoTotal}`))
      .groupBy(boletas.socioId),
  ]);

  // Una persona con varios arranques comparte el RUT: debe la suma de todos.
  const deudaDe = new Map(pendientes.map((p) => [p.socioId, p.deuda]));
  const porPersona = new Map<string, number>();
  for (const s of todos) porPersona.set(s.rut ?? s.id, (porPersona.get(s.rut ?? s.id) ?? 0) + (deudaDe.get(s.id) ?? 0));

  return todos
    .filter((s) => s.activo && telefonoValidoParaWhatsApp(s.telefono))
    .map((s) => ({
      socioId: s.id,
      nombre: s.nombre,
      ultimoMensaje: "",
      ultimaFecha: null,
      sinLeer: 0,
      necesitaHumano: false,
      rut: s.rut,
      numeroCliente: s.numeroCliente,
      tipo: s.tipo,
      telefono: s.telefono,
      deuda: porPersona.get(s.rut ?? s.id) ?? 0,
      iaPausada: s.iaPausada,
    }));
}

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
