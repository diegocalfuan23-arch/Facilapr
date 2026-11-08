"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Mail, MoreHorizontal, Pencil, Phone, Plus, Search, ShoppingCart, Trash2, Truck } from "lucide-react";
import { eliminarProveedor } from "@/app/panel/compras/actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirmar } from "@/components/ui/confirmar";
import { textoCondicionPago, type CompraFila, type ProveedorFila } from "@/lib/compras-comun";
import { cn } from "@/lib/utils";

const GRIS = "text-[#5B5970]";
const clp = (n: number) => "$" + n.toLocaleString("es-CL");
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const TONOS = ["bg-[#ECE8FD] text-[#2A07A8]", "bg-[#E2F2FC] text-[#0A5F91]", "bg-[#DFF4EB] text-[#075A3C]", "bg-[#FFEEDC] text-[#8F4400]"];
const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
/** Un nombre escrito todo en minúsculas se muestra con mayúscula inicial en cada palabra. */
const titulo = (s: string) => (s === s.toLowerCase() ? s.replace(/(^|\s)\p{Ll}/gu, (c) => c.toUpperCase()) : s);

const COLUMNAS = "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_110px_minmax(0,1fr)_120px_110px_40px]";

type Filtro = "todos" | "deuda" | "sin";
type Orden = "nombre" | "total" | "deuda";
const ORDENES: { valor: Orden; texto: string }[] = [
  { valor: "nombre", texto: "Nombre A–Z" },
  { valor: "total", texto: "Más comprado" },
  { valor: "deuda", texto: "Mayor deuda" },
];

