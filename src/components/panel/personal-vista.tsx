"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { anularPagoTrabajador } from "@/app/panel/personal/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PagoTrabajadorDialog } from "@/components/panel/pago-trabajador-dialog";
import { TrabajadorDialog } from "@/components/panel/trabajador-dialog";
import { textoMedioLinea } from "@/lib/finanzas-comun";
import { TEXTO_CONTRATO, type PagoTrabajadorFila, type TrabajadorFila } from "@/lib/personal-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const alto = "h-10";
const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";
const AMBAR_TARJ = "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10";
const AMBAR_TXT = "text-amber-800 dark:text-amber-300";

/**
 * El personal del comité, con el diseño de Compras: KPI, pestañas Personal y Pagos, buscador y tabla.
 * Cada pago a una persona queda como egreso en la Caja.
 */
export function PersonalVista({
  personas,
  pagos,
  periodo,
  mesTexto,
}: {
  personas: TrabajadorFila[];
  pagos: PagoTrabajadorFila[];
  /** El mes que se mira, AAAA-MM. */
  periodo: string;
  mesTexto: string;
}) {
  const [pestana, setPestana] = useState<"personal" | "pagos">("personal");
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<TrabajadorFila | null>(null);
  const [pagando, setPagando] = useState<TrabajadorFila | null>(null);
  const [anulando, iniciarAnulacion] = useTransition();
  const cerrarFicha = useCallback(() => {
    setCreando(false);
    setEditando(null);
  }, []);
  const cerrarPago = useCallback(() => setPagando(null), []);

  const activas = personas.filter((p) => p.activo);
  const comprometido = activas.reduce((s, p) => s + p.sueldo, 0);
  const pagadoMes = personas.reduce((s, p) => s + p.pagadoMes, 0);
  const pendiente = activas.reduce((s, p) => s + Math.max(p.sueldo - p.pagadoMes, 0), 0);

  const q = busqueda.trim().toLowerCase();
  const personasFiltradas = personas.filter((p) => !q || p.nombre.toLowerCase().includes(q) || p.cargo.toLowerCase().includes(q) || (p.rut ?? "").toLowerCase().includes(q));
  const pagosFiltrados = pagos.filter((p) => !q || p.trabajador.toLowerCase().includes(q) || p.periodo.includes(q));

  function anular(p: PagoTrabajadorFila) {
    if (!window.confirm(`¿Anular el pago de ${clp.format(p.monto)} a ${p.trabajador}? También se quita de la Caja.`)) return;
    iniciarAnulacion(async () => {
      const r = await anularPagoTrabajador(p.id);
      if (r.ok) toast.success("Pago anulado");
      else toast.error(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Personas activas</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{activas.length}</p>
          <p className="mt-2 text-[0.8rem] text-muted-foreground">{clp.format(comprometido)} al mes</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className={cn(etiquetaKpi, "text-emerald-800 dark:text-emerald-300")}>Pagado en {mesTexto}</p>
          <p className="mt-3 text-[2rem] leading-none font-bold text-emerald-800 tabular-nums dark:text-emerald-300">{clp.format(pagadoMes)}</p>
        </div>
        <div className={cn("rounded-xl border p-5", pendiente > 0 ? AMBAR_TARJ : "border-border bg-card")}>
          <p className={cn(etiquetaKpi, pendiente > 0 ? AMBAR_TXT : "text-muted-foreground")}>Por pagar este mes</p>
          <p className={cn("mt-3 text-[2rem] leading-none font-bold tabular-nums", pendiente > 0 && AMBAR_TXT)}>{clp.format(pendiente)}</p>
        </div>
      </section>

      <div className="flex w-full gap-1 rounded-xl border border-border p-1 sm:w-fit" role="tablist" aria-label="Sección">
        {(
          [
            ["personal", "Personal"],
            ["pagos", "Pagos"],
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
          placeholder={pestana === "personal" ? "Buscar por nombre, cargo o RUT…" : "Buscar por persona o mes…"}
          className={cn(alto, "rounded-full px-5 text-[0.95rem] sm:w-96")}
          aria-label="Buscar"
        />
        <Button className={cn(alto, "rounded-full px-5 text-[0.95rem]")} onClick={() => setCreando(true)}>
          + Nueva persona
        </Button>
      </div>

      {pestana === "personal" ? (
        personasFiltradas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-20 text-center">
            <p className="text-[1.05rem] font-medium">{personas.length === 0 ? "Sin personas registradas" : "Nada coincide con la búsqueda"}</p>
            {personas.length === 0 && (
              <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">
                Agrega a quienes trabajan para el comité (operador, tesorero…) para llevar sus pagos y que queden en la Caja.
              </p>
            )}
          </div>
        ) : (
          <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-160 border-collapse text-[0.95rem]">
              <thead>
                <tr className="border-b border-border bg-card">
                  {["Nombre", "Cargo", "Forma de pago", "Monto mensual", `Estado de ${mesTexto}`, ""].map((c) => (
                    <th key={c} className="px-5 py-4 text-left font-medium whitespace-nowrap text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personasFiltradas.map((p) => {
                  const completo = p.sueldo > 0 && p.pagadoMes >= p.sueldo;
                  return (
                    <tr key={p.id} onClick={() => setEditando(p)} className="cursor-pointer border-b border-border last:border-0 hover:bg-card/50">
                      <td className="px-5 py-4 font-medium whitespace-nowrap">
                        {p.nombre}
                        {!p.activo && <span className="ml-2 text-[0.8rem] font-normal text-muted-foreground">(inactivo)</span>}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{p.cargo}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{TEXTO_CONTRATO[p.contrato]}</td>
                      <td className="px-5 py-4 whitespace-nowrap tabular-nums">{clp.format(p.sueldo)}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {!p.activo ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-[0.8rem] font-medium",
                              completo
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                            )}
                          >
                            {completo ? "Pagado" : p.pagadoMes > 0 ? `Pagado ${clp.format(p.pagadoMes)}` : "Por pagar"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {p.activo && (
                          <Button
                            variant="outline"
                            className="h-9 rounded-full px-4 text-[0.85rem]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPagando(p);
                            }}
                          >
                            Pagar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : pagosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">{pagos.length === 0 ? "Sin pagos registrados" : "Nada coincide con la búsqueda"}</p>
        </div>
      ) : (
        <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-160 border-collapse text-[0.95rem]">
            <thead>
              <tr className="border-b border-border bg-card">
                {["Fecha", "Persona", "Mes", "Medio", "Monto", ""].map((c) => (
                  <th key={c} className="px-5 py-4 text-left font-medium whitespace-nowrap text-muted-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-card/50">
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">{fechaCorta(p.fecha)}</td>
                  <td className="px-5 py-4 font-medium whitespace-nowrap">
                    {p.trabajador}
                    {p.nota && <span className="ml-2 text-[0.8rem] font-normal text-muted-foreground">{p.nota}</span>}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">{p.periodo}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{textoMedioLinea(p.medio)}</td>
                  <td className="px-5 py-4 font-medium whitespace-nowrap tabular-nums">{clp.format(p.monto)}</td>
                  <td className="px-2 py-4">
                    <Button variant="ghost" size="icon-sm" aria-label="Anular pago" disabled={anulando} onClick={() => anular(p)} className="text-muted-foreground">
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creando || editando) && <TrabajadorDialog key={editando?.id ?? "nueva"} persona={editando} onCerrar={cerrarFicha} />}
      {pagando && <PagoTrabajadorDialog key={pagando.id} persona={pagando} periodo={periodo} onCerrar={cerrarPago} />}
    </div>
  );
}
