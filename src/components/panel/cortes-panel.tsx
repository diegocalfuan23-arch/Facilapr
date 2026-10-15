"use client";

import { useEffect, useState, useTransition } from "react";
import { Camera, Check, Eye, Loader2, MessageCircle, Plus, Scissors } from "lucide-react";
import { toast } from "sonner";
import {
  cancelarOrden,
  darDeAlta,
  deudaDeArranque,
  ordenarCorte,
  pedirOtraEvidencia,
  resolverSolicitud,
  solicitarOrden,
  type ResultadoOrden,
} from "@/app/panel/ordenes/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatearRut } from "@/lib/formato";
import { ESTADOS_ORDEN, TIPOS_ORDEN, type TipoCampo } from "@/lib/ordenes";
import type { MorosoFila, OrdenFila } from "@/lib/ordenes-datos";
import {
  enlaceWhatsApp,
  mensajeAvisoCorte,
  mensajeCorteRealizado,
  mensajeReanudacion,
  mensajeReposicion,
  mensajeRespuestaSolicitud,
  telefonoValidoParaWhatsApp,
  type DatosComiteWhatsApp,
} from "@/lib/whatsapp";
import { SituacionSocioDialog } from "@/components/panel/situacion-socio-dialog";
import { EvidenciaDialog } from "@/components/panel/evidencia-dialog";
import { NuevaOrdenDialog } from "@/components/panel/nueva-orden-dialog";
import type { OpcionSocio } from "@/components/panel/socio-buscador";
import {
  RepactacionesPanel,
  type RepactacionFila,
  type SocioConDeuda,
} from "@/components/panel/repactaciones-panel";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fecha = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Pestana = "morosos" | "repactaciones" | "tramite" | "alta" | "solicitudes" | "cortados" | "historial";

/**
 * Cortes y órdenes de terreno del comité. La directiva ordena el corte de un
 * moroso, el técnico (o el presidente) sube la foto del medidor cortado y la
 * directiva da de alta. Las reposiciones y reparaciones las puede pedir también
 * el técnico, y aquí se aprueban.
 */
