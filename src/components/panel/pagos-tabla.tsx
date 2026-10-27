"use client";

import { useMemo, useState } from "react";
import { FileDown, Link2, Plus, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatearPeriodo } from "@/lib/boletas";
import { formatearRut } from "@/lib/formato";
import { MEDIOS_PAGO, textoConcepto, textoMedioPago } from "@/lib/pagos";
import { NuevoPagoDialog, type BoletaPendiente } from "@/components/panel/nuevo-pago-dialog";
import { LinkPagoDialog } from "@/components/panel/link-pago-dialog";
import type { OpcionSocio } from "@/components/panel/socio-buscador";
import type { DatosComiteWhatsApp } from "@/lib/whatsapp";

export type PagoFila = {
  id: string;
  monto: number;
  /** ISO. */
  fecha: string;
  medio: string;
  referencia: string | null;
  /** Quien pagó, si no es el titular. */
  pagadoPor: string | null;
  /** Null en un cobro que no es una boleta. */
  periodo: string | null;
  /** BOLETA, RECONEXION, REPARACION u OTRO. */
  concepto: string;
  descripcion: string | null;
  /** El pago es parte de un acuerdo de pago (repactación). */
  repactacionId: string | null;
  socioNombre: string;
  socioRut: string | null;
  /** SOCIO o USUARIO: de quién es la cuenta que se pagó. */
  socioTipo: string;
  /** El usuario del panel que registró el pago; null en los antiguos. */
  registradoPor: string | null;
  comprobanteUrl: string;
};

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const fechaLarga = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const POR_PAGINA = 25;

/** Qué se pagó: el mes de la boleta, o el concepto (con su detalle) si no fue una boleta. */
function queSePago(p: PagoFila) {
  if (p.periodo) return `${formatearPeriodo(p.periodo)}${p.repactacionId ? " · repactación" : ""}`;
  return p.descripcion ? `${textoConcepto(p.concepto)} (${p.descripcion})` : textoConcepto(p.concepto);
}

