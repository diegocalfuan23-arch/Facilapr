"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Plus, Search } from "lucide-react";
import { asignarProveedor } from "@/app/panel/compras/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompraDetalleDialog } from "@/components/panel/compra-detalle-dialog";
import { ProveedorDialog } from "@/components/panel/proveedor-dialog";
import { ProveedoresTabla } from "@/components/panel/proveedores-tabla";
import { TEXTO_ESTADO_COMPRA, textoDocumento, type CompraFila, type ProveedorFila } from "@/lib/compras-comun";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const clp = (n: number) => "$" + n.toLocaleString("es-CL");
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";

type Filtro = "todas" | "PENDIENTE" | "PAGADA" | "ANULADA";

function Stat({ label, valor, detalle, clase = "" }: { label: string; valor: string; detalle: string; clase?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl bg-card p-4 lg:p-5", SOMBRA, clase)}>
      <p className={`text-[13px] font-medium ${GRIS}`}>{label}</p>
      <p className="mt-1 text-[24px] leading-tight font-semibold tracking-tight tabular-nums lg:text-[28px]">{valor}</p>
      <p className={`mt-0.5 text-[13px] ${GRIS}`}>{detalle}</p>
    </div>
  );
}

function EstadoTexto({ compra, vencida }: { compra: CompraFila; vencida: boolean }) {
  const clase = vencida
    ? "bg-[#FDECEC] text-[#A32020]"
    : compra.estado === "PAGADA"
      ? "bg-[#DFF4EB] text-[#075A3C]"
      : compra.estado === "ANULADA"
        ? "bg-[#F1F0F7] text-[#5B5970]"
        : "bg-[#FFEEDC] text-[#8F4400]";
  const punto = vencida ? "bg-[#D13B3B]" : compra.estado === "PAGADA" ? "bg-[#0A9B68]" : compra.estado === "ANULADA" ? "bg-[#9A98AD]" : "bg-[#E58200]";
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap", clase)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", punto)} />
      {vencida ? "Vencida" : TEXTO_ESTADO_COMPRA[compra.estado]}
    </span>
  );
}