export function CortesPanel({
  ordenes,
  cortados,
  morosos,
  acuerdosAlDia,
  repactaciones,
  sociosConDeuda,
  socios,
  diasGracia,
  comite,
}: {
  /** Los acuerdos de pago con socios morosos, y con quién se puede hacer uno nuevo. */
  repactaciones: RepactacionFila[];
  sociosConDeuda: SocioConDeuda[];
  ordenes: OrdenFila[];
  cortados: OrdenFila[];
  morosos: MorosoFila[];
  /** Cuántos socios tienen un acuerdo de pago al día: no se listan como morosos. */
  acuerdosAlDia: number;
  socios: OpcionSocio[];
  diasGracia: number;
  comite: DatosComiteWhatsApp & { diasAviso: number; costoReconexion: number | null };
}) {
  const [pestana, setPestana] = useState<Pestana>(morosos.length > 0 ? "morosos" : "tramite");
  const [creando, setCreando] = useState(false);
  const [ejecutando, setEjecutando] = useState<OrdenFila | null>(null);
  const [viendo, setViendo] = useState<OrdenFila | null>(null);
  const [resolviendo, setResolviendo] = useState<{ orden: OrdenFila; aprobar: boolean } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const tramite = ordenes.filter((o) => o.estado === "EN_TRAMITE");
  const porAlta = ordenes.filter((o) => o.estado === "POR_CONFIRMAR");
  const solicitudes = ordenes.filter((o) => o.estado === "SOLICITADA");
  const historial = ordenes.filter((o) => ["COMPLETADA", "RECHAZADA", "CANCELADA"].includes(o.estado));

  const pestanas: { id: Pestana; texto: string; n: number }[] = [
    { id: "morosos", texto: "Morosos", n: morosos.length },
    { id: "repactaciones", texto: "Repactaciones", n: repactaciones.filter((r) => r.estado === "ACTIVA").length },
    { id: "tramite", texto: "En trámite", n: tramite.length },
    { id: "alta", texto: "Por dar de alta", n: porAlta.length },
    { id: "solicitudes", texto: "Solicitudes", n: solicitudes.length },
    { id: "cortados", texto: "Cortados", n: cortados.length },
    { id: "historial", texto: "Historial", n: historial.length },
  ];

  /** Abre WhatsApp con el mensaje ya escrito: solo falta tocar enviar. */
  function avisar(telefono: string | null, texto: string) {
    if (!telefono) return;
    window.open(enlaceWhatsApp(telefono, texto), "_blank", "noopener");
  }

  function BotonAvisar({ telefono, texto, etiqueta = "Avisar" }: { telefono: string | null; texto: string; etiqueta?: string }) {
    const valido = telefonoValidoParaWhatsApp(telefono);
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={!valido}
        title={valido ? undefined : "Este socio no tiene un teléfono válido para WhatsApp"}
        onClick={() => avisar(telefono, texto)}
      >
        <MessageCircle />
        {etiqueta}
      </Button>
    );
  }

  function ejecutar(accion: () => Promise<ResultadoOrden>, exito: string) {
    iniciar(async () => {
      const r = await accion();
      if (r.ok) toast.success(exito);
      else toast.error(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-tight">Cortes</h1>
          <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
            Cortes por morosidad, reposiciones y reparaciones, con foto de respaldo.
          </p>
        </div>
        <Button data-tour="cor-nueva" onClick={() => setCreando(true)}>
          <Plus />
          Nueva orden
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div data-tour="cor-pestanas" className="flex gap-4 overflow-x-auto overflow-y-hidden border-b border-border/60 px-3 sm:gap-6 sm:px-5">
          {pestanas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPestana(p.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 py-3.5 text-[0.82rem] font-medium transition-colors sm:text-[0.9rem]",
                pestana === p.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {p.texto}
              {p.n > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] tabular-nums text-foreground">
                  {p.n}
                </span>
              )}
            </button>
          ))}
        </div>

        {pestana === "morosos" && acuerdosAlDia > 0 && (
          <p className="border-b border-border/60 bg-muted/40 px-3 py-2.5 text-[0.82rem] text-muted-foreground sm:px-5">
            {acuerdosAlDia === 1 ? "1 socio con acuerdo de pago al día no aparece" : `${acuerdosAlDia} socios con acuerdo de pago al día no aparecen`}{" "}
            aquí: mientras cumplan sus cuotas, no se les corta. Los acuerdos están en la pestaña Repactaciones.
          </p>
        )}

        {pestana === "morosos" && (
          <Lista vacio={`Nadie tiene deuda vencida hace más de ${diasGracia} días (los días de gracia de Configuración → Cortes).`}>
            {morosos.map((m) => (
              <Fila
                key={m.socioId}
                titulo={m.nombre}
                detalle={[
                  m.rut ? formatearRut(m.rut) : null,
                  m.direccion,
                  `vencida hace ${m.diasVencida} días`,
                  m.acuerdoAtrasado ? `acuerdo de pago atrasado ${clp.format(m.acuerdoAtrasado)}` : null,
                ]}
                derecha={<span className="font-mono text-[0.95rem] font-semibold text-destructive tabular-nums">{clp.format(m.deuda)}</span>}
                acciones={
                  <>
                  <BotonAvisar
                    telefono={m.telefono}
                    etiqueta="Avisar antes de cortar"
                    texto={mensajeAvisoCorte(comite, { socioNombre: m.nombre, deuda: m.deuda, diasVencida: m.diasVencida, diasAviso: comite.diasAviso })}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendiente}
                    onClick={() => ejecutar(() => ordenarCorte(m.socioId, `Deuda de ${clp.format(m.deuda)}, vencida hace ${m.diasVencida} días.`), "Corte ordenado")}
                  >
                    <Scissors />
                    Ordenar corte
                  </Button>
                  </>
                }
              />
            ))}
          </Lista>
        )}

        {pestana === "repactaciones" && (
          <div className="p-3 sm:p-5">
            <RepactacionesPanel repactaciones={repactaciones} sociosConDeuda={sociosConDeuda} comite={comite} />
          </div>
        )}

        {pestana === "tramite" && (
          <Lista vacio="No hay órdenes esperando que alguien vaya a terreno.">
            {tramite.map((o) => (
              <Fila
                key={o.id}
                titulo={`${TIPOS_ORDEN[o.tipo].texto} · ${o.socioNombre}`}
                detalle={[o.socioDireccion, o.detalle, `pedida ${fecha.format(new Date(o.creada))}`]}
                acciones={
                  <>
                    <Button size="sm" onClick={() => setEjecutando(o)}>
                      <Camera />
                      Subir evidencia
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pendiente} onClick={() => ejecutar(() => cancelarOrden(o.id), "Orden cancelada")}>
                      Cancelar
                    </Button>
                  </>
                }
              />
            ))}
          </Lista>
        )}

        {pestana === "alta" && (
          <Lista vacio="No hay evidencia esperando que la des de alta.">
            {porAlta.map((o) => (
              <Fila
                key={o.id}
                titulo={`${TIPOS_ORDEN[o.tipo].texto} · ${o.socioNombre}`}
                detalle={[o.socioDireccion, o.nota, o.ejecutada ? `hecho ${fecha.format(new Date(o.ejecutada))}` : null]}
                miniatura={o.tieneFoto ? `/api/panel/ordenes/${o.id}/foto` : undefined}
                acciones={
                  <>
                    <Button size="sm" disabled={pendiente} onClick={() => ejecutar(() => darDeAlta(o.id), "Dada de alta")}>
                      <Check />
                      Dar de alta
                    </Button>
                    <Button size="sm" variant="outline" disabled={pendiente} onClick={() => ejecutar(() => pedirOtraEvidencia(o.id), "Se pidió otra foto")}>
                      Pedir otra foto
                    </Button>
                  </>
                }
              />
            ))}
          </Lista>
        )}

        {pestana === "solicitudes" && (
          <Lista vacio="No hay solicitudes por aprobar.">
            {solicitudes.map((o) => (
              <Fila
                key={o.id}
                titulo={`${TIPOS_ORDEN[o.tipo].texto} · ${o.socioNombre}`}
                detalle={[o.socioDireccion, o.detalle, `pedida por ${o.origen === "SOCIO" ? "el socio" : "el técnico"} ${fecha.format(new Date(o.creada))}`]}
                acciones={
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setViendo(o)}>
                      <Eye />
                      Ver situación
                    </Button>
                    <Button size="sm" disabled={pendiente} onClick={() => setResolviendo({ orden: o, aprobar: true })}>
                      {o.tipo === "RECLAMO" ? "Responder" : o.tipo === "BAJA" ? "Dar de baja" : o.tipo === "REANUDACION" ? "Reanudar" : "Aprobar"}
                    </Button>
                    <Button size="sm" variant="outline" disabled={pendiente} onClick={() => setResolviendo({ orden: o, aprobar: false })}>
                      Rechazar
                    </Button>
                  </>
                }
              />
            ))}
          </Lista>
        )}

        {pestana === "cortados" && (
          <Lista vacio="No hay arranques cortados.">
            {cortados.map((o) => (
              <Fila
                key={o.id}
                titulo={o.socioNombre}
                detalle={[o.socioRut ? formatearRut(o.socioRut) : null, o.socioDireccion, o.deudaAlOrdenar ? `debía ${clp.format(o.deudaAlOrdenar)}` : null]}
                miniatura={o.tieneFoto ? `/api/panel/ordenes/${o.id}/foto` : undefined}
                acciones={
                  <>
                  <BotonAvisar
                    telefono={o.socioTelefono}
                    etiqueta="Avisar corte"
                    texto={mensajeCorteRealizado(comite, { socioNombre: o.socioNombre, deuda: o.deudaAlOrdenar, costoReconexion: comite.costoReconexion })}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendiente}
                    onClick={() => ejecutar(() => solicitarOrden(o.socioId, "REPOSICION", "Reposición del servicio."), "Reposición ordenada")}
                  >
                    Ordenar reposición
                  </Button>
                  </>
                }
              />
            ))}
          </Lista>
        )}

        {pestana === "historial" && (
          <Lista vacio="Todavía no hay órdenes cerradas.">
            {historial.map((o) => (
              <Fila
                key={o.id}
                titulo={`${TIPOS_ORDEN[o.tipo].texto} · ${o.socioNombre}`}
                detalle={[ESTADOS_ORDEN[o.estado], fecha.format(new Date(o.creada)), o.detalle]}
                miniatura={o.tieneFoto ? `/api/panel/ordenes/${o.id}/foto` : undefined}
                acciones={
                  o.tipo === "REPOSICION" && o.estado === "COMPLETADA" && o.origen !== "SOCIO" ? (
                    <BotonAvisar
                      telefono={o.socioTelefono}
                      etiqueta="Avisar reposición"
                      texto={mensajeReposicion(comite, { socioNombre: o.socioNombre })}
                    />
                  ) : o.tipo === "REANUDACION" && o.estado === "COMPLETADA" ? (
                    <BotonAvisar
                      telefono={o.socioTelefono}
                      etiqueta="Avisar reanudación"
                      texto={mensajeReanudacion(comite, { socioNombre: o.socioNombre })}
                    />
                  ) : o.origen === "SOCIO" && (o.estado === "COMPLETADA" || o.estado === "RECHAZADA") ? (
                    <BotonAvisar
                      telefono={o.socioTelefono}
                      etiqueta="Avisar respuesta"
                      texto={mensajeRespuestaSolicitud(comite, {
                        socioNombre: o.socioNombre,
                        tipo: TIPOS_ORDEN[o.tipo].texto,
                        aprobada: o.estado === "COMPLETADA",
                        respuesta: o.nota,
                      })}
                    />
                  ) : undefined
                }
              />
            ))}
          </Lista>
        )}
      </div>

      {pendiente && <Loader2 className="fixed bottom-6 left-6 size-5 animate-spin text-muted-foreground" />}

      {creando && (
        <NuevaOrdenDialog
          socios={socios}
          tipos={["CORTE", "REPOSICION", "REPARACION"] satisfies TipoCampo[]}
          titulo="Nueva orden"
          descripcion="Elige el arranque y qué hay que hacer en terreno."
          onCerrar={() => setCreando(false)}
        />
      )}

      {viendo && (
        <SituacionSocioDialog
          ordenId={viendo.id}
          titulo={viendo.socioNombre}
          onCerrar={() => setViendo(null)}
        />
      )}

      {resolviendo && (
        <ResolverDialog
          orden={resolviendo.orden}
          aprobar={resolviendo.aprobar}
          onCerrar={() => setResolviendo(null)}
        />
      )}

      {ejecutando && (
        <EvidenciaDialog
          orden={{ id: ejecutando.id, tipo: ejecutando.tipo, socioNombre: ejecutando.socioNombre, direccion: ejecutando.socioDireccion }}
          onCerrar={() => setEjecutando(null)}
        />
      )}
    </div>
  );
}