const sinTildes = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Todos los pagos que ha registrado el comité, con búsqueda y filtro por medio. */
export function PagosTabla({
  pagos,
  socios,
  todosLosSocios,
  costoReconexion,
  resumen,
  boletasPendientes,
  comite,
  mpConectado = false,
  mpHabilitado = false,
  estadoMp,
}: {
  pagos: PagoFila[];
  /** Cuántos socios están al día y cuántos tienen deuda vencida (y por cuánto). */
  resumen: { morosos: number; deudaVencida: number; alDia: number };
  socios: OpcionSocio[];
  todosLosSocios: OpcionSocio[];
  costoReconexion: number | null;
  boletasPendientes: BoletaPendiente[];
  comite: DatosComiteWhatsApp;
  /** El comité conectó su cuenta de Mercado Pago: se puede cobrar con link de pago. */
  mpConectado?: boolean;
  /** El comité tiene prendida la conexión con Mercado Pago (aunque aún no la haya hecho). */
  mpHabilitado?: boolean;
  /** Franja de estado de Mercado Pago (aviso tras conectar, cuenta conectada), bajo el encabezado. */
  estadoMp?: React.ReactNode;
}) {
  const [registrando, setRegistrando] = useState(false);
  const [conLink, setConLink] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [medio, setMedio] = useState<string>("todos");
  const [visibles, setVisibles] = useState(POR_PAGINA);

  const ahora = new Date();
  const delMes = pagos.filter((p) => {
    const f = new Date(p.fecha);
    return f.getFullYear() === ahora.getFullYear() && f.getMonth() === ahora.getMonth();
  });
  const totalMes = delMes.reduce((acc, p) => acc + p.monto, 0);

  const filtrados = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return pagos.filter((p) => {
      if (medio !== "todos" && p.medio !== medio) return false;
      if (!q) return true;
      return sinTildes(
        `${p.socioNombre} ${p.socioRut ?? ""} ${p.referencia ?? ""} ${queSePago(p)} ${p.pagadoPor ?? ""} ${p.registradoPor ?? ""}`
      ).includes(q);
    });
  }, [pagos, busqueda, medio]);

  const totalFiltrado = filtrados.reduce((acc, p) => acc + p.monto, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-tight">Pagos</h1>
          <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
            Todo lo que han pagado tus socios, con su comprobante.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mpConectado ? (
            <Button variant="outline" onClick={() => setConLink(true)}>
              <Link2 />
              Link de pago
            </Button>
          ) : (
            mpHabilitado && (
              <Button variant="outline" render={<a href="/api/mercadopago/conectar" />}>
                <Link2 />
                Conectar Mercado Pago
              </Button>
            )
          )}
          <Button data-tour="pag-registrar" onClick={() => setRegistrando(true)}>
            <Plus />
            Registrar pago
          </Button>
        </div>
      </div>

      {estadoMp}

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        {[
          { etiqueta: "Recaudado este mes", valor: clp.format(totalMes), nota: null, tono: "" },
          { etiqueta: "Pagos este mes", valor: String(delMes.length), nota: null, tono: "" },
          {
            etiqueta: "Socios al día",
            valor: String(resumen.alDia),
            nota: "sin deuda vencida",
            tono: "text-forest",
          },
          {
            etiqueta: "Socios morosos",
            valor: String(resumen.morosos),
            nota: resumen.morosos > 0 ? `${clp.format(resumen.deudaVencida)} vencidos` : "nadie debe",
            tono: resumen.morosos > 0 ? "text-destructive" : "",
          },
        ].map((k) => (
          <div key={k.etiqueta} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[0.8rem] text-muted-foreground">{k.etiqueta}</div>
            <div className={cn("mt-1 text-[1.4rem] font-semibold tabular-nums", k.tono)}>{k.valor}</div>
            {k.nota && <div className="mt-0.5 text-[0.76rem] text-muted-foreground tabular-nums">{k.nota}</div>}
          </div>
        ))}
      </div>

      {pagos.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted">
            <Wallet className="size-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 text-[1rem] font-semibold">Aún no hay pagos registrados</h2>
          <p className="mt-2 max-w-[48ch] text-[0.92rem] leading-relaxed text-muted-foreground">
            Cuando un socio pague, toca “Registrar pago”, busca al socio y elige su
            boleta, o una reposición, reparación u otro cobro. Aquí quedará el historial y el comprobante para enviarle.
          </p>
        </div>
      ) : (
        <div data-tour="pag-lista" className="rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center gap-3 p-3 sm:p-5">
            <div className="relative w-full sm:min-w-60 sm:flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setVisibles(POR_PAGINA);
                }}
                placeholder="Buscar por socio, quién pagó, RUT, período o N.º de operación…"
                aria-label="Buscar pagos"
                className="h-10 border-transparent bg-muted/60 pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[{ valor: "todos", texto: "Todos" }, ...MEDIOS_PAGO].map((m) => (
                <button
                  key={m.valor}
                  type="button"
                  onClick={() => {
                    setMedio(m.valor);
                    setVisibles(POR_PAGINA);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[0.8rem] font-medium transition-colors",
                    medio === m.valor
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m.texto}
                </button>
              ))}
            </div>
          </div>

          {filtrados.length === 0 ? (
            <p className="border-t border-border/60 px-5 py-10 text-center text-[0.9rem] text-muted-foreground">
              No hay pagos con ese filtro.
            </p>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-border/60 border-t border-border/60 md:hidden">
                {filtrados.slice(0, visibles).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-3 py-3.5 sm:px-5"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{p.socioNombre}</span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
                          {p.socioTipo === "USUARIO" ? "Usuario" : "Socio"}
                        </span>
                        {p.repactacionId && (
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[0.68rem] font-medium text-primary">
                            Repactación
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[0.8rem] text-muted-foreground">
                        {fechaLarga.format(new Date(p.fecha))} · {textoMedioPago(p.medio)} ·{" "}
                        {queSePago(p)}
                        {p.socioRut ? ` · ${formatearRut(p.socioRut)}` : ""}
                        {p.pagadoPor ? ` · pagó ${p.pagadoPor}` : " · pagó el titular"}
                        {p.referencia ? ` · Op. ${p.referencia}` : ""}
                        {p.registradoPor ? ` · registró ${p.registradoPor}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-[0.95rem] font-semibold text-forest tabular-nums">
                        {clp.format(p.monto)}
                      </span>
                      <a
                        href={p.comprobanteUrl}
                        target="_blank"
                        rel="noopener"
                        aria-label={`Comprobante de ${p.socioNombre}`}
                        title="Ver comprobante"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <FileDown className="size-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto border-t border-border/60 md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-11 px-4">Fecha</TableHead>
                      <TableHead className="h-11 px-4">Socio o usuario</TableHead>
                      <TableHead className="h-11 px-4">Concepto</TableHead>
                      <TableHead className="h-11 px-4">Medio</TableHead>
                      <TableHead className="h-11 px-4">Pagó</TableHead>
                      <TableHead className="h-11 px-4">Registró</TableHead>
                      <TableHead className="h-11 px-4">N.º op.</TableHead>
                      <TableHead className="h-11 px-4 text-right">Monto</TableHead>
                      <TableHead className="h-11 w-12 px-4">
                        <span className="sr-only">Comprobante</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.slice(0, visibles).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="px-4 whitespace-nowrap">{fechaLarga.format(new Date(p.fecha))}</TableCell>
                        <TableCell className="px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.socioNombre}</span>
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
                              {p.socioTipo === "USUARIO" ? "Usuario" : "Socio"}
                            </span>
                          </div>
                          {p.socioRut && (
                            <div className="text-[0.76rem] text-muted-foreground">{formatearRut(p.socioRut)}</div>
                          )}
                        </TableCell>
                        <TableCell className="px-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{p.periodo ? formatearPeriodo(p.periodo) : queSePago(p)}</span>
                            {p.repactacionId && (
                              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[0.68rem] font-medium text-primary">
                                Repactación
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4">{textoMedioPago(p.medio)}</TableCell>
                        <TableCell className="px-4">
                          {p.pagadoPor ?? <span className="text-muted-foreground">El titular</span>}
                        </TableCell>
                        <TableCell className="px-4">
                          {p.registradoPor ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-4 font-mono text-[0.82rem]">
                          {p.referencia ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-4 text-right font-mono font-semibold text-forest tabular-nums">
                          {clp.format(p.monto)}
                        </TableCell>
                        <TableCell className="px-4">
                          <a
                            href={p.comprobanteUrl}
                            target="_blank"
                            rel="noopener"
                            aria-label={`Comprobante de ${p.socioNombre}`}
                            title="Ver comprobante"
                            className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <FileDown className="size-4" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-3 py-3 text-[0.82rem] text-muted-foreground sm:px-5">
                <span>
                  {filtrados.length} pago{filtrados.length === 1 ? "" : "s"} ·{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {clp.format(totalFiltrado)}
                  </span>
                </span>
                {visibles < filtrados.length && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibles((v) => v + POR_PAGINA)}
                  >
                    Ver más
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {conLink && (
        <LinkPagoDialog socios={socios} boletas={boletasPendientes} comite={comite} onCerrar={() => setConLink(false)} />
      )}

      {registrando && (
        <NuevoPagoDialog
          socios={socios}
          todosLosSocios={todosLosSocios}
          costoReconexion={costoReconexion}
          boletas={boletasPendientes}
          comite={comite}
          onCerrar={() => setRegistrando(false)}
        />
      )}
    </div>
  );
}
