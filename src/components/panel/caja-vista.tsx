"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { eliminarMovimiento } from "@/app/panel/finanzas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CerrarCajaDialog } from "@/components/panel/cerrar-caja-dialog";
import { NuevoMovimientoDialog } from "@/components/panel/nuevo-movimiento-dialog";
import { SaldoInicialDialog } from "@/components/panel/saldo-inicial-dialog";
import { diaVecino, textoMedioLinea, type LineaLibro, type ResumenDia } from "@/lib/finanzas-comun";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

const selectClase =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

const etiquetaTarjeta = "text-[0.75rem] font-medium tracking-wide uppercase";

const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");

/**
 * La Caja de un día, igual que la de MecánicoApp: con cuánta plata se empezó, lo que
 * entró y salió, y con cuánta se termina; se puede buscar, filtrar y cerrar la caja.
 * Los pagos de socios entran solos; el resto se anota a mano.
 */
export function CajaVista({
  resumen,
  lineas,
  saldoInicial,
}: {
  resumen: ResumenDia;
  lineas: LineaLibro[];
  saldoInicial: { monto: number; fecha: string } | null;
}) {
  const router = useRouter();
  const [, navegar] = useTransition();
  const [borrando, iniciar] = useTransition();
  const [diaLocal, setDiaLocal] = useState(resumen.dia);
  const [diaSincronizado, setDiaSincronizado] = useState(resumen.dia);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroOrigen, setFiltroOrigen] = useState("todos");
  const [registrando, setRegistrando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [definiendoSaldo, setDefiniendoSaldo] = useState(false);
  const cerrarRegistro = useCallback(() => setRegistrando(false), []);
  const cerrarCierre = useCallback(() => setCerrando(false), []);
  const cerrarSaldo = useCallback(() => setDefiniendoSaldo(false), []);

  // El selector se actualiza al instante y la navegación corre detrás, sin esperar al servidor.
  if (resumen.dia !== diaSincronizado) {
    setDiaSincronizado(resumen.dia);
    setDiaLocal(resumen.dia);
  }

  function irA(dia: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return;
    setDiaLocal(dia);
    navegar(() => router.push(`/panel/caja?dia=${dia}`));
  }

  function borrar(l: LineaLibro) {
    if (!window.confirm(`¿Borrar «${l.concepto}»? No se puede deshacer.`)) return;
    iniciar(async () => {
      const r = await eliminarMovimiento(l.id.replace("mov:", ""));
      if (r.ok) toast.success("Movimiento borrado");
      else toast.error(r.error);
    });
  }

  const q = busqueda.trim().toLowerCase();
  const filtradas = lineas.filter((l) => {
    if (filtroTipo !== "todos" && l.tipo !== filtroTipo) return false;
    if (filtroOrigen === "pago" && !l.automatico) return false;
    if (filtroOrigen === "manual" && l.automatico) return false;
    if (
      q &&
      !l.concepto.toLowerCase().includes(q) &&
      !l.referencia?.toLowerCase().includes(q) &&
      !l.contraparte?.toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  const cerrada = resumen.cierre !== null;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => irA(diaVecino(diaLocal, -1))}
            aria-label="Día anterior"
            className="flex size-9 items-center justify-center rounded-lg border hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <Input type="date" value={diaLocal} onChange={(e) => irA(e.target.value)} className="w-auto" />
          <button
            type="button"
            onClick={() => irA(diaVecino(diaLocal, 1))}
            aria-label="Día siguiente"
            className="flex size-9 items-center justify-center rounded-lg border hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCerrando(true)}>
            {cerrada ? "Caja cerrada" : "Cerrar caja"}
          </Button>
          <Button onClick={() => setRegistrando(true)}>+ Registrar movimiento</Button>
        </div>
      </div>

      {resumen.disponibleAnterior === null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
          <span className="text-[0.85rem] text-muted-foreground">
            {saldoInicial
              ? `El saldo inicial es del ${fechaCorta(saldoInicial.fecha)}: de ese día en adelante se ve la plata disponible.`
              : "Define con cuánta plata partes y verás el disponible de cada día."}
          </span>
          {!saldoInicial && (
            <Button variant="outline" size="sm" onClick={() => setDefiniendoSaldo(true)}>
              Definir saldo inicial
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className={`${etiquetaTarjeta} text-muted-foreground`}>Disponible anterior</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {resumen.disponibleAnterior === null ? "—" : clp.format(resumen.disponibleAnterior)}
          </p>
        </div>
        <div className="rounded-xl border border-forest/30 bg-forest/5 p-4">
          <p className={`${etiquetaTarjeta} text-forest`}>Total ingresos</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-forest">{clp.format(resumen.ingresos)}</p>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className={`${etiquetaTarjeta} text-destructive`}>Total egresos</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-destructive">{clp.format(resumen.egresos)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className={`${etiquetaTarjeta} text-muted-foreground`}>Disponible del día</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {resumen.disponibleDelDia === null ? "—" : clp.format(resumen.disponibleDelDia)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por descripción, socio o referencia…"
          className="sm:w-72"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className={`${selectClase} sm:w-48`}
            aria-label="Tipo"
          >
            <option value="todos">Todos los tipos</option>
            <option value="INGRESO">Ingresos</option>
            <option value="EGRESO">Egresos</option>
          </select>
          <select
            value={filtroOrigen}
            onChange={(e) => setFiltroOrigen(e.target.value)}
            className={`${selectClase} sm:w-48`}
            aria-label="Origen"
          >
            <option value="todos">Todos los orígenes</option>
            <option value="pago">Pago de socio</option>
            <option value="manual">Manual</option>
          </select>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="font-medium">Sin movimientos de caja</p>
          <p className="mt-2 text-[0.9rem] text-muted-foreground">
            Los pagos de socios aparecerán aquí al registrarlos, y los egresos o ingresos manuales al anotarlos.
          </p>
          <Button onClick={() => setRegistrando(true)} className="mt-4">
            + Registrar movimiento
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 border-collapse text-[0.875rem]">
            <thead>
              <tr className="border-b bg-card">
                {["Descripción", "Tipo", "Origen", "Medio", "Monto"].map((c) => (
                  <th key={c} className="px-4 py-3 text-left font-medium whitespace-nowrap text-muted-foreground">
                    {c}
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-card/50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{l.concepto}</div>
                    {(l.contraparte || l.referencia) && (
                      <div className="text-[0.78rem] text-muted-foreground">
                        {[l.contraparte, l.referencia ? `N.° ${l.referencia}` : null].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-1 text-[0.75rem] font-medium ${
                        l.tipo === "INGRESO" ? "bg-forest/10 text-forest" : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {l.tipo === "INGRESO" ? "Ingreso" : "Egreso"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {l.automatico ? "Pago de socio" : "Manual"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{textoMedioLinea(l.medio)}</td>
                  <td
                    className={`px-4 py-3 font-medium whitespace-nowrap tabular-nums ${
                      l.tipo === "INGRESO" ? "text-forest" : "text-destructive"
                    }`}
                  >
                    {l.tipo === "INGRESO" ? "+" : "-"}
                    {clp.format(l.monto)}
                  </td>
                  <td className="px-2 py-3">
                    {!l.automatico && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Borrar movimiento"
                        disabled={borrando}
                        onClick={() => borrar(l)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {registrando && <NuevoMovimientoDialog tipoInicial="EGRESO" fecha={resumen.dia} onCerrar={cerrarRegistro} />}
      {cerrando && <CerrarCajaDialog resumen={resumen} movimientos={lineas.length} onCerrar={cerrarCierre} />}
      {definiendoSaldo && <SaldoInicialDialog actual={saldoInicial} onCerrar={cerrarSaldo} />}
    </>
  );
}
