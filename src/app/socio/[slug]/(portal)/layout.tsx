import { Droplets } from "lucide-react";
import { cuentasDelSocio, requireSocio } from "@/lib/socio-session";
import { basePortal } from "@/lib/portal-socio";
import { puede, type Plan } from "@/lib/planes";
import { SignOutSocioButton } from "@/components/socio/sign-out-button";
import { AsistenteSocio } from "@/components/socio/asistente-socio";
import { ChatComite } from "@/components/socio/chat-comite";
import { PortalNav } from "@/components/socio/portal-nav";

/**
 * Marco del portal del socio: menú a la izquierda en escritorio, encabezado y
 * pestañas arriba en el celular, y los botones de chat y asistente. Cada
 * pantalla (resumen, boletas, pagos) solo pone su contenido.
 */
export default async function PortalSocioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { socio } = await requireSocio(slug);
  const base = await basePortal(slug);
  const cuentas = await cuentasDelSocio(socio);

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Droplets className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold">{socio.apr.nombre}</div>
            <div className="text-[0.78rem] text-muted-foreground">Portal del socio</div>
          </div>
        </div>

        <PortalNav base={base} />

        <div className="mt-auto flex flex-col gap-3 border-t border-border p-4">
          <div className="min-w-0">
            <div className="truncate text-[0.9rem] font-medium">{socio.nombre}</div>
            {cuentas.length > 1 && (
              <div className="text-[0.78rem] text-muted-foreground">
                {cuentas.length} arranques
              </div>
            )}
          </div>
          <SignOutSocioButton base={base} />
        </div>
      </aside>

      <header className="border-b border-border lg:hidden">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-6 py-4">
          <div>
            <div className="font-semibold">{socio.nombre}</div>
            <div className="text-[0.82rem] text-muted-foreground">{socio.apr.nombre}</div>
          </div>
          <SignOutSocioButton base={base} />
        </div>
        <PortalNav base={base} horizontal />
      </header>

      <main className="mx-auto max-w-[720px] px-6 py-8 pb-40 lg:max-w-[840px] lg:py-12">
        {children}
      </main>

      <AsistenteSocio nombreApr={socio.apr.nombre} slug={slug} />
      {puede(socio.apr.plan as Plan, "chat") && (
        <ChatComite socioId={socio.id} slug={slug} nombreApr={socio.apr.nombre} />
      )}
    </div>
  );
}
