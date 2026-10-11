import { requireApr } from "@/lib/apr-session";
import { PanelSidebar } from "@/components/panel/panel-sidebar";
import { Logo } from "@/components/marca/logo";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Recorrido } from "@/components/panel/recorrido";
import { PrimerosPasosFlotante } from "@/components/panel/primeros-pasos-flotante";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, apr } = await requireApr();
  const rol = user.rol === "OPERADOR" ? "OPERADOR" : "ADMIN";
  // El técnico trabaja desde el teléfono en terreno: en pantalla chica el
  // marco se vuelve una app (encabezado compacto fijo, sin menú lateral); en
  // escritorio (md:) queda el panel de siempre.
  const esOperador = rol === "OPERADOR";

  return (
    <TooltipProvider>
      <SidebarProvider>
        <PanelSidebar apr={apr.nombre} comuna={apr.comuna} rol={rol} />
        {!esOperador && <Recorrido usuarioId={user.id} />}
        {!esOperador && <PrimerosPasosFlotante />}

        {/* El gradiente va en el contenedor, no en el área de contenido: así
            cubre también el header. Centrado en 50% 50% para que el velo quede
            al medio de la pantalla y se desvanezca hacia los bordes. */}
        <SidebarInset className="min-w-0 max-w-full overflow-x-clip bg-[radial-gradient(90%_70%_at_50%_50%,color-mix(in_oklch,var(--primary),transparent_90%),transparent_75%)]">
          <header
            className={cn(
              "flex h-14 shrink-0 items-center gap-2 px-4",
              esOperador &&
                "sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur md:static md:border-b-0 md:bg-transparent md:backdrop-blur-none"
            )}
          >
            {esOperador && (
              <div className="flex min-w-0 flex-1 items-center gap-3 md:hidden">
                <Logo className="size-8" />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[0.95rem] font-semibold">
                    {apr.nombre}
                  </div>
                  <div className="text-[0.75rem] text-muted-foreground">
                    Técnico de terreno
                  </div>
                </div>
                <SignOutButton compacto />
              </div>
            )}

            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2",
                esOperador && "hidden md:flex"
              )}
            >
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-1 h-4" />
              <span className="text-sm font-medium">{apr.nombre}</span>
              <div className="ml-auto">
                <SignOutButton />
              </div>
            </div>
          </header>

          <div
            className={cn(
              "flex w-full min-w-0 max-w-full flex-1 flex-col gap-5 p-4 pb-28 sm:p-6",
              esOperador && "p-4 pb-28 md:p-6"
            )}
          >
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
