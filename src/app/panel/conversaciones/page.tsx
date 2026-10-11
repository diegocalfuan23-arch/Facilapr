import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/apr-session";
import { ConversacionesPanel } from "@/components/panel/conversaciones-panel";
import { puede, NOMBRE_PLAN, planMinimoPara, type Plan } from "@/lib/planes";
import { MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Conversaciones",
};

export default async function ConversacionesPage() {
  const { apr } = await requireAdmin();

  if (!puede(apr.plan as Plan, "chat")) {
    return (
      <div className="mt-8 flex w-full max-w-md flex-col items-center self-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageCircle className="size-5" />
        </span>
        <h1 className="mt-4 text-[1.05rem] font-semibold">
          Chat en tiempo real con tus socios
        </h1>
        <p className="mt-2 text-[0.92rem] leading-relaxed text-muted-foreground">
          Tus socios te escriben desde su cuenta y tú respondes aquí, al instante.
          Está disponible desde el plan {NOMBRE_PLAN[planMinimoPara("chat")]}. Tu
          plan actual es {NOMBRE_PLAN[apr.plan as Plan]}.
        </p>
        <a
          href="mailto:hola@facilapr.cl?subject=Quiero%20el%20chat%20para%20mi%20comit%C3%A9"
          className="mt-5 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[0.9rem] font-medium text-primary-foreground hover:bg-primary/90"
        >
          Quiero activarlo
        </a>
      </div>
    );
  }

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
  }>(sql`
    select distinct on (s.id)
      s.id as "socioId",
      s.nombre,
      s.rut,
      s."numeroCliente",
      s.tipo,
      s.telefono,
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
    where s."aprId" = ${apr.id}
    order by s.id, m."createdAt" desc
  `);

  // Primero las que esperan a una persona; después, las más recientes.
  filas.sort(
    (a, b) =>
      Number(b.necesitaHumano) - Number(a.necesitaHumano) ||
      +new Date(b.ultimaFecha) - +new Date(a.ultimaFecha)
  );

  return (
    <ConversacionesPanel
      conversaciones={filas.map((f) => ({
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
      }))}
    />
  );
}
