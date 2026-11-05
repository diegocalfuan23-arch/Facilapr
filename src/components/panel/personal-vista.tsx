"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrabajadorDialog } from "@/components/panel/trabajador-dialog";
import { TEXTO_CONTRATO, descuentosLegales, type TrabajadorFila } from "@/lib/personal-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const alto = "h-10";
const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";

/** La ficha de las personas del comité. Sus sueldos se pagan en Remuneraciones. */
export function PersonalVista({ personas }: { personas: TrabajadorFila[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<TrabajadorFila | null>(null);
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
  }, []);

  const activas = personas.filter((p) => p.activo);
  const costoMensual = activas.reduce((s, p) => s + p.sueldo, 0);

  const q = busqueda.trim().toLowerCase();
  const filtradas = personas.filter((p) => !q || p.nombre.toLowerCase().includes(q) || p.cargo.toLowerCase().includes(q) || (p.rut ?? "").toLowerCase().includes(q));

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Personas activas</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{activas.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Costo mensual</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{clp.format(costoMensual)}</p>
          <p className="mt-2 text-[0.8rem] text-muted-foreground">Suma de sus sueldos brutos</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Inactivas</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{personas.length - activas.length}</p>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, cargo o RUT…"
          className={cn(alto, "rounded-full px-5 text-[0.95rem] sm:w-96")}
          aria-label="Buscar"
        />
        <Button className={cn(alto, "rounded-full px-5 text-[0.95rem]")} onClick={() => setCreando(true)}>
          + Nueva persona
        </Button>
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">{personas.length === 0 ? "Sin personas registradas" : "Nada coincide con la búsqueda"}</p>
          {personas.length === 0 && (
            <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">
              Agrega a quienes trabajan para el comité. Con ellas llevas sus remuneraciones, vacaciones, licencias y asistencia.
            </p>
          )}
        </div>
      ) : (
        <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-200 border-collapse text-[0.95rem]">
            <thead>
              <tr className="border-b border-border bg-card">
                {["Nombre", "Cargo", "Forma de pago", "Sueldo bruto", "Descuentos", "Líquido", "Ingreso"].map((c) => (
                  <th key={c} className="px-5 py-4 text-left font-medium whitespace-nowrap text-muted-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => (
                <tr key={p.id} onClick={() => setEditando(p)} className={cn("cursor-pointer border-b border-border last:border-0 hover:bg-card/50", !p.activo && "opacity-60")}>
                  <td className="px-5 py-4 font-medium whitespace-nowrap">
                    {p.nombre}
                    {!p.activo && <span className="ml-2 text-[0.8rem] font-normal text-muted-foreground">(inactiva)</span>}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{p.cargo}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{TEXTO_CONTRATO[p.contrato]}</td>
                  <td className="px-5 py-4 whitespace-nowrap tabular-nums">{clp.format(p.sueldo)}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">-{clp.format(descuentosLegales(p, p.sueldo).total)}</td>
                  <td className="px-5 py-4 font-medium whitespace-nowrap tabular-nums">{clp.format(p.sueldo - descuentosLegales(p, p.sueldo).total)}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">{p.fechaIngreso ? fechaCorta(p.fechaIngreso) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creando || editando) && <TrabajadorDialog key={editando?.id ?? "nueva"} persona={editando} onCerrar={cerrar} />}
    </div>
  );
}
