"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { buttonVariants, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompraDetalleDialog, COLOR_ESTADO_COMPRA } from "@/components/panel/compra-detalle-dialog";
import { ProveedorDialog } from "@/components/panel/proveedor-dialog";
import { TEXTO_ESTADO_COMPRA, type CompraFila, type ProveedorFila } from "@/lib/compras-comun";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");

const alto = "h-10";
const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";
const AMBAR_TARJ = "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10";
const AMBAR_TXT = "text-amber-800 dark:text-amber-300";

type Filtro = "todas" | "PENDIENTE" | "PAGADA" | "ANULADA";

/**
 * Las compras del comité, con el diseño de MecánicoApp: pestañas Compras y Proveedores, buscador,
 * y la tabla en una tarjeta. Una compra por pagar es una cuenta por pagar: se ve cuánto se debe
 * y cuáles ya vencieron.
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
  const porPagar = compras.filter((c) => c.estado === "PENDIENTE");
  const totalPorPagar = porPagar.reduce((s, c) => s + c.total, 0);
  const vencidas = porPagar.filter((c) => c.vencimiento && c.vencimiento < hoy).length;
  const compradoEsteMes = compras.filter((c) => c.estado !== "ANULADA" && c.fecha.startsWith(mes)).reduce((s, c) => s + c.total, 0);

  const q = busqueda.trim().toLowerCase();
  const comprasFiltradas = compras.filter((c) => {
    if (filtro !== "todas" && c.estado !== filtro) return false;
    if (!q) return true;
    return (
      `c-${c.numero}`.includes(q) ||
      (c.folio ?? "").toLowerCase().includes(q) ||
      (c.proveedor ?? "").toLowerCase().includes(q)
    );
  });
  const proveedoresFiltrados = proveedores.filter(
    (p) =>
      !q ||
      p.nombre.toLowerCase().includes(q) ||
      (p.rut ?? "").toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q) ||
      (p.telefono ?? "").toLowerCase().includes(q)
  );

  const viendo = compras.find((c) => c.id === viendoId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-3">
        <div className={cn("rounded-xl border p-5", totalPorPagar > 0 ? AMBAR_TARJ : "border-border bg-card")}>
          <p className={cn(etiquetaKpi, totalPorPagar > 0 ? AMBAR_TXT : "text-muted-foreground")}>Por pagar</p>
          <p className={cn("mt-3 text-[2rem] leading-none font-bold tabular-nums", totalPorPagar > 0 && AMBAR_TXT)}>
            {clp.format(totalPorPagar)}
          </p>
          {porPagar.length > 0 && (
            <p className={cn("mt-2 text-[0.8rem]", vencidas > 0 ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>
              {porPagar.length} {porPagar.length === 1 ? "compra" : "compras"}
              {vencidas > 0 ? ` · ${vencidas} vencida${vencidas === 1 ? "" : "s"}` : ""}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Comprado este mes</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{clp.format(compradoEsteMes)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Proveedores</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{proveedores.length}</p>
        </div>
      </section>

      <div className="flex w-full gap-1 rounded-xl border border-border p-1 sm:w-fit" role="tablist" aria-label="Sección">
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
              "rounded-lg px-5 py-1.5 text-[0.9rem] font-medium transition-colors",
              pestana === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={pestana === "compras" ? "Buscar por número, factura o proveedor…" : "Buscar por nombre o RUT…"}
          className={cn(alto, "rounded-full px-5 text-[0.95rem] sm:w-96")}
          aria-label="Buscar"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          {pestana === "compras" && (
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as Filtro)}
              aria-label="Estado"
              className={cn(
                alto,
                "rounded-xl border border-input bg-transparent px-4 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              )}
            >
              <option value="todas">Todas</option>
              <option value="PENDIENTE">Por pagar</option>
              <option value="PAGADA">Pagadas</option>
              <option value="ANULADA">Anuladas</option>
            </select>
          )}
          {pestana === "compras" ? (
            <Link href="/panel/compras/nueva" className={cn(buttonVariants(), alto, "rounded-full px-5 text-[0.95rem]")}>
              + Nueva compra
            </Link>
          ) : (
            <Button className={cn(alto, "rounded-full px-5 text-[0.95rem]")} onClick={() => setCreandoProveedor(true)}>
              + Nuevo proveedor
            </Button>
          )}
        </div>
      </div>

      {pestana === "compras" ? (
        comprasFiltradas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-20 text-center">
            <p className="text-[1.05rem] font-medium">{compras.length === 0 ? "Sin compras registradas" : "Nada coincide con la búsqueda"}</p>
            <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">
              {compras.length === 0
                ? "Registra tu primera compra para cargar stock en el inventario y llevar lo que debes a tus proveedores."
                : "Prueba con otra palabra o cambia el estado."}
            </p>
          </div>
        ) : (
          <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-160 border-collapse text-[0.95rem]">
              <thead>
                <tr className="border-b border-border bg-card">
                  {["N°", "Proveedor", "Factura", "Fecha", "Vence", "Estado", "Total"].map((c) => (
                    <th key={c} className="px-5 py-4 text-left font-medium whitespace-nowrap text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comprasFiltradas.map((c) => {
                  const vencida = c.estado === "PENDIENTE" && c.vencimiento !== null && c.vencimiento < hoy;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setViendoId(c.id)}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-card/50"
                    >
                      <td className="px-5 py-4 font-medium whitespace-nowrap">C-{c.numero}</td>
                      <td className="px-5 py-4 whitespace-nowrap">{c.proveedor ?? "—"}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{c.folio ?? "—"}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">{fechaCorta(c.fecha)}</td>
                      <td
                        className={cn(
                          "px-5 py-4 whitespace-nowrap tabular-nums",
                          vencida ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"
                        )}
                      >
                        {c.estado === "PENDIENTE" && c.vencimiento ? fechaCorta(c.vencimiento) : "—"}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={cn("rounded-full px-3 py-1 text-[0.8rem] font-medium", COLOR_ESTADO_COMPRA[c.estado])}>
                          {vencida ? "Vencida" : TEXTO_ESTADO_COMPRA[c.estado]}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-medium whitespace-nowrap tabular-nums">{clp.format(c.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : proveedoresFiltrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">{proveedores.length === 0 ? "Sin proveedores" : "Nada coincide con la búsqueda"}</p>
          {proveedores.length === 0 && (
            <>
              <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">
                Registra a quién le compras para asociarlo a tus compras.
              </p>
              <Button className={cn(alto, "mt-5 rounded-full px-5 text-[0.95rem]")} onClick={() => setCreandoProveedor(true)}>
                + Nuevo proveedor
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-160 border-collapse text-[0.95rem]">
            <thead>
              <tr className="border-b border-border bg-card">
                {["Nombre", "RUT", "Correo", "Teléfono"].map((c) => (
                  <th key={c} className="px-5 py-4 text-left font-medium whitespace-nowrap text-muted-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proveedoresFiltrados.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setEditandoProveedor(p)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-card/50"
                >
                  <td className="px-5 py-4 font-medium whitespace-nowrap">{p.nombre}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{p.rut ?? "—"}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{p.email ?? "—"}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{p.telefono ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viendo && <CompraDetalleDialog compra={viendo} onCerrar={cerrarDetalle} />}
      {(creandoProveedor || editandoProveedor) && (
        <ProveedorDialog key={editandoProveedor?.id ?? "nuevo"} proveedor={editandoProveedor} onCerrar={cerrarProveedor} />
      )}
    </div>
  );
}
