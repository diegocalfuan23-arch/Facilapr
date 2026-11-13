"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cerrarPrestamo, crearPrestamo, eliminarPrestamo, type ResultadoPrestamos } from "@/app/panel/prestamos/actions";
import { Button } from "@/components/ui/button";
import { useConfirmar } from "@/components/ui/confirmar";
import { avisarCambio } from "@/lib/avisos-datos";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { TEXTO_TIPO_PRESTAMO, type PrestamoFila, type TipoPrestamo } from "@/lib/prestamos-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const mesCorto = (p: string) => p.split("-").reverse().join("-");
const selectClase =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Los anticipos y préstamos al personal: lo que falta por descontar y el detalle de cada uno. */
export function PrestamosVista({ prestamos, personas }: { prestamos: PrestamoFila[]; personas: { id: string; nombre: string }[] }) {
  const { confirmar, dialogo } = useConfirmar();
  const [creando, setCreando] = useState(false);
  const [trabajando, iniciar] = useTransition();
  const cerrar = useCallback(() => setCreando(false), []);

  const activos = prestamos.filter((p) => p.estado === "ACTIVO" && p.saldo > 0);
  const porDescontar = activos.reduce((s, p) => s + p.saldo, 0);

  async function cerrarUno(p: PrestamoFila) {
    if (!(await confirmar({ titulo: `¿Dejar de descontar el ${TEXTO_TIPO_PRESTAMO[p.tipo].toLowerCase()} de ${p.trabajador}?`, descripcion: `Quedan ${clp.format(p.saldo)} sin descontar. Lo ya descontado se mantiene.`, boton: "Cerrar", destructivo: false }))) return;
    iniciar(async () => {
      const r = await cerrarPrestamo(p.id);
      if (r.ok) toast.success("Cerrado");
      else toast.error(r.error);
    });
  }

  async function borrar(p: PrestamoFila) {
    if (!(await confirmar({ titulo: `¿Borrar el ${TEXTO_TIPO_PRESTAMO[p.tipo].toLowerCase()} de ${p.trabajador}?`, descripcion: p.costoEnCaja ? "También se quita la entrega de la Caja." : "No se puede deshacer.", boton: "Borrar" }))) return;
    iniciar(async () => {
      const r = await eliminarPrestamo(p.id);
      if (r.ok) {
        toast.success("Borrado");
        avisarCambio("caja");
      } else toast.error(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-3" data-tour="pre-kpis">
        <div className="rounded-xl border border-border bg-card px-6 py-4">
          <p className="text-[0.8rem] text-muted-foreground">Por descontar</p>
          <p className="mt-1 text-[1.5rem] leading-none font-bold tabular-nums">{clp.format(porDescontar)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-6 py-4">
          <p className="text-[0.8rem] text-muted-foreground">Vigentes</p>
          <p className="mt-1 text-[1.5rem] leading-none font-bold tabular-nums">{activos.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-6 py-4">
          <p className="text-[0.8rem] text-muted-foreground">Saldados o cerrados</p>
          <p className="mt-1 text-[1.5rem] leading-none font-bold tabular-nums">{prestamos.length - activos.length}</p>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.85rem] text-muted-foreground">{prestamos.length === 0 ? "Aún no hay anticipos ni préstamos." : `${prestamos.length} registro${prestamos.length === 1 ? "" : "s"}`}</p>
        <Button data-tour="pre-nuevo" className="h-10 rounded-full px-5 text-[0.95rem]" onClick={() => setCreando(true)} disabled={personas.length === 0}>
          + Nuevo anticipo o préstamo
        </Button>
      </div>

      {personas.length === 0 && <p className="text-[0.85rem] text-muted-foreground">Primero agrega personas en Personal.</p>}

      {prestamos.length > 0 && (
        <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-200 border-collapse text-[0.92rem]">
            <thead>
              <tr className="border-b border-border bg-card text-left text-muted-foreground">
                {["Persona", "Tipo", "Entregado", "Total", "Cuotas", "Saldo", "Estado", ""].map((c) => (
                  <th key={c} className="px-5 py-3 font-medium whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prestamos.map((p) => {
                const saldado = p.saldo <= 0;
                return (
                  <tr key={p.id} className={cn("border-b border-border last:border-0", (saldado || p.estado === "CERRADO") && "opacity-60")}>
                    <td className="px-5 py-3 font-medium whitespace-nowrap">{p.trabajador}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">{TEXTO_TIPO_PRESTAMO[p.tipo]}</td>
                    <td className="px-5 py-3 whitespace-nowrap tabular-nums text-muted-foreground">{fechaCorta(p.fecha)}</td>
                    <td className="px-5 py-3 whitespace-nowrap tabular-nums">{clp.format(p.monto)}</td>
                    <td className="px-5 py-3 whitespace-nowrap tabular-nums">
                      {p.cuotasDescontadas} de {p.cuotas}
                      <span className="text-[0.8rem] text-muted-foreground"> · {clp.format(p.cuotaMonto)}</span>
                    </td>
                    <td className="px-5 py-3 font-medium whitespace-nowrap tabular-nums">{clp.format(p.saldo)}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-[0.8rem] font-medium",
                          saldado ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : p.estado === "CERRADO" ? "bg-muted text-muted-foreground" : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                        )}
                      >
                        {saldado ? "Saldado" : p.estado === "CERRADO" ? "Cerrado" : `Desde ${mesCorto(p.primerPeriodo)}`}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="flex justify-end gap-1">
                        {p.estado === "ACTIVO" && !saldado && (
                          <Button variant="ghost" className="h-9 px-3 text-[0.85rem] text-muted-foreground" disabled={trabajando} onClick={() => void cerrarUno(p)}>
                            Cerrar
                          </Button>
                        )}
                        {p.cuotasDescontadas === 0 && (
                          <Button variant="ghost" className="h-9 px-3 text-[0.85rem] text-muted-foreground" disabled={trabajando} onClick={() => void borrar(p)}>
                            Borrar
                          </Button>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialogo}
      {creando && <PrestamoDialog personas={personas} onCerrar={cerrar} />}
    </div>
  );
}

function PrestamoDialog({ personas, onCerrar }: { personas: { id: string; nombre: string }[]; onCerrar: () => void }) {
  const [estado, enviar, pendiente] = useActionState<ResultadoPrestamos | null, FormData>(crearPrestamo, null);
  const [tipo, setTipo] = useState<TipoPrestamo>("ANTICIPO");
  const [monto, setMonto] = useState("");
  const [cuotas, setCuotas] = useState("1");

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Registrado");
      avisarCambio("caja");
      onCerrar();
    }
  }, [estado, onCerrar]);

  const hoy = hoyEnChile();
  const nCuotas = tipo === "ANTICIPO" ? 1 : Number(cuotas) || 1;
  const cuota = monto ? Math.ceil(Number(monto) / nCuotas) : 0;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-md sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Nuevo anticipo o préstamo</DialogTitle>
          <DialogDescription className="text-[0.9rem]">Plata que el comité entrega a una persona del personal y que se le descuenta de su sueldo.</DialogDescription>
        </DialogHeader>

        <form action={enviar} className="mt-2 flex flex-col gap-4">
          <input type="hidden" name="monto" value={monto} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="pr-persona">Persona</Label>
            <select id="pr-persona" name="trabajadorId" defaultValue="" className={selectClase} required>
              <option value="" disabled>
                Elige a la persona…
              </option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pr-tipo">Qué es</Label>
              <select id="pr-tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoPrestamo)} className={selectClase}>
                <option value="ANTICIPO">Anticipo (se descuenta de una vez)</option>
                <option value="PRESTAMO">Préstamo (en cuotas)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pr-monto">Monto</Label>
              <Input
                id="pr-monto"
                value={monto ? `$${Number(monto).toLocaleString("es-CL")}` : ""}
                onChange={(e) => setMonto(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="$0"
                inputMode="numeric"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {tipo === "PRESTAMO" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="pr-cuotas">Cuotas</Label>
                <Input id="pr-cuotas" name="cuotas" value={cuotas} onChange={(e) => setCuotas(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="pr-primer">{tipo === "ANTICIPO" ? "Se descuenta en el mes" : "Primera cuota en el mes"}</Label>
              <Input id="pr-primer" name="primerPeriodo" type="month" defaultValue={hoy.slice(0, 7)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pr-fecha">Fecha de entrega</Label>
              <Input id="pr-fecha" name="fecha" type="date" defaultValue={hoy} max={hoy} required />
            </div>
          </div>

          {cuota > 0 && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[0.85rem] text-muted-foreground">
              {nCuotas === 1 ? `Se descuenta ${clp.format(Number(monto))} en una sola liquidación.` : `${nCuotas} cuotas de ${clp.format(cuota)} (la última se ajusta para no pasarse).`} Nunca se descuenta más de lo que la persona gana ese mes: lo que no alcance queda para el siguiente.
            </p>
          )}

          <label className="flex items-start gap-2 text-[0.9rem]">
            <input type="checkbox" name="registrarEnCaja" value="si" defaultChecked className="mt-0.5 size-4" />
            <span>
              Anotar la entrega como egreso en la Caja
              <span className="mt-0.5 block text-[0.75rem] text-muted-foreground">Desmárcalo si la plata ya salió antes de usar Facilapr.</span>
            </span>
          </label>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pr-nota">Nota (opcional)</Label>
            <Input id="pr-nota" name="nota" maxLength={200} />
          </div>

          {estado && !estado.ok && (
            <p className="text-[0.85rem] text-destructive" role="alert">
              {estado.error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" className="h-10 rounded-full px-5 text-[0.95rem]" disabled={pendiente || !monto}>
              {pendiente && <Loader2 className="animate-spin" />}
              Registrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
