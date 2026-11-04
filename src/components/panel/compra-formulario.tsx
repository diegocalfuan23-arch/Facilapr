"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { crearCompra } from "@/app/panel/compras/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MEDIOS_MOVIMIENTO, hoyEnChile } from "@/lib/finanzas-comun";
import { UNIDADES_INSUMO, type Insumo } from "@/lib/inventario-comun";
import { TASA_IVA, TEXTO_ORIGEN_ITEM, totalesDe, type OrigenItem, type ProveedorFila } from "@/lib/compras-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

const campo = "h-10 px-3 text-[0.95rem]";
const selectClase =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";
const tarjeta = "rounded-xl border border-border bg-card p-5 sm:p-6";

type Linea = {
  clave: number;
  origen: OrigenItem;
  insumoId: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  costo: string;
};

const lineaVacia = (clave: number): Linea => ({ clave, origen: "INVENTARIO", insumoId: "", descripcion: "", unidad: "UNIDAD", cantidad: "1", costo: "" });

const aCantidad = (t: string) => Number(t.replace(/\s/g, "").replace(",", ".")) || 0;
const aPesos = (t: string) => Number(t.replace(/\D/g, "")) || 0;

/**
 * Registrar una compra: a quién, cuándo y qué se compró. Cada línea puede ser un material que
 * ya está en el inventario (le suma stock), un material nuevo (lo crea) o solo un gasto. Si se
 * marca como pagada, el egreso queda en Caja; si no, queda como una cuenta por pagar.
 */
