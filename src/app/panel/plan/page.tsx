import type { Metadata } from "next";
import { requireAdmin } from "@/lib/apr-session";
import type { Plan } from "@/lib/planes";
import { MiPlan } from "@/components/panel/mi-plan";
import { vigenciaDelPlan } from "@/app/panel/plan/actions";

export const metadata: Metadata = {
  title: "Mi plan",
};

const AVISOS = {
  ok: { clase: "border-forest/30 bg-forest/5 text-forest", texto: "¡Listo! Recibimos tu pago y tu plan quedó activo." },
  fallido: { clase: "border-destructive/30 bg-destructive/5 text-destructive", texto: "El pago no se completó. No se te cobró nada: puedes intentarlo de nuevo." },
  pendiente: { clase: "border-tertiary/40 bg-tertiary/10 text-tertiary-foreground", texto: "Tu pago está en proceso. Apenas Flow lo confirme, tu plan se activa solo." },
} as const;

/** Los planes y cuál tiene el comité. Se llega desde el menú de la tarjeta del comité. */
export default async function MiPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ pago?: string }>;
}) {
  const { apr } = await requireAdmin();
  const { pago } = await searchParams;
  const aviso = pago && pago in AVISOS ? AVISOS[pago as keyof typeof AVISOS] : null;
  const vigencia = await vigenciaDelPlan(apr.id);

  return (
    <>
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Mi plan</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
          Compara los planes, mira cuál tienes y págalo en línea.
        </p>
      </div>
      {aviso && <p className={`rounded-lg border px-4 py-3 text-[0.9rem] ${aviso.clase}`}>{aviso.texto}</p>}
      <MiPlan planActual={apr.plan as Plan} vigencia={vigencia} />
    </>
  );
}
