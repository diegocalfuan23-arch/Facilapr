"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ReceiptText,
  UserCheck,
  Settings,
  Droplets,
  HardHat,
  MessageCircle,
  Smartphone,
  LifeBuoy,
  LayoutGrid,
  Headset,
} from "lucide-react";
import { Logo } from "@/components/marca/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const gestion = [
  { href: "/panel", label: "Resumen", icon: LayoutDashboard },
  { href: "/panel/socios", label: "Socios", icon: Users },
  { href: "/panel/boletas", label: "Boletas", icon: ReceiptText },
  { href: "/panel/lecturas", label: "Lecturas", icon: Droplets },
  { href: "/panel/lecturas/terreno", label: "Modo terreno", icon: Smartphone },
  { href: "/panel/tecnicos", label: "Técnicos", icon: HardHat },
];

const atencion = [
  { href: "/panel/conversaciones", label: "Conversaciones", icon: MessageCircle },
  { href: "/panel/socios/solicitudes", label: "Solicitudes", icon: UserCheck },
  // "Sitio público" está oculto por ahora: todavía no se ofrece a los comités.
  // La página sigue existiendo en /panel/sitio; para volver a mostrarla, basta
  // descomentar esta línea (y volver a importar el ícono Globe de lucide-react). Las tarifas ya no dependen de ella: están en
  // Configuración → Facturación.
  // { href: "/panel/sitio", label: "Sitio público", icon: Globe },
  { href: "/panel/configuracion", label: "Configuración", icon: Settings },
  { href: "/panel/ayuda", label: "Ayuda", icon: LifeBuoy },
];

/** Lo único que un OPERADOR puede ver: cargar lecturas, nada más. */
const soloOperador = [
  { href: "/panel/lecturas", label: "Lecturas", icon: Droplets },
];

type Enlace = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

/**
 * Marca el ítem apenas se hace clic, sin esperar a que termine la navegación.
 *
 * `usePathname()` solo cambia cuando la página nueva ya respondió, y las del
 * panel consultan la base: durante esa espera el ítem clickeado seguía
 * apagado y el anterior encendido. `useLinkStatus` expone que la navegación
 * está en curso, así que lo pintamos de inmediato.
 */
function EnlaceMenu({
  label,
  icon: Icon,
  activo,
}: Omit<Enlace, "href"> & { activo: boolean }) {
  const { pending } = useLinkStatus();

  return (
    <SidebarMenuButton
      isActive={activo || pending}
      tooltip={label}
      className="hover:bg-muted hover:text-foreground data-active:hover:bg-sidebar-accent data-active:hover:text-sidebar-accent-foreground"
    >
      <Icon />
      <span>{label}</span>
    </SidebarMenuButton>
  );
}

/**
 * El componente base usa `sidebar-accent` tanto para hover como para el ítem
 * activo. Como el activo va en índigo, dejamos el hover en un gris neutro
 * para que pasar el mouse no se confunda con estar seleccionado.
 */
function GrupoEnlaces({
  titulo,
  icono: IconoGrupo,
  enlaces,
  pathname,
}: {
  titulo: string;
  icono: typeof LayoutDashboard;
  enlaces: Enlace[];
  pathname: string;
}) {
  const { state, isMobile } = useSidebar();

  // Colapsado, el menú muestra un solo ícono por grupo (Gestión, Atención) y
  // sus enlaces salen en un menú al lado. Así la barra angosta no se llena de
  // íconos sueltos.
  if (state === "collapsed" && !isMobile) {
    const algunoActivo = enlaces.some((e) => e.href === pathname);
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      isActive={algunoActivo}
                      aria-label={titulo}
                      className="hover:bg-muted hover:text-foreground data-active:hover:bg-sidebar-accent data-active:hover:text-sidebar-accent-foreground"
                    />
                  }
                >
                  <IconoGrupo />
                  <span>{titulo}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{titulo}</DropdownMenuLabel>
                    {enlaces.map((e) => (
                      <DropdownMenuItem
                        key={e.href}
                        render={<Link href={e.href} />}
                        className={pathname === e.href ? "bg-muted font-medium" : undefined}
                      >
                        <e.icon />
                        {e.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{titulo}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {enlaces.map((enlace) => (
            <SidebarMenuItem key={enlace.href} data-tour={enlace.href}>
              {/* useLinkStatus solo funciona dentro de un <Link>. */}
              <Link href={enlace.href}>
                <EnlaceMenu {...enlace} activo={pathname === enlace.href} />
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function PanelSidebar({
  apr,
  comuna,
  rol,
  chat = false,
}: {
  apr: string;
  comuna: string;
  rol: "ADMIN" | "OPERADOR";
  /** El plan incluye el chat en tiempo real: sin él, Conversaciones no aparece. */
  chat?: boolean;
}) {
  const pathname = usePathname();
  const inicio = rol === "ADMIN" ? "/panel" : "/panel/lecturas";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Un enlace simple en vez de SidebarMenuButton: ese componente alinea
          su contenido a la izquierda y no deja centrar la marca. */}
      <SidebarHeader className="py-4">
        <Link
          href={inicio}
          aria-label="Ir al inicio"
          className="flex justify-center transition-opacity hover:opacity-80"
        >
          {/* Al colapsar el sidebar el ancho se reduce, así que el logo baja
              de tamaño para no tocar los bordes. */}
          <Logo className="size-12 group-data-[collapsible=icon]:size-8" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {rol === "ADMIN" ? (
          <>
            <GrupoEnlaces titulo="Gestión" icono={LayoutGrid} enlaces={gestion} pathname={pathname} />
            <GrupoEnlaces
              titulo="Atención"
              icono={Headset}
              enlaces={atencion.filter(
                (e) => chat || e.href !== "/panel/conversaciones"
              )}
              pathname={pathname}
            />
          </>
        ) : (
          <GrupoEnlaces titulo="Terreno" icono={Droplets} enlaces={soloOperador} pathname={pathname} />
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex flex-col gap-0.5 px-2 py-1 text-xs group-data-[collapsible=icon]:hidden">
          <span className="truncate font-medium">{apr}</span>
          <span className="truncate text-muted-foreground">{comuna}</span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
