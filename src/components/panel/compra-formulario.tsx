"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { crearCompra } from "@/app/panel/compras/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InsumoDialog } from "@/components/panel/insumo-dialog";
import { ProveedorDialog } from "@/components/panel/proveedor-dialog";
import { MEDIOS_MOVIMIENTO, hoyEnChile } from "@/lib/finanzas-comun";
import { UNIDADES_INSUMO, type Insumo, type OpcionCategoria } from "@/lib/inventario-comun";
import { TASA_IVA, totalesDe, type OrigenItem, type ProveedorFila } from "@/lib/compras-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/** Los campos de esta pantalla son de 44 px y en píldora, como en MecánicoApp. */
const campo = "h-11 rounded-full px-5 text-[0.95rem]";
const selectClase =
  "h-11 w-full appearance-none rounded-2xl border border-input bg-transparent pr-10 pl-5 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
const etiqueta = "mb-2 block text-[0.9rem] font-medium";
const tituloSeccion = "text-[0.85rem] font-medium tracking-wide text-muted-foreground uppercase";

type Linea = {
  clave: number;
  origen: OrigenItem;
  insumoId: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  costo: string;
};

const lineaVacia = (clave: number): Linea => ({
  clave,
  origen: "INVENTARIO",
  insumoId: "",
  descripcion: "",
  unidad: "UNIDAD",
  cantidad: "1",
  costo: "",
});

const aCantidad = (t: string) => Number(t.replace(/\s/g, "").replace(",", ".")) || 0;
const aPesos = (t: string) => Number(t.replace(/\D/g, "")) || 0;

const PESTANAS: { origen: OrigenItem; texto: string }[] = [
  { origen: "INVENTARIO", texto: "Desde inventario" },
  { origen: "NUEVO", texto: "Material nuevo" },
  { origen: "GASTO", texto: "Solo gasto" },
];

