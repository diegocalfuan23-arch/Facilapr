"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Banknote, Box, Check, FileText, Landmark, Loader2, Minus, PackagePlus, Plus, Receipt, Search, Trash2, Truck, X, type LucideIcon } from "lucide-react";
import { crearCompra } from "@/app/panel/compras/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProveedorDialog } from "@/components/panel/proveedor-dialog";
import { MEDIOS_MOVIMIENTO, hoyEnChile } from "@/lib/finanzas-comun";
import { UNIDADES_INSUMO, formatoCantidad, unidadCorta, type Insumo } from "@/lib/inventario-comun";
import { DOCUMENTOS_COMPRA, sumarDias, textoCondicionPago, totalesDe, type OrigenItem, type ProveedorFila, type TipoDocumento } from "@/lib/compras-comun";
import { cn } from "@/lib/utils";
import { avisarCambio } from "@/lib/avisos-datos";

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const aCantidad = (t: string) => Number(t.replace(/\s/g, "").replace(",", ".")) || 0;
const aPesos = (t: string) => Number(t.replace(/\D/g, "")) || 0;
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const campo = "h-11 rounded-xl border-[#E4E1F0] bg-white shadow-none";
const ICONO_MEDIO: Record<string, LucideIcon> = { EFECTIVO: Banknote, TRANSFERENCIA: Landmark, CHEQUE: FileText, OTRO: Receipt };

type Linea = {
  clave: number;
  origen: OrigenItem;
  insumoId: string | null;
  nombre: string;
  /** Lo que se muestra junto al nombre: código y unidad. */
  detalle: string;
  /** Solo en un material nuevo: la unidad con que se cuenta. */
  unidad: string;
  cantidad: string;
  precio: number;
  /** El stock de hoy del material del inventario, para mostrar cómo queda. */
  stock: number | null;
};

const ETIQUETA_ORIGEN: Record<OrigenItem, { texto: string; clase: string }> = {
  INVENTARIO: { texto: "Suma stock", clase: "bg-[#E6F6EF] text-[#075A3C]" },
  NUEVO: { texto: "Material nuevo", clase: "bg-[#ECE8FD] text-[#2A07A8]" },
  GASTO: { texto: "Solo gasto", clase: "bg-[#F0EFF4] text-[#4A4760]" },
};

function Seccion({ n, titulo, desc, children }: { n: number; titulo: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl bg-card", SOMBRA)}>
      <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-5 py-4 sm:px-6">
        <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#ECE8FD] text-xs font-bold text-[#2A07A8]">
          {n}
        </span>
        <div>
          <h2 className="text-[15px] font-semibold">{titulo}</h2>
          {desc && <p className={cn("mt-0.5 text-[13px]", GRIS)}>{desc}</p>}
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

const Etiqueta = ({ children, opcional }: { children: React.ReactNode; opcional?: boolean }) => (
  <span className="text-[13px] font-medium">
    {children}
    {opcional && <span className={cn("font-normal", GRIS)}> (opcional)</span>}
  </span>
);

/** Un grupo de opciones en píldoras, para elegir una (documento, pago, tipo de ítem). */
function Opciones<T extends string>({ valor, opciones, onElegir, etiqueta, className }: { valor: T; opciones: { valor: T; texto: string; icono?: LucideIcon }[]; onElegir: (v: T) => void; etiqueta: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className={cn("grid gap-1 rounded-xl bg-[#F4F3F9] p-1", className)} style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onElegir(o.valor)}
          className={cn("flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", valor === o.valor ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}
        >
          {o.icono && <o.icono className="hidden size-4 sm:block" aria-hidden />}
          {o.texto}
        </button>
      ))}
    </div>
  );
}

/**
 * Registrar una compra: proveedor y documento, los ítems (desde el inventario, material nuevo o solo gasto) y un
 * resumen fijo con el total. Si se marca pagada, el egreso queda en Caja; si no, queda como una cuenta por pagar.
 * La factura suma IVA a los precios (van netos); la boleta y los otros documentos ya lo traen incluido.
 */
