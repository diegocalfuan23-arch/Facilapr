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
  }>(sql`
    select distinct on (s.id)
      s.id as "socioId",
      s.nombre,
      m.contenido as "ultimoMensaje",
      m."createdAt" as "ultimaFecha",
      (
        select count(*)::int from "MensajeSocio" m2
        where m2."socioId" = s.id
          and m2.remitente = 'SOCIO'
          and m2."leidoPorDirectiva" = false
      ) as "sinLeer"
    from "Socio" s
    join "MensajeSocio" m on m."socioId" = s.id
    where s."aprId" = ${apr.id}
    order by s.id, m."createdAt" desc
  `);

  filas.sort((a, b) => +new Date(b.ultimaFecha) - +new Date(a.ultimaFecha));

  return (
    <ConversacionesPanel
      conversaciones={filas.map((f) => ({
        socioId: f.socioId,
        nombre: f.nombre,
        ultimoMensaje: f.ultimoMensaje,
        ultimaFecha: f.ultimaFecha ? new Date(f.ultimaFecha) : null,
        sinLeer: f.sinLeer,
      }))}
    />
  );
}