/** Un campo de búsqueda con lista de resultados: se escribe, se elige uno y queda elegido. */
function Buscador({
  items,
  valor,
  onElegir,
  placeholder,
  sinResultados,
}: {
  items: { id: string; titulo: string; detalle?: string }[];
  valor: string;
  onElegir: (id: string) => void;
  placeholder: string;
  sinResultados: string;
}) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const elegido = items.find((i) => i.id === valor);
  const texto = q.trim().toLowerCase();
  const resultados = items.filter((i) => !texto || `${i.titulo} ${i.detalle ?? ""}`.toLowerCase().includes(texto)).slice(0, 8);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={abierto ? q : (elegido?.titulo ?? "")}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          setQ("");
          setAbierto(true);
        }}
        // Un instante de espera: si no, el clic en un resultado llega después de cerrarse la lista.
        onBlur={() => setTimeout(() => setAbierto(false), 120)}
        placeholder={placeholder}
        className={cn(campo, "pl-11", elegido && "pr-11")}
        autoComplete="off"
      />
      {elegido && !abierto && (
        <button
          type="button"
          aria-label="Quitar la selección"
          onClick={() => onElegir("")}
          className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
      {abierto && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-md">
          {resultados.length === 0 ? (
            <li className="px-3 py-2 text-[0.9rem] text-muted-foreground">{sinResultados}</li>
          ) : (
            resultados.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  // mousedown y no click: se ejecuta antes de que el campo pierda el foco y cierre la lista.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onElegir(i.id);
                    setAbierto(false);
                  }}
                  className="flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-[0.9rem] hover:bg-muted"
                >
                  <span className="truncate">{i.titulo}</span>
                  {i.detalle && <span className="shrink-0 text-[0.8rem] text-muted-foreground">{i.detalle}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/** Un selector con la flecha a la derecha. */
function Selector({ id, valor, onCambiar, children }: { id: string; valor: string; onCambiar: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select id={id} value={valor} onChange={(e) => onCambiar(e.target.value)} className={selectClase}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/**
 * Registrar una compra, con el formulario de MecánicoApp: datos generales arriba y las líneas
 * abajo, cada una desde el inventario (suma stock), un material nuevo (lo crea) o solo un gasto.
 * Además lleva lo que le sirve a un comité: vencimiento, medio de pago, IVA y la unidad.
 * Si se marca pagada, el egreso queda en Caja; si no, queda como una cuenta por pagar.
 */
export function CompraFormulario({
  proveedores,
  insumos,
  categorias,
}: {
  proveedores: ProveedorFila[];
  insumos: Insumo[];
  /** Las categorías del inventario, para registrar un material nuevo desde aquí. */
  categorias: OpcionCategoria[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [proveedorId, setProveedorId] = useState("");
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

  // Crear un proveedor sin salir de la compra: al cerrarse el modal se recarga la lista y se elige el nuevo.
  const [creandoProveedor, setCreandoProveedor] = useState(false);
  const idsAntes = useRef<string[] | null>(null);
  const abrirNuevoProveedor = () => {
    idsAntes.current = proveedores.map((p) => p.id);
    setCreandoProveedor(true);
  };
  const cerrarNuevoProveedor = useCallback(() => {
    setCreandoProveedor(false);
    router.refresh();
  }, [router]);
  useEffect(() => {
    if (!idsAntes.current) return;
    const nuevo = proveedores.find((p) => !idsAntes.current?.includes(p.id));
    if (nuevo) {
      setProveedorId(nuevo.id);
      idsAntes.current = null;
    }
  }, [proveedores]);

  // Igual con un material que todavía no está en el inventario: se registra sin salir de la compra
  // y queda elegido en la línea desde la que se pidió.
  const [lineaNuevoMaterial, setLineaNuevoMaterial] = useState<number | null>(null);
  const insumosAntes = useRef<string[] | null>(null);
  const lineaEsperando = useRef<number | null>(null);
  const abrirNuevoMaterial = (clave: number) => {
    insumosAntes.current = insumos.map((i) => i.id);
    lineaEsperando.current = clave;
    setLineaNuevoMaterial(clave);
  };
  const cerrarNuevoMaterial = useCallback(() => {
    setLineaNuevoMaterial(null);
    router.refresh();
  }, [router]);
  useEffect(() => {
    if (!insumosAntes.current || lineaEsperando.current === null) return;
    const nuevo = insumos.find((i) => !insumosAntes.current?.includes(i.id));
    if (nuevo) {
      const clave = lineaEsperando.current;
      setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, insumoId: nuevo.id } : l)));
      insumosAntes.current = null;
      lineaEsperando.current = null;
    }
  }, [insumos]);

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
        proveedorId: proveedorId || null,
        proveedorNombre: proveedorId ? "" : proveedorTexto,
        fecha,
        vencimiento: estado === "PENDIENTE" ? vencimiento || null : null,
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
    <>
    <form onSubmit={guardar} className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <h2 className={tituloSeccion}>Datos generales</h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <span className={etiqueta}>Proveedor</span>
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <Buscador
                  items={proveedores.map((p) => ({ id: p.id, titulo: p.nombre, detalle: p.rut ?? undefined }))}
                  valor={proveedorId}
                  onElegir={setProveedorId}
                  placeholder="Buscar proveedor…"
                  sinResultados="Ningún proveedor coincide."
                />
              </div>
              <Button type="button" className="h-11 shrink-0 rounded-full px-5 text-[0.95rem]" onClick={abrirNuevoProveedor}>
                + Nuevo proveedor
              </Button>
            </div>
          </div>
          <div>
            <label htmlFor="cmp-proveedor-texto" className={etiqueta}>
              Nombre del proveedor (sin registro)
            </label>
            <Input
              id="cmp-proveedor-texto"
              value={proveedorTexto}
              onChange={(e) => setProveedorTexto(e.target.value)}
              placeholder="Opcional si no eliges proveedor"
              maxLength={120}
              disabled={proveedorId !== ""}
              className={campo}
            />
          </div>

          <div>
            <label htmlFor="cmp-fecha" className={etiqueta}>
              Fecha de compra
            </label>
            <Input id="cmp-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} required />
          </div>
          <div>
            <label htmlFor="cmp-estado" className={etiqueta}>
              Estado
            </label>
            <Selector id="cmp-estado" valor={estado} onCambiar={(v) => setEstado(v as "PENDIENTE" | "PAGADA")}>
              <option value="PENDIENTE">Pendiente (por pagar)</option>
              <option value="PAGADA">Pagada</option>
            </Selector>
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
              <Selector id="cmp-medio" valor={medio} onCambiar={setMedio}>
                {MEDIOS_MOVIMIENTO.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.texto}
                  </option>
                ))}
              </Selector>
            </div>
          )}
          <div className="flex items-end pb-3">
            <label className="flex items-center gap-2 text-[0.95rem]">
              <input type="checkbox" checked={conIva} onChange={(e) => setConIva(e.target.checked)} className="size-4" />
              Agregar IVA ({Math.round(TASA_IVA * 100)}%) al total
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="cmp-folio" className={etiqueta}>
            Folio / referencia
          </label>
          <Input
            id="cmp-folio"
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            placeholder="N° factura, boleta u otra referencia del proveedor"
            maxLength={60}
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="cmp-notas" className={etiqueta}>
            Notas
          </label>
          <Textarea id="cmp-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} maxLength={500} className="rounded-2xl px-5 py-3" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className={tituloSeccion}>Ítems</h2>
            <p className="mt-2 text-[0.9rem] text-muted-foreground">
              Desde inventario (suma stock), material nuevo (lo crea en el inventario) o solo gasto (no toca el inventario).
            </p>
          </div>
          <Button type="button" variant="outline" className="h-10 shrink-0 rounded-xl px-4 text-[0.95rem]" onClick={agregarLinea}>
            + Agregar línea
          </Button>
        </div>

        {lineas.map((l, idx) => {
          const insumo = insumos.find((i) => i.id === l.insumoId);
          return (
            <div key={l.clave} className="flex flex-col gap-4 rounded-xl border border-border p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex w-fit gap-1 rounded-xl border border-border p-1" role="tablist" aria-label={`Tipo de la línea ${idx + 1}`}>
                  {PESTANAS.map((p) => (
                    <button
                      key={p.origen}
                      type="button"
                      role="tab"
                      aria-selected={l.origen === p.origen}
                      onClick={() => cambiar(l.clave, { origen: p.origen })}
                      className={cn(
                        "rounded-lg px-4 py-1.5 text-[0.9rem] font-medium whitespace-nowrap transition-colors",
                        l.origen === p.origen ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p.texto}
                    </button>
                  ))}
                </div>
                {lineas.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Quitar la línea ${idx + 1}`}
                    onClick={() => quitar(l.clave)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-5" />
                  </button>
                )}
              </div>

              {l.origen === "INVENTARIO" && (
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <Buscador
                      items={insumos.map((i) => ({ id: i.id, titulo: i.nombre, detalle: i.codigo ?? undefined }))}
                      valor={l.insumoId}
                      onElegir={(id) => cambiar(l.clave, { insumoId: id })}
                      placeholder="Buscar por nombre o código del material…"
                      sinResultados={
                        insumos.length === 0
                          ? "Todavía no hay materiales. Crea uno con «+ Nuevo material»."
                          : "Ningún material coincide. Si es nuevo, usa «+ Nuevo material»."
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 rounded-full px-5 text-[0.95rem]"
                    onClick={() => abrirNuevoMaterial(l.clave)}
                  >
                    + Nuevo material
                  </Button>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-12">
                <div className={l.origen === "NUEVO" ? "sm:col-span-8" : "sm:col-span-12"}>
                  <label htmlFor={`lin-desc-${l.clave}`} className="mb-2 block text-[0.85rem] text-muted-foreground">
                    Descripción
                  </label>
                  <Input
                    id={`lin-desc-${l.clave}`}
                    value={l.origen === "INVENTARIO" ? (insumo?.nombre ?? "") : l.descripcion}
                    onChange={(e) => cambiar(l.clave, { descripcion: e.target.value })}
                    readOnly={l.origen === "INVENTARIO"}
                    placeholder={l.origen === "NUEVO" ? "Cloro granulado" : l.origen === "GASTO" ? "Reparación de la bomba" : ""}
                    maxLength={160}
                    className={campo}
                  />
                </div>
                {l.origen === "NUEVO" && (
                  <div className="sm:col-span-4">
                    <label htmlFor={`lin-unidad-${l.clave}`} className="mb-2 block text-[0.85rem] text-muted-foreground">
                      Se cuenta en
                    </label>
                    <Selector id={`lin-unidad-${l.clave}`} valor={l.unidad} onCambiar={(v) => cambiar(l.clave, { unidad: v })}>
                      {UNIDADES_INSUMO.map((u) => (
                        <option key={u.valor} value={u.valor}>
                          {u.texto}
                        </option>
                      ))}
                    </Selector>
                  </div>
                )}

                <div className="sm:col-span-4">
                  <label htmlFor={`lin-cant-${l.clave}`} className="mb-2 block text-[0.85rem] text-muted-foreground">
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
                  <label htmlFor={`lin-costo-${l.clave}`} className="mb-2 block text-[0.85rem] text-muted-foreground">
                    Precio de compra (sin IVA)
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
                <div className="sm:col-span-4">
                  <span className="mb-2 block text-[0.85rem] text-muted-foreground">Total línea</span>
                  <div className="flex h-11 items-center rounded-2xl border border-border px-5 text-[0.95rem] tabular-nums">
                    {clp.format(Math.round(aCantidad(l.cantidad) * aPesos(l.costo)))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-1 border-t border-border pt-6 sm:ml-auto sm:w-full sm:max-w-sm">
        <div className="flex justify-between py-1 text-[0.95rem]">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{clp.format(totales.subtotal)}</span>
        </div>
        <div className="flex justify-between py-1 text-[0.95rem]">
          <span className="text-muted-foreground">Impuesto</span>
          <span className="tabular-nums">{clp.format(totales.impuesto)}</span>
        </div>
        <div className="flex items-baseline justify-between pt-1">
          <span className="text-[1.25rem] font-bold">Total</span>
          <span className="text-[1.5rem] font-bold tabular-nums">{clp.format(totales.total)}</span>
        </div>
      </section>

      {error && (
        <p className="text-[0.9rem] text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/panel/compras" className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-5 text-[0.95rem] hover:bg-muted">
          Cancelar
        </Link>
        <Button type="submit" className="h-11 rounded-full px-6 text-[0.95rem]" disabled={pendiente}>
          {pendiente && <Loader2 className="animate-spin" />}
          Registrar compra
        </Button>
      </div>

    </form>

    {/*
      El modal va FUERA del formulario de la compra. Aunque se dibuja encima, para React un hijo es
      parte de su padre: dentro del formulario, el envío del proveedor subía hasta el de la compra,
      que lo interceptaba y no dejaba guardar al proveedor.
    */}
    {creandoProveedor && <ProveedorDialog proveedor={null} onCerrar={cerrarNuevoProveedor} />}
    {lineaNuevoMaterial !== null && <InsumoDialog insumo={null} categorias={categorias} onCerrar={cerrarNuevoMaterial} />}
    </>
  );
}