export function CompraFormulario({ proveedores, insumos, proveedorInicial, insumoInicial }: { proveedores: ProveedorFila[]; insumos: Insumo[]; proveedorInicial?: string; insumoInicial?: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const inicial = proveedores.find((p) => p.id === proveedorInicial) ?? null;
  const [proveedorId, setProveedorId] = useState(inicial?.id ?? "");
  const [libre, setLibre] = useState("");
  const [qProv, setQProv] = useState("");
  const [abrirProv, setAbrirProv] = useState(false);
  const [fecha, setFecha] = useState(hoyEnChile());
  const [venceManual, setVenceManual] = useState<string | null>(null);
  const [documento, setDocumento] = useState<TipoDocumento>("FACTURA");
  const [folio, setFolio] = useState("");
  // Quien se paga al contado (o no tiene plazo) suele pagarse al momento; con plazo, queda por pagar.
  const [pagada, setPagada] = useState(inicial ? inicial.diasPago === 0 : false);
  const [medio, setMedio] = useState("TRANSFERENCIA");
  const [notas, setNotas] = useState<string | null>(null);
  // Desde «Comprar más» en Inventario la compra parte con ese material ya en la lista.
  const [lineas, setLineas] = useState<Linea[]>(() => {
    const m = insumos.find((i) => i.id === insumoInicial);
    return m
      ? [{ clave: 0, origen: "INVENTARIO", insumoId: m.id, nombre: m.nombre, detalle: [m.codigo, UNIDADES_INSUMO.find((u) => u.valor === m.unidad)?.texto.toLowerCase()].filter(Boolean).join(" · "), unidad: m.unidad, cantidad: "1", precio: m.costo, stock: m.stock }]
      : [];
  });
  const [siguiente, setSiguiente] = useState(1);
  const [tipo, setTipo] = useState<OrigenItem>("INVENTARIO");
  const [qMat, setQMat] = useState("");
  const [nuevo, setNuevo] = useState({ nombre: "", unidad: "UNIDAD", cantidad: "1", precio: "" });

  const proveedor = proveedores.find((p) => p.id === proveedorId) ?? null;
  const nombreProveedor = proveedor?.nombre ?? libre.trim();
  const conIva = documento === "FACTURA";
  const totales = totalesDe(
    lineas.map((l) => ({ cantidad: aCantidad(l.cantidad), costoUnitario: l.precio })),
    conIva
  );
  // El vencimiento se calcula con el plazo del proveedor, y se puede corregir a mano.
  const venceAuto = proveedor && proveedor.diasPago > 0 ? sumarDias(fecha, proveedor.diasPago) : "";
  const vence = venceManual ?? venceAuto;

  const faltas = [
    !nombreProveedor && "Elige o escribe un proveedor",
    lineas.length === 0 && "Agrega al menos un ítem",
    lineas.some((l) => aCantidad(l.cantidad) <= 0) && "Revisa las cantidades",
    documento !== "OTRO" && !folio.trim() && `Falta el N.° de ${documento.toLowerCase()}`,
  ].filter(Boolean) as string[];

  // Crear un proveedor sin salir de la compra: al cerrarse el modal se recarga la lista y se elige el nuevo.
  const [creandoProveedor, setCreandoProveedor] = useState(false);
  const idsAntes = useRef<string[] | null>(null);
  const abrirNuevoProveedor = () => {
    idsAntes.current = proveedores.map((p) => p.id);
    setAbrirProv(false);
    setCreandoProveedor(true);
  };
  const cerrarNuevoProveedor = useCallback(() => {
    setCreandoProveedor(false);
    router.refresh();
  }, [router]);
  useEffect(() => {
    if (!idsAntes.current) return;
    const creado = proveedores.find((p) => !idsAntes.current?.includes(p.id));
    if (creado) {
      idsAntes.current = null;
      setProveedorId(creado.id);
      setPagada(creado.diasPago === 0);
    }
  }, [proveedores]);

  function elegirProveedor(p: ProveedorFila) {
    setProveedorId(p.id);
    setLibre("");
    setAbrirProv(false);
    setQProv("");
    setVenceManual(null);
    setPagada(p.diasPago === 0);
  }

  const textoQ = sinTildes(qProv.trim());
  const provFiltrados = proveedores.filter((p) => !textoQ || sinTildes(`${p.nombre} ${p.rut ?? ""}`).includes(textoQ)).slice(0, 8);
  const textoMat = sinTildes(qMat.trim());
  const matFiltrados = textoMat ? insumos.filter((i) => sinTildes(`${i.nombre} ${i.codigo ?? ""}`).includes(textoMat)).slice(0, 8) : [];

  function agregarMaterial(i: Insumo) {
    setLineas((ls) =>
      ls.some((l) => l.insumoId === i.id)
        ? ls.map((l) => (l.insumoId === i.id ? { ...l, cantidad: String(aCantidad(l.cantidad) + 1).replace(".", ",") } : l))
        : [...ls, { clave: siguiente, origen: "INVENTARIO", insumoId: i.id, nombre: i.nombre, detalle: [i.codigo, UNIDADES_INSUMO.find((u) => u.valor === i.unidad)?.texto.toLowerCase()].filter(Boolean).join(" · "), unidad: i.unidad, cantidad: "1", precio: i.costo, stock: i.stock }]
    );
    setSiguiente((n) => n + 1);
    setQMat("");
  }

  function agregarNuevo() {
    const precio = aPesos(nuevo.precio);
    if (!nuevo.nombre.trim() || !nuevo.precio) return;
    const unidadTexto = tipo === "GASTO" ? "servicio" : (UNIDADES_INSUMO.find((u) => u.valor === nuevo.unidad)?.texto.toLowerCase() ?? "");
    setLineas((ls) => [...ls, { clave: siguiente, origen: tipo, insumoId: null, nombre: nuevo.nombre.trim(), detalle: unidadTexto, unidad: nuevo.unidad, cantidad: nuevo.cantidad || "1", precio, stock: null }]);
    setSiguiente((n) => n + 1);
    setNuevo({ nombre: "", unidad: "UNIDAD", cantidad: "1", precio: "" });
  }

  const cambiar = (clave: number, parcial: Partial<Linea>) => setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...parcial } : l)));
  const sumarCantidad = (l: Linea, d: number) => cambiar(l.clave, { cantidad: String(Math.max(0, Math.round((aCantidad(l.cantidad) + d) * 1000) / 1000)).replace(".", ",") });

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (faltas.length > 0) return;

    iniciar(async () => {
      const r = await crearCompra({
        proveedorId: proveedor?.id ?? null,
        proveedorNombre: proveedor ? "" : libre.trim(),
        fecha,
        vencimiento: pagada ? null : vence || null,
        folio,
        documento,
        notas: notas ?? "",
        estado: pagada ? "PAGADA" : "PENDIENTE",
        medio,
        items: lineas.map((l) => ({
          origen: l.origen,
          insumoId: l.origen === "INVENTARIO" ? l.insumoId : null,
          descripcion: l.nombre,
          unidad: l.origen === "NUEVO" ? l.unidad : null,
          cantidad: aCantidad(l.cantidad),
          costoUnitario: l.precio,
        })),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success(`Compra C-${r.numero} registrada`);
      avisarCambio("caja", "compras", "inventario");
      router.push("/panel/compras");
    });
  }

  const conStock = lineas.filter((l) => l.origen !== "GASTO").length;
  const medioTexto = MEDIOS_MOVIMIENTO.find((m) => m.valor === medio)?.texto.toLowerCase() ?? "";

  return (
    <>
      <form onSubmit={guardar} className="grid grid-cols-1 items-start gap-4 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-0">
        <div className="flex min-w-0 flex-col gap-4">
          <Seccion n={1} titulo="Proveedor y documento">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="relative md:col-span-2">
                <Etiqueta>Proveedor</Etiqueta>
                {proveedor ? (
                  <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-[#D9D1FB] bg-[#F7F5FE] px-3 py-2.5">
                    <span aria-hidden className="flex size-9 items-center justify-center rounded-lg bg-white text-[#3A0CE3]">
                      <Truck className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{proveedor.nombre}</span>
                      <span className={cn("block text-xs", GRIS)}>
                        {proveedor.rut ?? "Sin RUT"} · pago {textoCondicionPago(proveedor.diasPago).toLowerCase()}
                      </span>
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setProveedorId("")} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-[#2A07A8]">
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative mt-1.5">
                      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        value={qProv}
                        onFocus={() => setAbrirProv(true)}
                        onChange={(e) => {
                          setQProv(e.target.value);
                          setAbrirProv(true);
                        }}
                        // Un instante de espera: si no, el clic en un resultado llega después de cerrarse la lista.
                        onBlur={() => setTimeout(() => setAbrirProv(false), 150)}
                        placeholder="Buscar por nombre o RUT"
                        autoComplete="off"
                        className={cn(campo, "pl-9")}
                      />
                    </div>
                    {abrirProv && (
                      <div className="absolute inset-x-0 top-[74px] z-20 rounded-xl border border-[#ECEAF4] bg-white p-1.5 shadow-[0_12px_32px_rgba(21,19,43,0.14)]">
                        {provFiltrados.length === 0 && <p className={cn("px-2.5 py-2 text-sm", GRIS)}>Ningún proveedor coincide.</p>}
                        {provFiltrados.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            // mousedown y no click: se ejecuta antes de que el campo pierda el foco y cierre la lista.
                            onMouseDown={(e) => {
                              e.preventDefault();
                              elegirProveedor(p);
                            }}
                            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-[#F5F4FA]"
                          >
                            <Truck className="size-4 text-[#8A8799]" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{p.nombre}</span>
                              <span className={cn("block text-xs", GRIS)}>
                                {p.rut ?? "Sin RUT"} · {textoCondicionPago(p.diasPago)}
                              </span>
                            </span>
                          </button>
                        ))}
                        <div className="mt-1 flex gap-1 border-t border-[#F0EEF6] pt-1.5">
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              abrirNuevoProveedor();
                            }}
                            className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-[#2A07A8] hover:bg-[#F5F3FE]"
                          >
                            <Plus className="size-4" aria-hidden />
                            Crear proveedor
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (qProv.trim()) setLibre(qProv.trim());
                              setAbrirProv(false);
                            }}
                            className={cn("rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-[#F5F4FA]", GRIS)}
                          >
                            Usar sin registrar
                          </button>
                        </div>
                      </div>
                    )}
                    {libre && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#8F4400]">
                        Proveedor sin registrar: <b className="font-semibold">{libre}</b>
                        <button type="button" onClick={() => setLibre("")} aria-label="Quitar">
                          <X className="size-3.5" />
                        </button>
                      </p>
                    )}
                  </>
                )}
              </div>

              <div>
                <Etiqueta>Documento</Etiqueta>
                <Opciones className="mt-1.5" etiqueta="Documento" valor={documento} opciones={DOCUMENTOS_COMPRA} onElegir={setDocumento} />
                <p className={cn("mt-1.5 text-xs", GRIS)}>{conIva ? "Factura: los precios son netos y se suma IVA 19 %." : "Sin IVA desglosado: los precios son el total."}</p>
              </div>
              <label className="block">
                <Etiqueta opcional={documento === "OTRO"}>N.° {documento === "OTRO" ? "de referencia" : documento.toLowerCase()}</Etiqueta>
                <Input value={folio} onChange={(e) => setFolio(e.target.value)} maxLength={60} placeholder={documento === "FACTURA" ? "Ej.: 4523" : "N.° del documento"} className={cn("mt-1.5", campo)} />
              </label>
              <label className="block">
                <Etiqueta>Fecha de compra</Etiqueta>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={cn("mt-1.5", campo)} />
              </label>
              <div>
                <Etiqueta>Pago</Etiqueta>
                <Opciones
                  className="mt-1.5"
                  etiqueta="Pago"
                  valor={pagada ? "pagada" : "pendiente"}
                  opciones={[
                    { valor: "pendiente", texto: "Por pagar" },
                    { valor: "pagada", texto: "Ya pagada" },
                  ]}
                  onElegir={(v) => setPagada(v === "pagada")}
                />
              </div>
              {pagada ? (
                <div className="md:col-span-2">
                  <Etiqueta>Pagada con</Etiqueta>
                  <div className="mt-1.5 grid grid-cols-2 gap-2 sm:max-w-[360px]">
                    {MEDIOS_MOVIMIENTO.filter((m) => m.valor === "TRANSFERENCIA" || m.valor === "EFECTIVO").map((m) => {
                      const Icono = ICONO_MEDIO[m.valor];
                      return (
                        <button
                          key={m.valor}
                          type="button"
                          onClick={() => setMedio(m.valor)}
                          aria-pressed={medio === m.valor}
                          className={cn("flex h-11 items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold", medio === m.valor ? "border-primary bg-[#F5F3FE] text-[#2A07A8]" : "border-[#E4E1F0] bg-white")}
                        >
                          <Icono className="size-4" aria-hidden />
                          {m.texto}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <label className="block md:col-span-2 md:max-w-[calc(50%-8px)]">
                  <Etiqueta opcional>Vence el</Etiqueta>
                  <Input type="date" value={vence} onChange={(e) => setVenceManual(e.target.value)} className={cn("mt-1.5", campo)} />
                  {proveedor && proveedor.diasPago > 0 && venceManual === null && <span className={cn("mt-1 block text-xs", GRIS)}>Calculado con su condición de {textoCondicionPago(proveedor.diasPago)}.</span>}
                </label>
              )}
            </div>
            {notas === null ? (
              <button type="button" onClick={() => setNotas("")} className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-[#2A07A8] hover:underline">
                <Plus className="size-4" aria-hidden />
                Agregar nota
              </button>
            ) : (
              <label className="mt-4 block">
                <Etiqueta opcional>Notas</Etiqueta>
                <Textarea autoFocus value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej.: entregado en bodega del estanque" className="mt-1.5 min-h-[72px] rounded-xl border-[#E4E1F0] bg-white text-sm shadow-none" />
              </label>
            )}
          </Seccion>

          <Seccion n={2} titulo="Ítems" desc="Elige de dónde viene cada ítem: suma stock, crea un material o es solo un gasto.">
            <Opciones
              className="sm:w-[420px]"
              etiqueta="Tipo de ítem"
              valor={tipo}
              opciones={[
                { valor: "INVENTARIO", texto: "Del inventario", icono: Box },
                { valor: "NUEVO", texto: "Material nuevo", icono: PackagePlus },
                { valor: "GASTO", texto: "Solo gasto", icono: Receipt },
              ]}
              onElegir={setTipo}
            />

            {tipo === "INVENTARIO" ? (
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={qMat} onChange={(e) => setQMat(e.target.value)} placeholder="Buscar material por nombre o código" autoComplete="off" className={cn(campo, "pl-9")} />
                {matFiltrados.length > 0 ? (
                  <div className="absolute inset-x-0 top-[50px] z-20 rounded-xl border border-[#ECEAF4] bg-white p-1.5 shadow-[0_12px_32px_rgba(21,19,43,0.14)]">
                    {matFiltrados.map((m) => (
                      <button key={m.id} type="button" onClick={() => agregarMaterial(m)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-[#F5F4FA]">
                        <Box className="size-4 text-[#8A8799]" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{m.nombre}</span>
                          <span className={cn("block text-xs", GRIS)}>
                            {m.codigo ? `${m.codigo} · ` : ""}stock {formatoCantidad(m.stock)} {unidadCorta(m.unidad)}
                          </span>
                        </span>
                        <span className="text-sm tabular-nums">{m.costo > 0 ? clp(m.costo) : ""}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  qMat.trim() && (
                    <p className={cn("mt-2 text-xs", GRIS)}>
                      No está en el inventario.{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setTipo("NUEVO");
                          setNuevo({ ...nuevo, nombre: qMat.trim() });
                          setQMat("");
                        }}
                        className="font-semibold text-[#2A07A8] underline"
                      >
                        Crearlo como material nuevo
                      </button>
                    </p>
                  )
                )}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_120px_90px_130px_auto]">
                <Input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} maxLength={160} placeholder={tipo === "GASTO" ? "Ej.: flete, mano de obra" : "Nombre del material"} aria-label="Descripción" className={cn(campo, "col-span-2 sm:col-span-1")} />
                {tipo === "NUEVO" ? (
                  <select
                    aria-label="Unidad"
                    value={nuevo.unidad}
                    onChange={(e) => setNuevo({ ...nuevo, unidad: e.target.value })}
                    className="h-11 rounded-xl border border-[#E4E1F0] bg-white px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {UNIDADES_INSUMO.map((u) => (
                      <option key={u.valor} value={u.valor}>
                        {u.texto}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="hidden sm:block" />
                )}
                <Input inputMode="decimal" value={nuevo.cantidad} onChange={(e) => setNuevo({ ...nuevo, cantidad: e.target.value.replace(/[^\d,.]/g, "") })} aria-label="Cantidad" placeholder="Cant." className={cn(campo, "text-right")} />
                <Input
                  inputMode="numeric"
                  value={nuevo.precio ? aPesos(nuevo.precio).toLocaleString("es-CL") : ""}
                  onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })}
                  aria-label="Precio unitario"
                  placeholder={conIva ? "Precio neto" : "Precio"}
                  className={cn(campo, "text-right")}
                />
                <Button type="button" onClick={agregarNuevo} disabled={!nuevo.nombre.trim() || !nuevo.precio} className="col-span-2 h-11 rounded-xl font-semibold sm:col-span-1">
                  <Plus />
                  Agregar
                </Button>
              </div>
            )}

            {lineas.length > 0 ? (
              <div className="mt-5 overflow-hidden rounded-xl border border-[#ECEAF4]">
                <div className={cn("hidden grid-cols-[minmax(0,1fr)_140px_130px_120px_40px] gap-3 bg-[#FAFAFD] px-4 py-2 text-xs font-medium md:grid", GRIS)}>
                  <span>Ítem</span>
                  <span className="text-center">Cantidad</span>
                  <span className="text-right">Precio {conIva ? "neto" : "unit."}</span>
                  <span className="text-right">Subtotal</span>
                  <span />
                </div>
                <ul className="divide-y divide-[#F3F1F8]">
                  {lineas.map((l) => {
                    const e = ETIQUETA_ORIGEN[l.origen];
                    const cant = aCantidad(l.cantidad);
                    return (
                      <li key={l.clave} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_140px_130px_120px_40px] md:gap-x-3">
                        <span className="col-span-2 min-w-0 md:col-span-1">
                          <span className="block truncate text-sm font-semibold">{l.nombre}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className={cn("rounded px-1.5 py-px font-semibold", e.clase)}>{e.texto}</span>
                            <span className={GRIS}>
                              {l.detalle}
                              {l.stock !== null ? ` · stock ${formatoCantidad(l.stock)} → ${formatoCantidad(l.stock + cant)}` : ""}
                            </span>
                          </span>
                        </span>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${l.nombre}`} onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))} className="size-9 justify-self-end rounded-lg text-[#8A8799] hover:bg-[#FDECEC] hover:text-[#A32020] md:order-last">
                          <Trash2 className="size-4" />
                        </Button>
                        <span className="flex shrink-0 items-center justify-center gap-1">
                          <Button type="button" variant="outline" size="icon" aria-label="Restar" disabled={cant <= 1} onClick={() => sumarCantidad(l, -1)} className="size-8 rounded-lg border-[#E4E1F0]">
                            <Minus className="size-3.5" />
                          </Button>
                          <Input inputMode="decimal" aria-label={`Cantidad de ${l.nombre}`} value={l.cantidad} onChange={(ev) => cambiar(l.clave, { cantidad: ev.target.value.replace(/[^\d,.]/g, "") })} className="h-8 w-14 rounded-lg border-[#E4E1F0] px-1 text-center tabular-nums shadow-none" />
                          <Button type="button" variant="outline" size="icon" aria-label="Sumar" onClick={() => sumarCantidad(l, 1)} className="size-8 rounded-lg border-[#E4E1F0]">
                            <Plus className="size-3.5" />
                          </Button>
                        </span>
                        <span className="relative min-w-0">
                          <span className={cn("absolute top-1/2 left-2.5 -translate-y-1/2 text-sm", GRIS)}>$</span>
                          <Input inputMode="numeric" aria-label={`Precio de ${l.nombre}`} value={l.precio.toLocaleString("es-CL")} onChange={(ev) => cambiar(l.clave, { precio: aPesos(ev.target.value) })} className="h-8 rounded-lg border-[#E4E1F0] pl-6 text-right tabular-nums shadow-none" />
                        </span>
                        <span className="text-right text-sm font-semibold tabular-nums">{clp(cant * l.precio)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-[#DCD7EE] px-4 py-8 text-center">
                <FileText className="mx-auto size-6 text-[#B4B2C4]" aria-hidden />
                <p className="mt-2 text-sm font-medium">Aún no hay ítems</p>
                <p className={cn("text-xs", GRIS)}>Busca un material del inventario o agrega uno nuevo.</p>
              </div>
            )}
          </Seccion>
        </div>

        <aside className="lg:sticky lg:top-4">
          <div className={cn("overflow-hidden rounded-2xl bg-card", SOMBRA)}>
            <div className="border-b border-[#F0EEF6] px-5 py-4">
              <p className={cn("text-xs font-medium", GRIS)}>Resumen</p>
              <p className="truncate text-[15px] font-semibold">{nombreProveedor || "Sin proveedor"}</p>
              <p className={cn("text-xs", GRIS)}>
                {DOCUMENTOS_COMPRA.find((d) => d.valor === documento)?.texto}
                {folio ? ` N.° ${folio}` : ""} · {fechaCorta(fecha)}
              </p>
            </div>
            <dl className="flex flex-col gap-2 px-5 py-4 text-sm">
              <div className="flex justify-between">
                <dt className={GRIS}>
                  {lineas.length} ítem{lineas.length === 1 ? "" : "s"} · {conIva ? "neto" : "subtotal"}
                </dt>
                <dd className="tabular-nums">{clp(totales.subtotal)}</dd>
              </div>
              {conIva && (
                <div className="flex justify-between">
                  <dt className={GRIS}>IVA 19 %</dt>
                  <dd className="tabular-nums">{clp(totales.impuesto)}</dd>
                </div>
              )}
              <div className="mt-1 flex items-baseline justify-between border-t border-dashed border-[#DCD9E8] pt-3">
                <dt className="font-semibold">Total</dt>
                <dd className="text-[26px] font-semibold tabular-nums">{clp(totales.total)}</dd>
              </div>
            </dl>
            <div className="flex flex-col gap-2 border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-4 text-[13px]">
              <p className="flex items-start gap-2">
                <Box className="mt-0.5 size-4 shrink-0 text-[#0A7A52]" aria-hidden />
                <span>{conStock > 0 ? `${conStock} material${conStock === 1 ? "" : "es"} ${conStock === 1 ? "suma" : "suman"} stock al inventario` : "No cambia el inventario"}</span>
              </p>
              <p className="flex items-start gap-2">
                {pagada ? <Check className="mt-0.5 size-4 shrink-0 text-[#0A7A52]" aria-hidden /> : <Receipt className="mt-0.5 size-4 shrink-0 text-[#B86400]" aria-hidden />}
                <span>{pagada ? `Egreso de ${clp(totales.total)} en Caja (${medioTexto})` : `Queda por pagar${vence ? ` · vence ${fechaCorta(vence)}` : ""}`}</span>
              </p>
            </div>
            <div className="hidden flex-col gap-2 border-t border-[#F0EEF6] p-4 lg:flex">
              {faltas.length > 0 && (
                <ul className="mb-1 flex flex-col gap-1 text-xs text-[#8F4400]">
                  {faltas.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              )}
              {error && (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={faltas.length > 0 || pendiente} className="h-11 rounded-xl font-semibold">
                {pendiente && <Loader2 className="animate-spin" />}
                Registrar compra
              </Button>
              <Link href="/panel/compras" className="inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold hover:bg-muted">
                Cancelar
              </Link>
            </div>
          </div>
        </aside>

        {/* Barra fija en celular */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-[#E4E0F2] bg-white/95 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <div className="min-w-0 flex-1">
            <p className={cn("text-xs", GRIS)}>Total{conIva ? " con IVA" : ""}</p>
            <p className="text-lg font-semibold tabular-nums">{clp(totales.total)}</p>
            {error && (
              <p className="truncate text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" disabled={faltas.length > 0 || pendiente} className="h-11 rounded-xl px-5 font-semibold">
            {pendiente && <Loader2 className="animate-spin" />}
            Registrar compra
          </Button>
        </div>
      </form>

      {/*
        El modal va FUERA del formulario de la compra: dentro, el envío del proveedor subía hasta el de la compra,
        que lo interceptaba y no dejaba guardar al proveedor.
      */}
      {creandoProveedor && <ProveedorDialog proveedor={null} onCerrar={cerrarNuevoProveedor} />}
    </>
  );
}