/** El proveedor de una compra; si no tiene, se elige ahí mismo de la lista. */
function Proveedor({ compra, proveedores }: { compra: CompraFila; proveedores: ProveedorFila[] }) {
  const [pendiente, iniciar] = useTransition();
  if (compra.proveedor) return <span className="block truncate text-[15px] font-medium">{compra.proveedor}</span>;
  if (compra.estado === "ANULADA" || proveedores.length === 0) return <span className={cn("block text-[15px]", GRIS)}>Sin proveedor</span>;

  return (
    <span className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      <select
        aria-label={`Asignar proveedor a C-${compra.numero}`}
        defaultValue=""
        disabled={pendiente}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          iniciar(async () => {
            const r = await asignarProveedor(compra.id, id);
            if (r.ok) toast.success("Proveedor asignado");
            else toast.error(r.error);
          });
        }}
        className="h-9 max-w-full cursor-pointer appearance-none bg-transparent pr-5 text-[15px] font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <option value="" disabled>
          Asignar proveedor
        </option>
        {proveedores.map((p) => (
          <option key={p.id} value={p.id} className="text-[#15132B]">
            {p.nombre}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-0 size-4 text-primary" />
    </span>
  );
}

/**
 * Las compras del comité: lo que se compra a los proveedores y lo que todavía se debe. Una compra
 * por pagar es una cuenta por pagar: se ve cuánto se debe y cuáles ya vencieron.
 */
export function ComprasVista({ compras, proveedores }: { compras: CompraFila[]; proveedores: ProveedorFila[] }) {
  const [pestana, setPestana] = useState<"compras" | "proveedores">("compras");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [viendoId, setViendoId] = useState<string | null>(null);
  const [creandoProveedor, setCreandoProveedor] = useState(false);
  const [editandoProveedor, setEditandoProveedor] = useState<ProveedorFila | null>(null);
  const cerrarDetalle = useCallback(() => setViendoId(null), []);
  const cerrarProveedor = useCallback(() => {
    setCreandoProveedor(false);
    setEditandoProveedor(null);
  }, []);

  const hoy = hoyEnChile();
  const mes = hoy.slice(0, 7);
  const vigentes = compras.filter((c) => c.estado !== "ANULADA");
  const porPagar = compras.filter((c) => c.estado === "PENDIENTE");
  const totalPorPagar = porPagar.reduce((s, c) => s + c.total, 0);
  const estaVencida = (c: CompraFila) => c.estado === "PENDIENTE" && c.vencimiento !== null && c.vencimiento < hoy;
  const vencidas = porPagar.filter(estaVencida);
  const totalVencido = vencidas.reduce((s, c) => s + c.total, 0);
  const delMes = vigentes.filter((c) => c.fecha.startsWith(mes));
  const compradoEsteMes = delMes.reduce((s, c) => s + c.total, 0);
  const sinProveedor = vigentes.filter((c) => !c.proveedor).length;

  const q = busqueda.trim().toLowerCase();
  const comprasFiltradas = compras.filter((c) => {
    if (filtro !== "todas" && c.estado !== filtro) return false;
    if (!q) return true;
    return `c-${c.numero}`.includes(q) || (c.folio ?? "").toLowerCase().includes(q) || (c.proveedor ?? "").toLowerCase().includes(q);
  });
  const totalFiltrado = comprasFiltradas.reduce((t, c) => t + c.total, 0);

  const viendo = compras.find((c) => c.id === viendoId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <Stat clase="col-span-2 lg:col-span-1" label="Por pagar" valor={clp(totalPorPagar)} detalle={vencidas.length ? `${clp(totalVencido)} vencido` : "Nada vencido"} />
        <Stat label="Comprado este mes" valor={clp(compradoEsteMes)} detalle={`${delMes.length} compra${delMes.length === 1 ? "" : "s"}`} />
        <Stat label="Proveedores" valor={String(proveedores.length)} detalle={sinProveedor ? `${sinProveedor} compra${sinProveedor === 1 ? "" : "s"} sin asignar` : "Todas asignadas"} />
      </section>

      <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Vista" className="grid grid-cols-2 gap-1 rounded-lg bg-white/80 p-1 lg:w-[240px]">
          {(
            [
              ["compras", "Compras"],
              ["proveedores", "Proveedores"],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pestana === id}
              onClick={() => {
                setPestana(id);
                setBusqueda("");
              }}
              className={cn(
                "h-9 rounded-md text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                pestana === id ? "bg-white text-[#2A07A8] shadow-sm" : GRIS
              )}
            >
              {texto}
            </button>
          ))}
        </div>

        {pestana === "compras" ? (
          <div className="flex min-w-0 gap-2">
            <div className="relative min-w-0 flex-1 lg:w-[280px] lg:flex-none">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Buscar compra" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar compra" className="h-10 rounded-lg border-[#E4E1F0] bg-white pl-9 shadow-none" />
            </div>
            <div className="relative w-[130px] shrink-0">
              <select
                aria-label="Filtrar por estado"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value as Filtro)}
                className="h-10 w-full appearance-none rounded-lg border border-[#E4E1F0] bg-white pr-8 pl-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="todas">Todas</option>
                <option value="PENDIENTE">Por pagar</option>
                <option value="PAGADA">Pagadas</option>
                <option value="ANULADA">Anuladas</option>
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        ) : (
          <Button className="h-10 rounded-lg px-4 font-semibold" onClick={() => setCreandoProveedor(true)}>
            <Plus />
            Nuevo proveedor
          </Button>
        )}
      </div>

      <div className={cn("overflow-hidden rounded-2xl bg-card", SOMBRA)}>
        {pestana === "compras" ? (
          comprasFiltradas.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-medium">{compras.length === 0 ? "Sin compras registradas" : "No hay compras con ese filtro."}</p>
              <p className={`mx-auto mt-1 max-w-xl text-sm ${GRIS}`}>
                {compras.length === 0 ? "Registra tu primera compra para cargar stock en el inventario y llevar lo que debes a tus proveedores." : "Prueba con otra palabra o cambia el estado."}
              </p>
            </div>
          ) : (
            <>
              <table className="hidden w-full table-fixed border-collapse text-left lg:table">
                <colgroup>
                  <col className="w-[9%]" />
                  <col className="w-[19%]" />
                  <col className="w-[23%]" />
                  <col className="w-[13%]" />
                  <col className="w-[12%]" />
                  <col className="w-[11%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead>
                  <tr className="bg-[#F7F6FC] text-[13px] text-[#3F3C55]">
                    <th scope="col" className="px-5 py-3 font-semibold">N.°</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Documento</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Proveedor</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Fecha</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Vence</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {comprasFiltradas.map((c) => {
                    const vencida = estaVencida(c);
                    return (
                      <tr key={c.id} onClick={() => setViendoId(c.id)} className="cursor-pointer border-t border-[#F0EEF6] hover:bg-[#FBFAFF]">
                        <td className="px-5 py-4 text-[15px] font-semibold">C-{c.numero}</td>
                        <td className="truncate px-4 py-4 text-[15px] text-[#3F3C55] tabular-nums" title={c.folio ?? undefined}>{c.folio ? `${textoDocumento(c.documento) ?? "N.°"} ${c.folio}` : "—"}</td>
                        <td className="px-4 py-4">
                          <Proveedor compra={c} proveedores={proveedores} />
                        </td>
                        <td className="px-4 py-4 text-[15px] text-[#3F3C55] tabular-nums">{fechaCorta(c.fecha)}</td>
                        <td className={cn("px-4 py-4 text-[15px] tabular-nums", vencida ? "font-medium text-[#A32020]" : c.estado === "PENDIENTE" && c.vencimiento ? "text-[#3F3C55]" : GRIS)}>
                          {c.estado === "PENDIENTE" && c.vencimiento ? fechaCorta(c.vencimiento) : "Sin fecha"}
                        </td>
                        <td className="px-4 py-4">
                          <EstadoTexto compra={c} vencida={vencida} />
                        </td>
                        <td className="px-5 py-4 text-right text-[15px] font-bold tabular-nums">{clp(c.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <ul className="divide-y divide-[#F0EEF6] lg:hidden">
                {comprasFiltradas.map((c) => (
                  <li key={c.id} className="cursor-pointer px-4 py-3" onClick={() => setViendoId(c.id)}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[15px] font-semibold">C-{c.numero}</p>
                      <p className="text-[15px] font-semibold tabular-nums">{clp(c.total)}</p>
                    </div>
                    <p className={`truncate text-[13px] tabular-nums ${GRIS}`}>
                      {c.folio ? `${textoDocumento(c.documento) ?? "N.°"} ${c.folio} · ` : ""}
                      {fechaCorta(c.fecha)}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <Proveedor compra={c} proveedores={proveedores} />
                      <EstadoTexto compra={c} vencida={estaVencida(c)} />
                    </div>
                  </li>
                ))}
              </ul>

              <div className={`flex justify-between gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-3 text-sm tabular-nums ${GRIS}`}>
                <span>
                  {comprasFiltradas.length} compra{comprasFiltradas.length === 1 ? "" : "s"}
                </span>
                <span>
                  Total <strong className="font-semibold text-[#15132B]">{clp(totalFiltrado)}</strong>
                </span>
              </div>
            </>
          )
        ) : (
          <ProveedoresTabla proveedores={proveedores} compras={compras} onNuevo={() => setCreandoProveedor(true)} onEditar={setEditandoProveedor} />
        )}
      </div>

      {viendo && <CompraDetalleDialog compra={viendo} onCerrar={cerrarDetalle} />}
      {(creandoProveedor || editandoProveedor) && <ProveedorDialog key={editandoProveedor?.id ?? "nuevo"} proveedor={editandoProveedor} onCerrar={cerrarProveedor} />}
    </div>
  );
}
