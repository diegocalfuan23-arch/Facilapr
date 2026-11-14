import Link from "next/link";
import { Bell, Droplets } from "lucide-react";
import { and, count, inArray, max, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, ordenes } from "@/lib/db/schema";
import { cuentasDelSocio, requireSocio } from "@/lib/socio-session";
import { basePortal } from "@/lib/portal-socio";
import { puede, type Plan } from "@/lib/planes";
import { listarComunicados } from "@/lib/comunicados";
import { iniciales } from "@/lib/formato";
import { SignOutSocioButton } from "@/components/socio/sign-out-button";
import { ChatComite } from "@/components/socio/chat-comite";
import { PortalNav } from "@/components/socio/portal-nav";

/**
 * Marco del portal del socio: menú a la izquierda en escritorio; en el celular, encabezado arriba y barra de pestañas
 * abajo; y el botón del chat si el plan lo incluye. Cada pantalla (inicio, boletas, pagos) solo pone su contenido.
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
  const ids = cuentas.map((c) => c.id);

  // Lo último que cambió en sus solicitudes: el menú marca un punto si no lo ha visto.
  let novedad: string | null = null;
  try {
    const [f] = await db
      .select({ ultima: max(ordenes.updatedAt) })
      .from(ordenes)
      .where(inArray(ordenes.socioId, ids));
    novedad = f?.ultima ? f.ultima.toISOString() : null;
  } catch {
    // Sin punto de novedades.
  }

  // Cuántas boletas tiene por pagar (se marca en «Boletas») y si el comité publicó un aviso en los últimos días.
  let pendientes = 0;
  try {
    const [f] = await db
      .select({ n: count() })
      .from(boletas)
      .where(and(inArray(boletas.socioId, ids), inArray(boletas.estado, ["PENDIENTE", "VENCIDA"]), sql`${boletas.montoPagado} < ${boletas.montoTotal}`));
    pendientes = f?.n ?? 0;
  } catch {
    // Sin número.
  }
  const avisosNuevos = (await listarComunicados(socio.aprId, 1, 3)).length > 0;

  const numero = cuentas.length > 1 ? `${cuentas.length} arranques` : socio.numeroCliente ? `N° ${socio.numeroCliente}` : "Portal del socio";

  return (
    <div className="min-h-screen bg-[#EEF0FF] bg-[radial-gradient(ellipse_70%_60%_at_50%_45%,#D5D9FF_0%,#EDEEFF_50%,#FAFAFF_88%)] bg-fixed text-[#15132B] lg:pl-[248px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-[#E4E0F2] bg-white/80 px-4 py-5 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6B46F5] to-[#3A0CE3] text-white shadow-md">
            <Droplets className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] leading-tight font-semibold">{socio.apr.nombre}</p>
            <p className="text-xs text-[#5B5970]">Portal del socio</p>
          </div>
        </div>

        <PortalNav base={base} novedad={novedad} pendientes={pendientes} />

        <div className="mt-auto flex items-center gap-3 rounded-xl border border-[#EFEDF6] bg-white p-3">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#ECE8FD] text-xs font-bold text-[#2A07A8]">
            {iniciales(socio.nombre)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{socio.nombre}</p>
            <p className="text-xs text-[#5B5970]">{numero}</p>
          </div>
          <SignOutSocioButton base={base} variante="icono" />
        </div>
      </aside>

      <header className="flex items-center justify-between px-4 pt-4 lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6B46F5] to-[#3A0CE3] text-white">
            <Droplets className="size-[18px]" />
          </span>
          <span className="truncate text-[15px] font-semibold">{socio.apr.nombre}</span>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`${base}#avisos`} aria-label="Avisos del comité" className="relative flex size-10 items-center justify-center rounded-xl hover:bg-white/60">
            <Bell className="size-5" />
            {avisosNuevos ? <span aria-label="Hay avisos nuevos" className="absolute top-2.5 right-2.5 size-2 rounded-full bg-[#E5484D] ring-2 ring-[#F1F0FF]" /> : null}
          </Link>
          <SignOutSocioButton base={base} variante="icono" />
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-4 pt-5 pb-24 sm:px-8 lg:pt-10 lg:pb-10">{children}</main>

      <PortalNav base={base} variante="inferior" novedad={novedad} pendientes={pendientes} />

      {/* El portal existe en todos los planes; el chat (y la IA dentro de él) es desde el Estándar. */}
      {puede(socio.apr.plan as Plan, "chat") && <ChatComite socioId={socio.id} slug={slug} nombreApr={socio.apr.nombre} />}
    </div>
  );
}