/** La lista de proveedores con lo comprado y lo que se les debe, para buscar, ordenar y actuar sobre cada uno. */
export function ProveedoresTabla({
  proveedores,
  compras,
  onNuevo,
  onEditar,
}: {
  proveedores: ProveedorFila[];
  compras: CompraFila[];
  onNuevo: () => void;
  onEditar: (p: ProveedorFila) => void;
}) {
  const { confirmar, dialogo } = useConfirmar();
  const [, iniciar] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [orden, setOrden] = useState<Orden>("nombre");

  const vigentes = compras.filter((c) => c.estado !== "ANULADA");
  const resumen = (p: ProveedorFila) => {
    const suyas = vigentes.filter((c) => c.proveedorId === p.id);
    const ultima = suyas.reduce<string | null>((u, c) => (u === null || c.fecha > u ? c.fecha : u), null);
    return {
      p,
      n: suyas.length,
      total: suyas.reduce((s, c) => s + c.total, 0),
      deuda: suyas.filter((c) => c.estado === "PENDIENTE").reduce((s, c) => s + c.total, 0),
      ultima,
    };
  };

  const todas = proveedores.map(resumen);
  const conDeuda = todas.filter((f) => f.deuda > 0).length;
  const sinCompras = todas.filter((f) => f.n === 0).length;
  const t = busqueda.trim().toLowerCase();
  const filas = todas
    .filter((f) => (filtro === "todos" || (filtro === "deuda" ? f.deuda > 0 : f.n === 0)) && (!t || `${f.p.nombre} ${f.p.rut ?? ""} ${f.p.rubro ?? ""} ${f.p.contacto ?? ""}`.toLowerCase().includes(t)))
    .sort((a, b) => (orden === "nombre" ? a.p.nombre.localeCompare(b.p.nombre) : orden === "total" ? b.total - a.total : b.deuda - a.deuda));

  async function eliminar(p: ProveedorFila) {
    if (!(await confirmar({ titulo: `¿Eliminar a «${p.nombre}»?`, descripcion: "No tiene compras registradas, así que se borra por completo.", boton: "Eliminar" }))) return;
    iniciar(async () => {
      const r = await eliminarProveedor(p.id);
      if (r.ok) toast.success("Proveedor eliminado");
      else toast.error(r.error);
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-[#F0EEF6] p-4 lg:flex-row lg:items-center lg:justify-between lg:px-5">
        <div role="tablist" aria-label="Filtrar" className="grid grid-cols-3 gap-1 rounded-lg bg-[#F4F3F9] p-1 lg:w-[380px]">
          {(
            [
              ["todos", "Todos", proveedores.length],
              ["deuda", "Con deuda", conDeuda],
              ["sin", "Sin compras", sinCompras],
            ] as const
          ).map(([k, texto, n]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={filtro === k}
              onClick={() => setFiltro(k)}
              className={cn("h-8 rounded-md text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", filtro === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}
            >
              {texto} <span className={cn("text-xs font-medium", filtro === k ? "text-[#6B46F5]" : "text-[#A19FB2]")}>{n}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1 lg:w-[260px] lg:flex-none">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Buscar proveedor" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, RUT o rubro" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
          </div>
          <Select value={orden} onValueChange={(v) => setOrden(v as Orden)}>
            <SelectTrigger aria-label="Ordenar" className="h-10 w-[136px] shrink-0 rounded-lg border-[#E4E1F0] px-3 sm:w-[150px]">
              <SelectValue>{(v) => ORDENES.find((o) => o.valor === v)?.texto ?? "Nombre A–Z"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ORDENES.map((o) => (
                <SelectItem key={o.valor} value={o.valor}>
                  {o.texto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {proveedores.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <span aria-hidden className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#ECE8FD] text-[#3A0CE3]">
            <Truck className="size-6" />
          </span>
          <p className="mt-3 font-semibold">Aún no tienes proveedores</p>
          <p className={cn("mt-1 text-sm", GRIS)}>Agrégalos para asignarles tus compras y facturas.</p>
          <Button onClick={onNuevo} className="mt-4 h-10 rounded-lg font-semibold">
            <Plus />
            Nuevo proveedor
          </Button>
        </div>
      ) : filas.length === 0 ? (
        <p className={cn("px-6 py-12 text-center text-sm", GRIS)}>Ningún proveedor coincide.</p>
      ) : (
        <>
          <div className={cn("hidden gap-4 border-b border-[#F3F1F8] bg-[#FAFAFD] px-5 py-2.5 text-xs font-medium lg:grid", COLUMNAS, GRIS)}>
            <span>Proveedor</span>
            <span>Contacto</span>
            <span>Pago</span>
            <span>Compras</span>
            <span className="text-right">Total comprado</span>
            <span className="text-right">Por pagar</span>
            <span />
          </div>
          <ul className="divide-y divide-[#F3F1F8]">
            {filas.map(({ p, n, total, deuda, ultima }, i) => (
              <li key={p.id} className={cn("relative grid grid-cols-1 items-center gap-x-4 gap-y-2 px-4 py-4 pr-14 transition-colors hover:bg-[#FBFAFF] lg:px-5 lg:pr-5", COLUMNAS)}>
                <span className="flex min-w-0 items-center gap-3">
                  <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold", TONOS[i % TONOS.length])}>
                    {iniciales(titulo(p.nombre))}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{titulo(p.nombre)}</span>
                    <span className={cn("flex flex-wrap items-center gap-x-1.5 text-[13px]", GRIS)}>
                      {p.rut ? (
                        <span className="tabular-nums">{p.rut}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#FFF3E5] px-1.5 py-px text-[11px] font-semibold text-[#8F4400]">
                          <AlertTriangle className="size-3" aria-hidden />
                          Falta RUT
                        </span>
                      )}
                      {p.rubro && <span>· {p.rubro}</span>}
                    </span>
                  </span>
                </span>
                <span className="min-w-0 pl-[52px] text-[13px] lg:pl-0">
                  {p.contacto || p.telefono || p.email ? (
                    <>
                      {p.contacto && <span className="block truncate font-medium">{p.contacto}</span>}
                      <span className={cn("flex flex-wrap items-center gap-x-3", GRIS)}>
                        {p.telefono && (
                          <a href={`tel:${p.telefono.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-[#2A07A8]">
                            <Phone className="size-3" aria-hidden />
                            {p.telefono}
                          </a>
                        )}
                        {p.email && (
                          <a href={`mailto:${p.email}`} className="inline-flex min-w-0 items-center gap-1 hover:text-[#2A07A8]">
                            <Mail className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">{p.email}</span>
                          </a>
                        )}
                      </span>
                    </>
                  ) : (
                    <button type="button" onClick={() => onEditar(p)} className="font-semibold text-[#2A07A8] hover:underline">
                      Agregar contacto
                    </button>
                  )}
                </span>
                <span className="hidden lg:block">
                  <span className="rounded-md bg-[#F4F3F9] px-2 py-1 text-xs font-semibold text-[#4A4760]">{textoCondicionPago(p.diasPago)}</span>
                </span>
                <span className="hidden text-[13px] lg:block">
                  {n > 0 && ultima ? (
                    <>
                      <span className="block font-medium">
                        {n} compra{n === 1 ? "" : "s"}
                      </span>
                      <span className={cn("block", GRIS)}>Última {fechaCorta(ultima)}</span>
                    </>
                  ) : (
                    <Link href={`/panel/compras/nueva?proveedor=${p.id}`} className="inline-flex items-center gap-1 font-semibold text-[#2A07A8] hover:underline">
                      <Plus className="size-3.5" aria-hidden />
                      Registrar compra
                    </Link>
                  )}
                </span>
                <span className="flex items-baseline gap-2 pl-[52px] lg:block lg:pl-0 lg:text-right">
                  <span className="block text-[15px] font-semibold tabular-nums">{clp(total)}</span>
                  <span className={cn("block text-xs lg:hidden", GRIS)}>
                    {n} compra{n === 1 ? "" : "s"}
                    {deuda > 0 && <span className="font-semibold text-[#B86400]"> · debes {clp(deuda)}</span>}
                  </span>
                </span>
                <span className="hidden text-right lg:block">
                  {deuda > 0 ? <span className="text-[15px] font-semibold text-[#B86400] tabular-nums">{clp(deuda)}</span> : <span className={cn("text-sm", GRIS)}>—</span>}
                </span>
                <span className="absolute top-4 right-3 lg:static">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" aria-label={`Acciones de ${p.nombre}`} className="size-9 rounded-lg">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem render={<Link href={`/panel/compras/nueva?proveedor=${p.id}`} />}>
                        <ShoppingCart />
                        Nueva compra
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEditar(p)}>
                        <Pencil />
                        Editar datos
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" disabled={n > 0 || compras.some((c) => c.proveedorId === p.id)} title={n > 0 || compras.some((c) => c.proveedorId === p.id) ? "Tiene compras registradas" : undefined} onClick={() => void eliminar(p)}>
                        <Trash2 />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              </li>
            ))}
          </ul>
          <div className={cn("flex items-center justify-between gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-3 text-sm", GRIS)}>
            <span>
              {filas.length} proveedor{filas.length === 1 ? "" : "es"}
            </span>
            <span>
              Total comprado <strong className="font-semibold text-[#15132B] tabular-nums">{clp(filas.reduce((s, f) => s + f.total, 0))}</strong>
            </span>
          </div>
        </>
      )}
      {dialogo}
    </>
  );
}
