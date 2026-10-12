"use client";

import { toast } from "sonner";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  FilterX,
  KeyRound,
  Loader2,
  MapPinOff,
  MessageCircle,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  Upload,
  Home,
  Store,
  UserCheck,
  UserRound,
  UserX,
  Users,
} from "lucide-react";
import {
  alternarActivo,
  desactivarSocios,
  cambiarUsoSocios,
  eliminarSocio,
  eliminarSociosSinMovimientos,
} from "@/app/panel/socios/actions";
import { SocioDialog, type SocioEditable } from "./socio-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ImportarSociosDialog } from "@/components/panel/importar-socios-dialog";
import { RestablecerClaveDialog } from "@/components/panel/restablecer-clave-dialog";
import { InvitarPortalDialog } from "@/components/panel/invitar-portal-dialog";
import {
  enlaceWhatsApp,
  mensajeInvitacionPortal,
  telefonoValidoParaWhatsApp,
} from "@/lib/whatsapp";
import { formatearRut, formatearTelefono, iniciales } from "@/lib/formato";

export type SocioFila = SocioEditable & {
  activo: boolean;
  conCuenta: boolean;
  /** El servicio de este arranque está cortado por morosidad. */
  cortado: boolean;
  /** Enlace personal para invitarlo al portal; null si no se puede. */
  invitacionUrl: string | null;
};

type Pestana = "todos" | "activos" | "inactivos";
type Columna = "nombre" | "rut" | "telefono";

const POR_PAGINA = 12;

/**
 * Avatares apilados: muestra hasta 3 socios reales de los que cuenta la
 * métrica, para que la cifra tenga cara y no sea un número abstracto.
 */
function AvataresApilados({ nombres }: { nombres: string[] }) {
  if (nombres.length === 0) return null;

  return (
    <div className="flex -space-x-2">
      {nombres.slice(0, 3).map((nombre) => (
        <span
          key={nombre}
          title={nombre}
          className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[0.65rem] font-semibold text-muted-foreground"
        >
          {iniciales(nombre)}
        </span>
      ))}
    </div>
  );
}

/** Tarjeta de métrica: ícono en recuadro, etiqueta, cifra y avatares. */
function TarjetaResumen({
  icono,
  color,
  colorValor,
  etiqueta,
  valor,
  nombres,
}: {
  icono: React.ReactNode;
  color: string;
  colorValor: string;
  etiqueta: string;
  valor: number;
  nombres: string[];
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-4">
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-lg [&_svg]:size-4.5",
            color
          )}
        >
          {icono}
        </span>
        <MoreVertical className="size-4 text-muted-foreground/60" />
      </div>

      <div className="mt-4 text-[0.87rem] text-muted-foreground">{etiqueta}</div>

      <div className="mt-1 flex items-end justify-between gap-2">
        <span
          className={cn(
            "text-[1.25rem] leading-none font-semibold tabular-nums sm:text-[1.6rem]",
            colorValor
          )}
        >
          {valor}
        </span>
        <span className="hidden sm:block">
          <AvataresApilados nombres={nombres} />
        </span>
      </div>
    </div>
  );
}