function Lista({ vacio, children }: { vacio: string; children: React.ReactNode[] }) {
  if (children.length === 0) {
    return <p className="px-5 py-12 text-center text-[0.9rem] text-muted-foreground">{vacio}</p>;
  }
  return <div className="flex flex-col divide-y divide-border/60">{children}</div>;
}

function Fila({
  titulo,
  detalle,
  derecha,
  miniatura,
  acciones,
}: {
  titulo: string;
  detalle: (string | null | undefined)[];
  derecha?: React.ReactNode;
  miniatura?: string;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-3 py-4 sm:px-5">
      {miniatura && (
        <a href={miniatura} target="_blank" rel="noopener" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={miniatura} alt="Evidencia" className="size-14 rounded-lg border border-border object-cover" />
        </a>
      )}
      <div className="min-w-0 flex-1 basis-56">
        <div className="truncate font-medium">{titulo}</div>
        <div className="text-[0.8rem] text-muted-foreground">{detalle.filter(Boolean).join(" · ")}</div>
      </div>
      {derecha}
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}

/**
 * Resolver una solicitud. En un reclamo la respuesta es obligatoria (el socio la
 * ve en su portal); en una baja, aprobarla deja el arranque inactivo; al
 * rechazar, el motivo es opcional pero también lo ve el socio.
 */
function ResolverDialog({
  orden,
  aprobar,
  onCerrar,
}: {
  orden: OrdenFila;
  aprobar: boolean;
  onCerrar: () => void;
}) {
  const [respuesta, setRespuesta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  // Solo para bajas: lo que debe hoy el arranque, y si la directiva ya lo vio.
  const [deuda, setDeuda] = useState<number | null>(null);
  const [confirmaDeuda, setConfirmaDeuda] = useState(false);

  const reclamo = orden.tipo === "RECLAMO";
  const baja = orden.tipo === "BAJA";
  const reanudacion = orden.tipo === "REANUDACION";
  useEffect(() => {
    if (orden.tipo !== "BAJA" || !aprobar) return;
    let vivo = true;
    deudaDeArranque(orden.socioId)
      .then((d) => vivo && setDeuda(d))
      .catch(() => vivo && setDeuda(0));
    return () => {
      vivo = false;
    };
  }, [orden.tipo, orden.socioId, aprobar]);

  const conDeuda = baja && aprobar && (deuda ?? 0) > 0;
  const pideTexto = reclamo || !aprobar || baja || reanudacion;

  const titulo = !aprobar
    ? `Rechazar ${TIPOS_ORDEN[orden.tipo].texto.toLowerCase()}`
    : reclamo
      ? "Responder el reclamo"
      : baja
        ? "Dar de baja el servicio"
        : reanudacion
          ? "Reanudar el servicio"
          : `Aprobar ${TIPOS_ORDEN[orden.tipo].texto.toLowerCase()}`;

  const descripcion = !aprobar
    ? "Si escribes un motivo, el socio lo ve en su portal."
    : reclamo
      ? "Tu respuesta le aparece al socio en su portal."
      : baja
        ? "El arranque queda inactivo y deja de aparecer en los cobros. Lo que debe hasta hoy no se borra."
        : reanudacion
          ? "El arranque vuelve a estar activo. Si hay que reconectarlo en terreno, ordena una reposición."
          : "Pasa a trámite: el técnico (o el presidente) va a terreno y sube la foto.";

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {titulo} · {orden.socioNombre}
          </DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {orden.detalle && (
            <p className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-[0.86rem]">
              <span className="font-medium">El socio escribió: </span>
              {orden.detalle}
            </p>
          )}
          {pideTexto && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="respuesta-orden">
                {aprobar && reclamo ? "Respuesta" : "Mensaje para el socio (opcional)"}
              </Label>
              <Textarea
                id="respuesta-orden"
                rows={4}
                maxLength={500}
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                autoFocus
              />
            </div>
          )}
          {conDeuda && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-[0.84rem]">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={confirmaDeuda}
                onChange={(e) => setConfirmaDeuda(e.target.checked)}
              />
              <span>
                <span className="font-semibold text-destructive">
                  Este arranque debe {clp.format(deuda ?? 0)}.
                </span>{" "}
                Dar de baja no borra la deuda: queda pendiente de cobro. Confirmo que quiero darlo de baja igual.
              </span>
            </label>
          )}
          {error && <p className="text-[0.88rem] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            variant={!aprobar ? "destructive" : "default"}
            disabled={pendiente || (aprobar && reclamo && !respuesta.trim()) || (baja && aprobar && deuda === null) || (conDeuda && !confirmaDeuda)}
            onClick={() =>
              iniciar(async () => {
                setError(null);
                const r = await resolverSolicitud(orden.id, aprobar, respuesta, confirmaDeuda);
                if (r.ok) {
                  toast.success(aprobar ? "Listo" : "Solicitud rechazada");
                  onCerrar();
                } else {
                  setError(r.error);
                  toast.error(r.error);
                }
              })
            }
          >
            {pendiente && <Loader2 className="animate-spin" />}
            {!aprobar ? "Rechazar" : reclamo ? "Enviar respuesta" : baja ? "Dar de baja" : reanudacion ? "Reanudar" : "Aprobar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