export function CompraFormulario({ proveedores, insumos }: { proveedores: ProveedorFila[]; insumos: Insumo[] }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [proveedorSel, setProveedorSel] = useState("");
  const [proveedorTexto, setProveedorTexto] = useState("");
  const [fecha, setFecha] = useState(hoyEnChile());
  const [vencimiento, setVencimiento] = useState("");
  const [folio, setFolio] = useState("");
  const [notas, setNotas] = useState("");
  const [conIva, setConIva] = useState(true);
  const [estado, setEstado] = useState<"PENDIENTE" | "PAGADA">("PENDIENTE");
  const [medio, setMedio] = useState("TRANSFERENCIA");
  const [lineas, setLineas] = useState<Linea[]>([lineaVacia(1)]);
  const [siguiente, setSiguiente] = useState(2);

  const totales = totalesDe(
    lineas.map((l) => ({ cantidad: aCantidad(l.cantidad), costoUnitario: aPesos(l.costo) })),
    conIva
  );

  function cambiar(clave: number, parcial: Partial<Linea>) {
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...parcial } : l)));
  }

  function agregarLinea() {
    setLineas((ls) => [...ls, lineaVacia(siguiente)]);
    setSiguiente((n) => n + 1);
  }

  function quitar(clave: number) {
    setLineas((ls) => (ls.length > 1 ? ls.filter((l) => l.clave !== clave) : ls));
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const items = lineas.map((l) => {
      const insumo = l.origen === "INVENTARIO" ? insumos.find((i) => i.id === l.insumoId) : undefined;
      return {
        origen: l.origen,
        insumoId: l.origen === "INVENTARIO" ? l.insumoId || null : null,
        descripcion: l.origen === "INVENTARIO" ? (insumo?.nombre ?? "") : l.descripcion,
        unidad: l.origen === "NUEVO" ? l.unidad : null,
        cantidad: aCantidad(l.cantidad),
        costoUnitario: aPesos(l.costo),
      };
    });

    iniciar(async () => {
      const r = await crearCompra({
        proveedorId: proveedorSel && proveedorSel !== "__otro" ? proveedorSel : null,
        proveedorNombre: proveedorSel === "__otro" ? proveedorTexto : "",
        fecha,
        vencimiento: vencimiento || null,
        folio,
        notas,
        conIva,
        estado,
        medio,
        items,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success(`Compra C-${r.numero} registrada`);
      router.push("/panel/compras");
    });
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-6">
      <section className={tarjeta}>
        <h2 className="mb-4 text-[0.95rem] font-medium">Datos de la compra</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cmp-proveedor" className={etiqueta}>
              Proveedor
            </label>
            <select id="cmp-proveedor" value={proveedorSel} onChange={(e) => setProveedorSel(e.target.value)} className={selectClase}>
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
              <option value="__otro">Otro (escribir el nombre)…</option>
            </select>
          </div>
          {proveedorSel === "__otro" ? (
            <div>
              <label htmlFor="cmp-proveedor-texto" className={etiqueta}>
                Nombre del proveedor
              </label>
              <Input id="cmp-proveedor-texto" value={proveedorTexto} onChange={(e) => setProveedorTexto(e.target.value)} maxLength={120} className={campo} autoFocus />
            </div>
          ) : (
            <div className="hidden sm:block" />
          )}
          <div>
            <label htmlFor="cmp-fecha" className={etiqueta}>
              Fecha de la compra
            </label>
            <Input id="cmp-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} required />
          </div>
          <div>
            <label htmlFor="cmp-folio" className={etiqueta}>
              N.° de factura o boleta (opcional)
            </label>
            <Input id="cmp-folio" value={folio} onChange={(e) => setFolio(e.target.value)} maxLength={60} className={campo} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cmp-notas" className={etiqueta}>
              Notas (opcional)
            </label>
            <Textarea id="cmp-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={500} />
          </div>
        </div>
      </section>

      <section className={tarjeta}>
        <h2 className="mb-4 text-[0.95rem] font-medium">Qué se compró</h2>
        <div className="flex flex-col gap-4">
          {lineas.map((l, idx) => (
            <div key={l.clave} className="rounded-xl border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <label htmlFor={`lin-origen-${l.clave}`} className={etiqueta}>
                    Tipo de línea
                  </label>
                  <select
                    id={`lin-origen-${l.clave}`}
                    value={l.origen}
                    onChange={(e) => cambiar(l.clave, { origen: e.target.value as OrigenItem })}
                    className={selectClase}
                  >
                    {(Object.keys(TEXTO_ORIGEN_ITEM) as OrigenItem[]).map((o) => (
                      <option key={o} value={o}>
                        {TEXTO_ORIGEN_ITEM[o]}
                      </option>
                    ))}
                  </select>
                </div>

                {l.origen === "INVENTARIO" ? (
                  <div className="sm:col-span-8">
                    <label htmlFor={`lin-insumo-${l.clave}`} className={etiqueta}>
                      Material
                    </label>
                    <select
                      id={`lin-insumo-${l.clave}`}
                      value={l.insumoId}
                      onChange={(e) => cambiar(l.clave, { insumoId: e.target.value })}
                      className={selectClase}
                    >
                      <option value="">{insumos.length === 0 ? "No hay materiales en el inventario" : "Elige un material"}</option>
                      {insumos.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className={l.origen === "NUEVO" ? "sm:col-span-5" : "sm:col-span-8"}>
                      <label htmlFor={`lin-desc-${l.clave}`} className={etiqueta}>
                        Descripción
                      </label>
                      <Input
                        id={`lin-desc-${l.clave}`}
                        value={l.descripcion}
                        onChange={(e) => cambiar(l.clave, { descripcion: e.target.value })}
                        placeholder={l.origen === "NUEVO" ? "Cloro granulado" : "Reparación de la bomba"}
                        maxLength={160}
                        className={campo}
                      />
                    </div>
                    {l.origen === "NUEVO" && (
                      <div className="sm:col-span-3">
                        <label htmlFor={`lin-unidad-${l.clave}`} className={etiqueta}>
                          Se cuenta en
                        </label>
                        <select
                          id={`lin-unidad-${l.clave}`}
                          value={l.unidad}
                          onChange={(e) => cambiar(l.clave, { unidad: e.target.value })}
                          className={selectClase}
                        >
                          {UNIDADES_INSUMO.map((u) => (
                            <option key={u.valor} value={u.valor}>
                              {u.texto}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                <div className="sm:col-span-3">
                  <label htmlFor={`lin-cant-${l.clave}`} className={etiqueta}>
                    Cantidad
                  </label>
                  <Input
                    id={`lin-cant-${l.clave}`}
                    value={l.cantidad}
                    onChange={(e) => cambiar(l.clave, { cantidad: e.target.value.replace(/[^\d,.]/g, "") })}
                    inputMode="decimal"
                    className={campo}
                  />
                </div>
                <div className="sm:col-span-4">
                  <label htmlFor={`lin-costo-${l.clave}`} className={etiqueta}>
                    Costo por unidad (sin IVA)
                  </label>
                  <Input
                    id={`lin-costo-${l.clave}`}
                    value={l.costo ? aPesos(l.costo).toLocaleString("es-CL") : ""}
                    onChange={(e) => cambiar(l.clave, { costo: e.target.value })}
                    placeholder="0"
                    inputMode="numeric"
                    className={campo}
                  />
                </div>
                <div className="flex items-end justify-between gap-2 sm:col-span-5">
                  <div>
                    <span className={etiqueta}>Subtotal</span>
                    <span className="text-[1rem] font-semibold tabular-nums">
                      {clp.format(Math.round(aCantidad(l.cantidad) * aPesos(l.costo)))}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar la línea ${idx + 1}`}
                    className="text-muted-foreground"
                    disabled={lineas.length === 1}
                    onClick={() => quitar(l.clave)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" className="mt-4 h-10 rounded-xl px-4 text-[0.95rem]" onClick={agregarLinea}>
          <Plus />
          Agregar otra línea
        </Button>
      </section>

      <section className={tarjeta}>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="text-[0.95rem] font-medium">Pago</h2>
            <div className="grid grid-cols-2 gap-3" role="group" aria-label="Estado del pago">
              {(
                [
                  ["PENDIENTE", "Por pagar"],
                  ["PAGADA", "Ya está pagada"],
                ] as const
              ).map(([valor, texto]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setEstado(valor)}
                  aria-pressed={estado === valor}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-[0.9rem] font-medium transition-colors",
                    estado === valor ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {texto}
                </button>
              ))}
            </div>
            {estado === "PENDIENTE" ? (
              <div>
                <label htmlFor="cmp-vence" className={etiqueta}>
                  Vence el (opcional)
                </label>
                <Input id="cmp-vence" type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} className={campo} />
              </div>
            ) : (
              <div>
                <label htmlFor="cmp-medio" className={etiqueta}>
                  Medio de pago
                </label>
                <select id="cmp-medio" value={medio} onChange={(e) => setMedio(e.target.value)} className={selectClase}>
                  {MEDIOS_MOVIMIENTO.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.texto}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[0.8rem] text-muted-foreground">El egreso queda anotado en Caja el día de la compra.</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-[0.9rem]">
              <input type="checkbox" checked={conIva} onChange={(e) => setConIva(e.target.checked)} className="size-4" />
              Agregar IVA ({Math.round(TASA_IVA * 100)}%)
            </label>
            <dl className="flex flex-col text-[0.95rem]">
              <div className="flex justify-between py-1">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{clp.format(totales.subtotal)}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-muted-foreground">IVA</dt>
                <dd className="tabular-nums">{clp.format(totales.impuesto)}</dd>
              </div>
              <div className="flex justify-between border-t border-border py-2 text-[1.15rem] font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{clp.format(totales.total)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {error && (
        <p className="text-[0.9rem] text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/panel/compras" className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-[0.95rem] hover:bg-muted">
          Cancelar
        </Link>
        <Button type="submit" className="h-10 rounded-full px-5 text-[0.95rem]" disabled={pendiente}>
          {pendiente && <Loader2 className="animate-spin" />}
          Registrar compra
        </Button>
      </div>
    </form>
  );
}