/** Encabezado de columna ordenable. */
function ColumnaOrdenable({
  children,
  columna,
  activa,
  onOrdenar,
}: {
  children: React.ReactNode;
  columna: Columna;
  activa: boolean;
  onOrdenar: (c: Columna) => void;
}) {
  return (
    <TableHead className="h-11 px-4">
      <button
        type="button"
        onClick={() => onOrdenar(columna)}
        className={cn(
          "flex items-center gap-1.5 text-[0.87rem] font-medium transition-colors hover:text-foreground",
          activa ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {children}
        <ChevronsUpDown className="size-3.5" />
      </button>
    </TableHead>
  );
}

export function SociosTabla({
  socios,
  comite,
  urlSolicitud,
}: {
  socios: SocioFila[];
  comite: { nombre: string; slug: string | null };
  urlSolicitud: string | null;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [pestana, setPestana] = useState<Pestana>("todos");
  const [orden, setOrden] = useState<{ columna: Columna; asc: boolean }>({
    columna: "nombre",
    asc: true,
  });
  const [pagina, setPagina] = useState(1);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [accionMasiva, setAccionMasiva] = useState<"desactivar" | "eliminar" | null>(null);
  const [soloConTelefono, setSoloConTelefono] = useState(false);
  const [soloSinDireccion, setSoloSinDireccion] = useState(false);
  const [soloSinNumero, setSoloSinNumero] = useState(false);
  const [tipo, setTipo] = useState<"todos" | "SOCIO" | "USUARIO">("todos");
  const [uso, setUso] = useState<"todos" | "RESIDENCIAL" | "COMERCIAL">("todos");
  const [importando, setImportando] = useState(false);
  const [invitando, setInvitando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<SocioFila | null>(null);
  const [porEliminar, setPorEliminar] = useState<SocioFila | null>(null);
  const [restableciendo, setRestableciendo] = useState<SocioFila | null>(null);
  const [pendiente, startTransition] = useTransition();

  const listaActivos = socios.filter((s) => s.activo);
  const listaInactivos = socios.filter((s) => !s.activo);
  const listaConTelefono = socios.filter((s) => s.telefono);
  const activos = listaActivos.length;
  const inactivos = listaInactivos.length;
  const conTelefono = listaConTelefono.length;
  /** La dirección es opcional y suele faltar: es la ficha incompleta. */
  const listaSinDireccion = socios.filter((s) => !s.direccion);

  const nSocios = socios.filter((s) => s.tipo === "SOCIO").length;
  const nUsuarios = socios.length - nSocios;
  const nComerciales = socios.filter((s) => s.uso === "COMERCIAL").length;

  const filtrosActivos =
    Number(soloConTelefono) +
    Number(soloSinDireccion) +
    Number(soloSinNumero) +
    Number(tipo !== "todos") +
    Number(uso !== "todos");

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    const base = socios.filter((socio) => {
      if (pestana === "activos" && !socio.activo) return false;
      if (pestana === "inactivos" && socio.activo) return false;

      if (soloConTelefono && !socio.telefono) return false;
      if (soloSinDireccion && socio.direccion) return false;
      if (soloSinNumero && socio.numeroCliente) return false;
      if (tipo !== "todos" && socio.tipo !== tipo) return false;
      if (uso !== "todos" && socio.uso !== uso) return false;

      if (!termino) return true;

      return [
        socio.nombre,
        socio.rut ?? "",
        socio.telefono ?? "",
        socio.numeroCliente ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(termino);
    });

    return [...base].sort((a, b) => {
      const cmp = (a[orden.columna] ?? "").localeCompare(
        b[orden.columna] ?? "",
        "es",
        { numeric: true }
      );
      return orden.asc ? cmp : -cmp;
    });
  }, [
    socios,
    uso,
    busqueda,
    pestana,
    orden,
    soloConTelefono,
    soloSinDireccion,
    soloSinNumero,
    tipo,
  ]);

  /** Exporta lo que está filtrado, no todo: es lo que el usuario está viendo. */
  function exportarCsv() {
    const escapar = (v: string) =>
      /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

    const filas = [
      ["nombre", "rut", "tipo", "uso", "telefono", "direccion", "numeroCliente", "activo"],
      ...filtrados.map((s) => [
        s.nombre,
        s.rut ?? "",
        s.tipo === "USUARIO" ? "usuario" : "socio",
        s.uso === "COMERCIAL" ? "comercial" : "residencial",
        s.telefono ?? "",
        s.direccion ?? "",
        s.numeroCliente ?? "",
        s.activo ? "si" : "no",
      ]),
    ];

    // El BOM hace que Excel en español abra los acentos correctamente.
    const csv = "﻿" + filas.map((f) => f.map(escapar).join(";")).join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );

    const a = document.createElement("a");
    a.href = url;
    a.download = `socios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Si un filtro deja la página actual fuera de rango, volvemos a la primera.
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA
  );

  /** Las acciones de un socio: el mismo menú en la tabla (escritorio) y en las tarjetas (celular). */
  const menuAcciones = (socio: SocioFila) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Acciones para ${socio.nombre}`}
              >
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditando(socio)}>
              <Pencil />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                startTransition(async () => {
                  await alternarActivo(socio.id, !socio.activo);
                  toast.success(
                    socio.activo
                      ? `${socio.nombre} quedó inactivo`
                      : `${socio.nombre} quedó activo`
                  );
                })
              }
            >
              {socio.activo ? <UserX /> : <UserCheck />}
              {socio.activo
                ? "Marcar inactivo"
                : "Marcar activo"}
            </DropdownMenuItem>
            {!socio.conCuenta && (
              <DropdownMenuItem
                disabled={
                  !socio.invitacionUrl ||
                  !telefonoValidoParaWhatsApp(socio.telefono)
                }
                onClick={() => {
                  if (!socio.invitacionUrl || !socio.telefono) return;
                  window.open(
                    enlaceWhatsApp(
                      socio.telefono,
                      mensajeInvitacionPortal(
                        comite.nombre,
                        socio.nombre,
                        socio.invitacionUrl
                      )
                    ),
                    "_blank",
                    "noopener"
                  );
                }}
              >
                <Send />
                {!comite.slug
                  ? "Define tu enlace para invitar"
                  : !telefonoValidoParaWhatsApp(socio.telefono)
                    ? "Sin teléfono: no se puede invitar"
                    : "Invitar al portal"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={!socio.conCuenta}
              onClick={() => setRestableciendo(socio)}
            >
              <KeyRound />
              {socio.conCuenta
                ? "Restablecer clave"
                : "Sin cuenta en el portal"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setPorEliminar(socio)}
            >
              <Trash2 />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
  );

  const todasMarcadas =
    visibles.length > 0 && visibles.every((s) => seleccion.has(s.id));

  function alternarOrden(columna: Columna) {
    setOrden((prev) =>
      prev.columna === columna
        ? { columna, asc: !prev.asc }
        : { columna, asc: true }
    );
  }

  function alternarSeleccion(id: string) {
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function alternarTodas() {
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (todasMarcadas) visibles.forEach((s) => siguiente.delete(s.id));
      else visibles.forEach((s) => siguiente.add(s.id));
      return siguiente;
    });
  }

  /** Cualquier cambio de filtro reinicia la paginación. */
  function cambiarFiltro(fn: () => void) {
    fn();
    setPagina(1);
  }

  const pestanas: { id: Pestana; label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "activos", label: "Activos" },
    { id: "inactivos", label: "Inactivos" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Socios</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" data-tour="socios-invitar" onClick={() => setInvitando(true)}>
            <Send />
            Invitar al portal
          </Button>
          <Button variant="outline" data-tour="socios-importar" onClick={() => setImportando(true)}>
            <Upload />
            Importar
          </Button>
          <Button data-tour="socios-nuevo" onClick={() => setCreando(true)}>
            <Plus />
            Nuevo socio
          </Button>
        </div>
      </div>

      <div data-tour="socios-kpis" className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <TarjetaResumen
          icono={<Users />}
          color="bg-primary/10 text-primary"
          colorValor="text-primary"
          etiqueta="Total de socios"
          valor={socios.length}
          nombres={socios.map((s) => s.nombre)}
        />
        <TarjetaResumen
          icono={<UserCheck />}
          color="bg-forest/10 text-forest"
          colorValor="text-forest"
          etiqueta="Socios activos"
          valor={activos}
          nombres={listaActivos.map((s) => s.nombre)}
        />
        <TarjetaResumen
          icono={<MessageCircle />}
          color="bg-tertiary/15 text-tertiary"
          colorValor="text-tertiary-texto"
          etiqueta="Con teléfono"
          valor={conTelefono}
          nombres={listaConTelefono.map((s) => s.nombre)}
        />
        <TarjetaResumen
          icono={<MapPinOff />}
          color="bg-secondary/10 text-secondary"
          colorValor="text-secondary"
          etiqueta="Sin dirección"
          valor={listaSinDireccion.length}
          nombres={listaSinDireccion.map((s) => s.nombre)}
        />
      </div>

      {socios.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted">
            <UserRound className="size-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 text-[1rem] font-semibold">
            Carga a tus socios
          </h2>
          <p className="mt-2 max-w-[50ch] text-[0.92rem] leading-relaxed text-muted-foreground">
            Sube tu padrón en Excel, CSV o PDF y lo reviso contigo antes de
            cargarlo, o agrégalos uno por uno. El panel de socios solo deja
            entrar a quienes estén registrados aquí, identificándolos por su RUT.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => setImportando(true)}>
              <Upload />
              Importar desde archivo
            </Button>
            <Button variant="outline" onClick={() => setCreando(true)}>
              <Plus />
              Nuevo socio
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {/* Pestañas: filtran por estado sin sacar al usuario de la página. */}
          <div className="flex gap-4 overflow-x-auto overflow-y-hidden border-b border-border/60 px-3 sm:gap-6 sm:px-5">
            {pestanas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => cambiarFiltro(() => setPestana(p.id))}
                className={cn(
                  "-mb-px shrink-0 border-b-2 py-3.5 text-[0.82rem] font-medium transition-colors sm:text-[0.9rem]",
                  pestana === p.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
                {p.id !== "todos" && (
                  <span className="ml-1.5 tabular-nums opacity-70">
                    {p.id === "activos" ? activos : inactivos}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-5">
            {/* El buscador no necesita todo el ancho: deja sitio a la derecha
                para importar y filtrar, que es donde el ojo los busca. */}
            <div data-tour="socios-buscar" className="relative w-full max-w-md min-w-52 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPagina(1);
                }}
                placeholder="Buscar por nombre, RUT o teléfono…"
                aria-label="Buscar socios"
                className="h-10 border-transparent bg-muted/60 pl-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" className="h-10" data-tour="socios-exportar">
                      <ArrowUpDown />
                      Importar / Exportar
                      <ChevronDown />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setImportando(true)}>
                    <Upload />
                    Importar desde archivo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportarCsv}>
                    <Download />
                    Exportar a CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" className="h-10" data-tour="socios-filtros">
                      <SlidersHorizontal />
                      Filtros
                      {filtrosActivos > 0 && (
                        <span className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[0.7rem] font-semibold text-primary-foreground tabular-nums">
                          {filtrosActivos}
                        </span>
                      )}
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                  <DropdownMenuLabel>Tipo</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={tipo}
                    onValueChange={(v) =>
                      cambiarFiltro(() =>
                        setTipo(v as "todos" | "SOCIO" | "USUARIO")
                      )
                    }
                  >
                    <DropdownMenuRadioItem value="todos">
                      Todos ({socios.length})
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="SOCIO">
                      Socios ({nSocios})
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="USUARIO">
                      Usuarios ({nUsuarios})
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                  <DropdownMenuLabel>Uso del agua</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={uso}
                    onValueChange={(v) =>
                      cambiarFiltro(() => setUso(v as "todos" | "RESIDENCIAL" | "COMERCIAL"))
                    }
                  >
                    <DropdownMenuRadioItem value="todos">Todos</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="RESIDENCIAL">
                      Residencial ({socios.length - nComerciales})
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="COMERCIAL">
                      Comercial ({nComerciales})
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                  <DropdownMenuLabel>Mostrar solo</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={soloConTelefono}
                    onCheckedChange={(v) =>
                      cambiarFiltro(() => setSoloConTelefono(Boolean(v)))
                    }
                  >
                    Con teléfono registrado
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={soloSinDireccion}
                    onCheckedChange={(v) =>
                      cambiarFiltro(() => setSoloSinDireccion(Boolean(v)))
                    }
                  >
                    Sin dirección
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={soloSinNumero}
                    onCheckedChange={(v) =>
                      cambiarFiltro(() => setSoloSinNumero(Boolean(v)))
                    }
                  >
                    Sin número de cliente
                  </DropdownMenuCheckboxItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={filtrosActivos === 0}
                    onClick={() =>
                      cambiarFiltro(() => {
                        setSoloConTelefono(false);
                        setSoloSinDireccion(false);
                        setSoloSinNumero(false);
                        setTipo("todos");
                        setUso("todos");
                      })
                    }
                  >
                    <FilterX />
                    Limpiar filtros
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {seleccion.size > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border/60 bg-primary/5 px-5 py-2.5 text-[0.88rem]">
              <span>
                <strong className="tabular-nums">{seleccion.size}</strong>{" "}
                {seleccion.size === 1 ? "seleccionado" : "seleccionados"}
              </span>
              {seleccion.size < filtrados.length && (
                <button
                  type="button"
                  onClick={() => setSeleccion(new Set(filtrados.map((x) => x.id)))}
                  className="font-medium text-primary hover:underline"
                >
                  Seleccionar los {filtrados.length}
                </button>
              )}
              <span className="ml-auto flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendiente}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await cambiarUsoSocios([...seleccion], "COMERCIAL");
                      if (r.ok) toast.success("Marcados como comerciales");
                      else toast.error(r.error);
                    })
                  }
                >
                  <Store />
                  Comercial
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendiente}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await cambiarUsoSocios([...seleccion], "RESIDENCIAL");
                      if (r.ok) toast.success("Marcados como residenciales");
                      else toast.error(r.error);
                    })
                  }
                >
                  <Home />
                  Residencial
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAccionMasiva("desactivar")}>
                  <UserX />
                  Desactivar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSeleccion(new Set())}>
                  Quitar selección
                </Button>
              </span>
            </div>
          )}

          {/* TableHeader fuerza [&_tr]:border-b y TableRow trae el suyo: las
              dos se apilan en la misma fila y se ven como una línea gruesa.
              Un solo borde suave, declarado aquí, gana a ambas. */}
          <div data-tour="socios-tabla" className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-b-border/40 hover:bg-transparent">
                  <TableHead className="h-11 w-11 pl-5">
                    <Checkbox
                      checked={todasMarcadas}
                      onCheckedChange={alternarTodas}
                      aria-label="Seleccionar todos los socios de esta página"
                    />
                  </TableHead>
                  <ColumnaOrdenable
                    columna="nombre"
                    activa={orden.columna === "nombre"}
                    onOrdenar={alternarOrden}
                  >
                    Socio
                  </ColumnaOrdenable>
                  <ColumnaOrdenable
                    columna="rut"
                    activa={orden.columna === "rut"}
                    onOrdenar={alternarOrden}
                  >
                    RUT
                  </ColumnaOrdenable>
                  <TableHead className="h-11 px-4 text-[0.87rem] font-medium text-muted-foreground">
                    Estado
                  </TableHead>
                  <ColumnaOrdenable
                    columna="telefono"
                    activa={orden.columna === "telefono"}
                    onOrdenar={alternarOrden}
                  >
                    Teléfono
                  </ColumnaOrdenable>
                  <TableHead className="h-11 px-4 text-[0.87rem] font-medium text-muted-foreground">
                    Dirección
                  </TableHead>
                  <TableHead className="h-11 w-12 pr-5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-[0.92rem] text-muted-foreground"
                    >
                      {busqueda
                        ? `Ningún socio coincide con «${busqueda}».`
                        : "No hay socios en esta pestaña."}
                    </TableCell>
                  </TableRow>
                ) : (
                  visibles.map((socio) => (
                    <TableRow
                      key={socio.id}
                      data-state={seleccion.has(socio.id) ? "selected" : undefined}
                    >
                      <TableCell className="w-11 py-3.5 pl-5">
                        <Checkbox
                          checked={seleccion.has(socio.id)}
                          onCheckedChange={() => alternarSeleccion(socio.id)}
                          aria-label={`Seleccionar a ${socio.nombre}`}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.72rem] font-semibold text-primary">
                            {iniciales(socio.nombre)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {socio.nombre}
                            </div>
                            {(socio.numeroCliente || socio.tipo === "USUARIO" || socio.uso === "COMERCIAL") && (
                              <div className="text-[0.78rem] tabular-nums text-muted-foreground">
                                {[
                                  socio.tipo === "USUARIO" ? "Usuario" : null,
                                  socio.uso === "COMERCIAL" ? "Comercial" : null,
                                  socio.numeroCliente ? `N.º ${socio.numeroCliente}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 tabular-nums text-muted-foreground">
                        {formatearRut(socio.rut)}
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.78rem] font-medium",
                            socio.cortado
                              ? "bg-destructive/10 text-destructive"
                              : socio.activo
                                ? "bg-forest/10 text-forest"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          {socio.activo ? (
                            <UserCheck className="size-3.5" />
                          ) : (
                            <UserX className="size-3.5" />
                          )}
                          {socio.cortado ? "Cortado" : socio.activo ? "Activo" : "Inactivo"}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 tabular-nums text-muted-foreground">
                        {socio.telefono ? formatearTelefono(socio.telefono) : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-muted-foreground">
                        {socio.direccion ?? "—"}
                      </TableCell>
                      <TableCell className="w-12 py-3.5 pr-5">
                        {menuAcciones(socio)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden">
            {visibles.length === 0 ? (
              <p className="border-t border-border/60 px-4 py-12 text-center text-[0.92rem] text-muted-foreground">
                {busqueda
                  ? `Ningún socio coincide con «${busqueda}».`
                  : "No hay socios en esta pestaña."}
              </p>
            ) : (
              <ul className="divide-y divide-border/60 border-t border-border/60">
                {visibles.map((socio) => (
                  <li
                    key={socio.id}
                    data-state={seleccion.has(socio.id) ? "selected" : undefined}
                    className="flex items-start gap-3 px-4 py-4 data-[state=selected]:bg-muted/50"
                  >
                    <Checkbox
                      className="mt-2.5"
                      checked={seleccion.has(socio.id)}
                      onCheckedChange={() => alternarSeleccion(socio.id)}
                      aria-label={`Seleccionar a ${socio.nombre}`}
                    />
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.72rem] font-semibold text-primary">
                      {iniciales(socio.nombre)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{socio.nombre}</div>
                          <div className="truncate text-[0.78rem] tabular-nums text-muted-foreground">
                            {[
                              socio.rut ? formatearRut(socio.rut) : null,
                              socio.tipo === "USUARIO" ? "Usuario" : null,
                              socio.uso === "COMERCIAL" ? "Comercial" : null,
                              socio.numeroCliente ? `N.º ${socio.numeroCliente}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Sin RUT"}
                          </div>
                        </div>
                        {menuAcciones(socio)}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.8rem] text-muted-foreground">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.76rem] font-medium",
                            socio.cortado
                              ? "bg-destructive/10 text-destructive"
                              : socio.activo
                                ? "bg-forest/10 text-forest"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          {socio.activo ? (
                            <UserCheck className="size-3.5" />
                          ) : (
                            <UserX className="size-3.5" />
                          )}
                          {socio.cortado ? "Cortado" : socio.activo ? "Activo" : "Inactivo"}
                        </span>
                        {socio.telefono && (
                          <span className="tabular-nums">
                            {formatearTelefono(socio.telefono)}
                          </span>
                        )}
                      </div>
                      {socio.direccion && (
                        <div className="mt-1 truncate text-[0.8rem] text-muted-foreground">
                          {socio.direccion}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <p className="text-[0.87rem] text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {filtrados.length}
              </span>{" "}
              {filtrados.length === 1 ? "resultado" : "resultados"}
              {seleccion.size > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-foreground tabular-nums">
                    {seleccion.size}
                  </span>{" "}
                  {seleccion.size === 1 ? "seleccionado" : "seleccionados"}
                </>
              )}
            </p>

            <div className="flex items-center gap-1 text-[0.87rem] text-muted-foreground">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={paginaActual === 1}
                onClick={() => setPagina(paginaActual - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft />
              </Button>
              <span className="rounded-md bg-muted px-2.5 py-1 font-medium text-foreground tabular-nums">
                {paginaActual}
              </span>
              <span className="px-1">de</span>
              <span className="tabular-nums">{totalPaginas}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPagina(paginaActual + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      )}

      <AccionMasivaDialog
        accion={accionMasiva}
        cantidad={seleccion.size}
        onCerrar={() => setAccionMasiva(null)}
        onHecho={() => {
          setAccionMasiva(null);
          setSeleccion(new Set());
        }}
        ids={[...seleccion]}
      />

      <ImportarSociosDialog
        abierto={importando}
        onAbiertoChange={setImportando}
      />

      <InvitarPortalDialog
        abierto={invitando}
        onAbiertoChange={setInvitando}
        socios={socios}
        comite={comite}
        urlSolicitud={urlSolicitud}
      />

      <SocioDialog abierto={creando} onAbiertoChange={setCreando} />

      {editando && (
        <SocioDialog
          abierto
          onAbiertoChange={(v) => !v && setEditando(null)}
          socio={editando}
        />
      )}

      {restableciendo && (
        <RestablecerClaveDialog
          comite={comite}
          socio={restableciendo}
          onCerrar={() => setRestableciendo(null)}
        />
      )}

      <Dialog
        open={Boolean(porEliminar)}
        onOpenChange={(v) => !v && setPorEliminar(null)}
      >
        <DialogContent className="sm:max-w-100">
          <DialogHeader>
            <DialogTitle>Eliminar a {porEliminar?.nombre}</DialogTitle>
            <DialogDescription>
              Se borrarán también sus boletas y el historial de conversaciones.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPorEliminar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pendiente}
              onClick={() =>
                startTransition(async () => {
                  if (porEliminar) {
                    await eliminarSocio(porEliminar.id);
                    toast.success(`${porEliminar.nombre} fue eliminado`);
                  }
                  setPorEliminar(null);
                })
              }
            >
              {pendiente ? "Eliminando…" : "Eliminar socio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Desactivar o eliminar varios arranques a la vez. Eliminar es deliberadamente
 * conservador: solo borra los que no tienen lecturas ni boletas ni cuenta de
 * portal, y avisa cuántos se saltó (para esos, Desactivar).
 */
function AccionMasivaDialog({
  accion,
  cantidad,
  ids,
  onCerrar,
  onHecho,
}: {
  accion: "desactivar" | "eliminar" | null;
  cantidad: number;
  ids: string[];
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [trabajando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ hechos: number; omitidos: number } | null>(null);

  const eliminar = accion === "eliminar";

  function cerrar() {
    const hubo = resultado !== null;
    setError(null);
    setResultado(null);
    if (hubo) onHecho();
    else onCerrar();
  }

  function confirmar() {
    setError(null);
    iniciar(async () => {
      const r = eliminar
        ? await eliminarSociosSinMovimientos(ids)
        : await desactivarSocios(ids);
      if (r.ok) {
        setResultado({ hechos: r.hechos, omitidos: r.omitidos });
        toast.success(
          `${r.hechos} ${r.hechos === 1 ? "arranque" : "arranques"} ${eliminar ? "eliminados" : "desactivados"}`
        );
      } else {
        setError(r.error);
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open={accion !== null} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="sm:max-w-110">
        <DialogHeader>
          <DialogTitle>
            {eliminar ? "Eliminar" : "Desactivar"} {cantidad}{" "}
            {cantidad === 1 ? "arranque" : "arranques"}
          </DialogTitle>
          <DialogDescription>
            {resultado
              ? "Listo."
              : eliminar
                ? "Solo se eliminan los que no tienen lecturas ni boletas ni cuenta de portal."
                : "Dejan de aparecer para cargar lecturas y boletas, pero conservan su historial."}
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <p className="text-[0.9rem] leading-relaxed">
            <strong>{resultado.hechos}</strong>{" "}
            {eliminar
              ? resultado.hechos === 1 ? "eliminado" : "eliminados"
              : resultado.hechos === 1 ? "desactivado" : "desactivados"}
            {resultado.omitidos > 0 &&
              `, ${resultado.omitidos} se ${resultado.omitidos === 1 ? "saltó" : "saltaron"}${
                eliminar ? " por tener historial: para esos usa Desactivar" : ""
              }`}
            .
          </p>
        ) : (
          <p className="text-[0.9rem] leading-relaxed">
            {eliminar
              ? "Los eliminados no se pueden recuperar."
              : "Puedes volver a activarlos cuando quieras."}
          </p>
        )}
        {error && <p className="text-[0.85rem] text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={cerrar} disabled={trabajando}>
            {resultado ? "Cerrar" : "Cancelar"}
          </Button>
          {!resultado && (
            <Button
              variant={eliminar ? "destructive" : "default"}
              onClick={confirmar}
              disabled={trabajando}
            >
              {trabajando && <Loader2 className="animate-spin" />}
              {eliminar ? "Eliminar" : "Desactivar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
