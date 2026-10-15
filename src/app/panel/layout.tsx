import Link from "next/link";
import { ClipboardList, Droplets } from "lucide-react";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { ordenes, socios, solicitudesAcceso, solicitudesClave } from "@/lib/db/schema";
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
import { NOMBRE_PLAN, puede, type Plan } from "@/lib/planes";
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

  // Lo que espera acción: el técnico, órdenes por hacer; la directiva, solicitudes por
  // resolver y evidencias por dar de alta. Si la consulta falla, simplemente no hay número.
  const insignias: Record<string, number> = {};
  try {
    const [f] = await db
      .select({ n: count() })
      .from(ordenes)
      .where(
        and(
          eq(ordenes.aprId, apr.id),
          inArray(ordenes.estado, esOperador ? ["EN_TRAMITE"] : ["SOLICITADA", "POR_CONFIRMAR"])
        )
      );
    insignias[esOperador ? "/panel/ordenes" : "/panel/cortes"] = f?.n ?? 0;
  } catch {
    // Sin número en el menú.
  }

  // Solicitudes que esperan a la directiva: pedidos de acceso y de clave nueva.
  if (!esOperador) {
    try {
      const [acceso] = await db
        .select({ n: count() })
        .from(solicitudesAcceso)
        .innerJoin(socios, eq(solicitudesAcceso.socioId, socios.id))
        .where(and(eq(socios.aprId, apr.id), eq(solicitudesAcceso.estado, "PENDIENTE")));
      const [clave] = await db
        .select({ n: count() })
        .from(solicitudesClave)
        .where(and(eq(solicitudesClave.aprId, apr.id), eq(solicitudesClave.estado, "PENDIENTE")));
      insignias["/panel/socios/solicitudes"] = (acceso?.n ?? 0) + (clave?.n ?? 0);
    } catch {
      // Sin número en el menú.
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <PanelSidebar
          apr={apr.nombre}
          comuna={apr.comuna}
          rol={rol}
          insignias={insignias}
          plan={NOMBRE_PLAN[apr.plan as Plan]}
          usuario={{ nombre: user.name, correo: user.email }}
          chat={puede(apr.plan as Plan, "chat")}
        />
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
                <Link
                  href="/panel/lecturas"
                  aria-label="Lecturas"
                  className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                >
                  <Droplets className="size-5" />
                </Link>
                <Link
                  href="/panel/ordenes"
                  aria-label="Órdenes de terreno"
                  className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                >
                  <ClipboardList className="size-5" />
                </Link>
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
