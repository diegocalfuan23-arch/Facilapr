"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { situacionSocio, type SituacionSocio } from "@/app/panel/ordenes/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatearRut, formatearTelefono } from "@/lib/formato";
import { formatearPeriodo } from "@/lib/boletas";
import { textoMedioPago } from "@/lib/pagos";
import { ESTADOS_ORDEN, TIPOS_ORDEN, type EstadoOrden, type TipoOrden } from "@/lib/ordenes";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fecha = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" });

const SERVICIO = {
  ACTIVO: { texto: "Servicio activo", clase: "bg-forest/10 text-forest" },
  CORTADO: { texto: "Servicio cortado", clase: "bg-destructive/10 text-destructive" },
  BAJA: { texto: "Dado de baja", clase: "bg-muted text-muted-foreground" },
} as const;

const VEREDICTO = {
  CUMPLE: { titulo: "Cumple lo que pide", icono: CheckCircle2, clase: "border-forest/30 bg-forest/5 text-forest" },
  NO_CUMPLE: { titulo: "No cumple lo que pide", icono: XCircle, clase: "border-destructive/30 bg-destructive/5 text-destructive" },
  REVISAR: { titulo: "Para revisar", icono: AlertTriangle, clase: "border-tertiary/40 bg-tertiary/10 text-tertiary-foreground" },
} as const;

/**
 * La situación de un socio para decidir su solicitud: sus datos, su deuda, sus
 * pagos y su servicio, con una lectura de si lo que pide procede. Es una ayuda;
 * la decisión es de la directiva.
 */
export function SituacionSocioDialog({
  ordenId,
  titulo,
  onCerrar,
}: {
  ordenId: string;
  titulo: string;
  onCerrar: () => void;
}) {
  const [datos, setDatos] = useState<SituacionSocio | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    situacionSocio(ordenId)
      .then((r) => vivo && setDatos(r))
      .catch(() => vivo && setDatos(null));
    return () => {
      vivo = false;
    };
  }, [ordenId]);

  const v = datos ? VEREDICTO[datos.veredicto.resultado] : null;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Situación de {titulo}</DialogTitle>
          <DialogDescription>Para decidir su solicitud con los datos a la vista.</DialogDescription>
        </DialogHeader>

        {datos === undefined ? (
          <div className="flex items-center gap-2 py-8 text-[0.9rem] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Revisando su situación…
          </div>
        ) : datos === null ? (
          <p className="py-6 text-[0.9rem] text-destructive">No pudimos cargar la situación de este socio.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {v && (
              <div className={cn("flex flex-col gap-1.5 rounded-lg border px-4 py-3", v.clase)}>
                <div className="flex items-center gap-2 font-semibold">
                  <v.icono className="size-[18px]" />
                  {TIPOS_ORDEN[datos.veredicto.tipo as TipoOrden]?.texto}: {v.titulo.toLowerCase()}
                </div>
                <ul className="list-disc pl-6 text-[0.84rem] text-foreground/80">
                  {datos.veredicto.motivos.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            <section className="grid gap-x-6 gap-y-2 text-[0.86rem] sm:grid-cols-2">
              <Dato etiqueta="Nombre" valor={datos.socio.nombre} />
              <Dato etiqueta="RUT" valor={datos.socio.rut ? formatearRut(datos.socio.rut) : "—"} />
              <Dato etiqueta="Tipo" valor={`${datos.socio.tipo === "USUARIO" ? "Usuario" : "Socio"} · ${datos.socio.uso === "COMERCIAL" ? "Comercial" : "Residencial"}`} />
              <Dato etiqueta="N.º de arranque" valor={datos.socio.numeroCliente ?? "—"} />
              <Dato etiqueta="Dirección" valor={datos.socio.direccion ?? "—"} />
              <Dato etiqueta="Teléfono" valor={datos.socio.telefono ? formatearTelefono(datos.socio.telefono) : "—"} />
              <Dato etiqueta="Cuenta en el portal" valor={datos.socio.conCuenta ? "Sí" : "No"} />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Servicio</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[0.76rem] font-semibold", SERVICIO[datos.servicio].clase)}>
                  {SERVICIO[datos.servicio].texto}
                </span>
              </div>
            </section>

            <section>
              <div className="mb-1.5 flex items-baseline justify-between">
                <h3 className="text-[0.9rem] font-semibold">Deuda y boletas</h3>
                <span className={cn("text-[0.9rem] font-semibold tabular-nums", datos.deuda > 0 ? "text-destructive" : "text-forest")}>
                  {datos.deuda > 0 ? `Debe ${clp.format(datos.deuda)}` : "Al día"}
                </span>
              </div>
              {datos.deudaOtrosArranques > 0 && (
                <p className="mb-1.5 text-[0.8rem] text-tertiary-foreground">
                  Otros arranques de la misma persona deben {clp.format(datos.deudaOtrosArranques)}.
                </p>
              )}
              {datos.boletas.length === 0 ? (
                <p className="text-[0.84rem] text-muted-foreground">Sin boletas emitidas.</p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60 text-[0.84rem]">
                  {datos.boletas.map((b) => (
                    <li key={b.periodo} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span>
                        {formatearPeriodo(b.periodo)}
                        <span className="ml-2 text-[0.76rem] text-muted-foreground">
                          {b.estado === "ANULADA" ? "anulada" : b.montoPagado >= b.montoTotal ? "pagada" : b.diasVencida > 0 ? `vencida hace ${b.diasVencida} días` : "pendiente"}
                        </span>
                      </span>
                      <span className="tabular-nums">
                        {clp.format(b.montoTotal)}
                        {b.montoPagado > 0 && b.montoPagado < b.montoTotal && (
                          <span className="ml-1.5 text-[0.76rem] text-muted-foreground">(abonó {clp.format(b.montoPagado)})</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-1.5 text-[0.9rem] font-semibold">Pagos recientes</h3>
              {datos.pagos.length === 0 ? (
                <p className="text-[0.84rem] text-muted-foreground">Sin pagos registrados.</p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60 text-[0.84rem]">
                  {datos.pagos.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span>
                        {fecha.format(new Date(p.fecha))} · {textoMedioPago(p.medio)}
                        {p.periodo && <span className="ml-2 text-[0.76rem] text-muted-foreground">{formatearPeriodo(p.periodo)}</span>}
                      </span>
                      <span className="font-medium tabular-nums text-forest">{clp.format(p.monto)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-1.5 text-[0.9rem] font-semibold">Solicitudes y órdenes anteriores</h3>
              {datos.solicitudes.length <= 1 ? (
                <p className="text-[0.84rem] text-muted-foreground">Esta es la única.</p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60 text-[0.84rem]">
                  {datos.solicitudes.map((o, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span>{TIPOS_ORDEN[o.tipo as TipoOrden]?.texto ?? o.tipo}</span>
                      <span className="text-[0.78rem] text-muted-foreground">
                        {ESTADOS_ORDEN[o.estado as EstadoOrden] ?? o.estado} · {fecha.format(new Date(o.creada))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="min-w-0 truncate font-medium">{valor}</span>
    </div>
  );
}
