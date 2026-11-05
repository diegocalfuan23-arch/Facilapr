"use client";

import { toast } from "sonner";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, MessageCircle, UserPlus, Clock } from "lucide-react";
import { generarInvitacionOperador } from "@/app/panel/lecturas/actions";
import {
  cancelarInvitacion,
  desactivarOperador,
  reactivarOperador,
} from "@/app/panel/tecnicos/actions";
import { iniciales, normalizarTelefono } from "@/lib/formato";
import { enlaceWhatsApp, mensajeInvitacionTecnico, telefonoValidoParaWhatsApp } from "@/lib/whatsapp";

type RolEquipo = "OPERADOR" | "TESORERO";
const TEXTO_ROL: Record<RolEquipo, string> = { OPERADOR: "Operador", TESORERO: "Tesorero" };
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const fecha = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export type Tecnico = {
  id: string;
  nombre: string;
  correo: string;
  desde: Date;
  /** false = desactivado por la directiva: no puede entrar. */
  activo: boolean;
  rol: RolEquipo;
};

export type InvitacionPendiente = {
  id: string;
  codigo: string;
  expiraEn: Date;
  creadaEn: Date;
  rol: RolEquipo;
};

export function TecnicosPanel({
  tecnicos,
  invitacionesPendientes,
  puedeTesorero,
}: {
  tecnicos: Tecnico[];
  invitacionesPendientes: InvitacionPendiente[];
  /** El plan incluye Finanzas: solo entonces se puede invitar a un tesorero. */
  puedeTesorero: boolean;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-tight">
            Equipo
          </h1>
          <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
            Quienes tienen acceso al panel: los operadores cargan lecturas en terreno y el tesorero lleva las finanzas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedeTesorero && <InvitarTecnico rol="TESORERO" />}
          <InvitarTecnico rol="OPERADOR" />
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-[0.95rem] font-semibold">Con acceso al panel</h2>
        {tecnicos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-[0.9rem] text-muted-foreground">
            Todavía no tienes personas invitadas.
          </p>
        ) : (
          <>
          <ul className="flex flex-col divide-y divide-border/60 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:hidden">
            {tecnicos.map((t) => (
              <TarjetaTecnico key={t.id} tecnico={t} />
            ))}
          </ul>
          <div
            data-tour="tec-tabla"
            className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:block"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-11 px-4">Persona</TableHead>
                  <TableHead className="h-11 px-4">Rol</TableHead>
                  <TableHead className="h-11 px-4">Correo</TableHead>
                  <TableHead className="h-11 px-4">Desde</TableHead>
                  <TableHead className="h-11 px-4">Estado</TableHead>
                  <TableHead className="h-11 px-4 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tecnicos.map((t) => (
                  <TecnicoFila key={t.id} tecnico={t} />
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </section>

      {invitacionesPendientes.length > 0 && (
        <section>
          <h2 className="mb-3 text-[0.95rem] font-semibold">
            Invitaciones pendientes
          </h2>
          <ul className="flex flex-col divide-y divide-border/60 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:hidden">
            {invitacionesPendientes.map((inv) => (
              <TarjetaInvitacion key={inv.id} invitacion={inv} />
            ))}
          </ul>
          <div
            data-tour="tec-invitaciones"
            className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:block"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-11 px-4">Invitación</TableHead>
                  <TableHead className="h-11 px-4">Creada</TableHead>
                  <TableHead className="h-11 px-4">Vence</TableHead>
                  <TableHead className="h-11 px-4">Estado</TableHead>
                  <TableHead className="h-11 px-4 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitacionesPendientes.map((inv) => (
                  <InvitacionFila key={inv.id} invitacion={inv} />
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}

/** Desactivar / reactivar a un operador, con su confirmación. La usan la tabla y la tarjeta. */
function AccionesTecnico({ tecnico: t }: { tecnico: Tecnico }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [trabajando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cambiar(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (r.ok) {
        setConfirmando(false);
        toast.success(
          t.activo ? `${t.nombre} fue desactivado` : `${t.nombre} fue reactivado`
        );
        router.refresh();
      } else {
        setError(r.error ?? "No pudimos completar la acción.");
        toast.error(r.error ?? "No pudimos completar la acción.");
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {error && !confirmando && (
          <p className="max-w-[24ch] text-right text-[0.78rem] text-destructive">
            {error}
          </p>
        )}
        {t.activo ? (
          <Button variant="outline" size="sm" onClick={() => setConfirmando(true)}>
            Desactivar
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={trabajando}
            onClick={() => cambiar(() => reactivarOperador(t.id))}
          >
            {trabajando && <Loader2 className="animate-spin" />}
            Reactivar
          </Button>
        )}
      </div>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent className="sm:max-w-105">
          <DialogHeader>
            <DialogTitle>Desactivar a {t.nombre}</DialogTitle>
            <DialogDescription>
              Dejará de poder entrar y se cerrará su sesión. Lo que ya registró
              se conserva en el historial. Puedes reactivarlo cuando
              quieras.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-[0.85rem] text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={trabajando}
              onClick={() => cambiar(() => desactivarOperador(t.id))}
            >
              {trabajando && <Loader2 className="animate-spin" />}
              Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RolEtiqueta({ rol }: { rol: RolEquipo }) {
  return (
    <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[0.78rem] font-medium whitespace-nowrap text-muted-foreground">
      {TEXTO_ROL[rol]}
    </span>
  );
}

function EstadoTecnico({ activo }: { activo: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[0.78rem] font-medium whitespace-nowrap",
        activo ? "bg-forest/15 text-forest" : "bg-destructive/10 text-destructive"
      )}
    >
      {activo ? "Activo" : "Desactivado"}
    </span>
  );
}

function TecnicoFila({ tecnico: t }: { tecnico: Tecnico }) {
  return (
    <TableRow>
      <TableCell className="px-4 py-3.5">
        <div className={cn("flex items-center gap-3", !t.activo && "opacity-60")}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[0.7rem] font-semibold text-muted-foreground">
            {iniciales(t.nombre)}
          </span>
          <span className="font-medium">{t.nombre}</span>
        </div>
      </TableCell>
      <TableCell className={cn("px-4 py-3.5", !t.activo && "opacity-60")}>
        <RolEtiqueta rol={t.rol} />
      </TableCell>
      <TableCell className={cn("px-4 py-3.5 text-muted-foreground", !t.activo && "opacity-60")}>
        {t.correo}
      </TableCell>
      <TableCell className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
        {fecha.format(t.desde)}
      </TableCell>
      <TableCell className="px-4 py-3.5">
        <EstadoTecnico activo={t.activo} />
      </TableCell>
      <TableCell className="px-4 py-3.5">
        <AccionesTecnico tecnico={t} />
      </TableCell>
    </TableRow>
  );
}

/** El mismo operador como tarjeta, para pantallas angostas. */
function TarjetaTecnico({ tecnico: t }: { tecnico: Tecnico }) {
  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex min-w-0 items-center gap-3", !t.activo && "opacity-60")}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[0.72rem] font-semibold text-muted-foreground">
            {iniciales(t.nombre)}
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{t.nombre}</div>
            <div className="truncate text-[0.82rem] text-muted-foreground">
              {TEXTO_ROL[t.rol]} · {t.correo}
            </div>
          </div>
        </div>
        <EstadoTecnico activo={t.activo} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.8rem] text-muted-foreground">
          Desde {fecha.format(t.desde)}
        </span>
        <AccionesTecnico tecnico={t} />
      </div>
    </li>
  );
}

function useCancelarInvitacion(invitacion: InvitacionPendiente) {
  const router = useRouter();
  const [cancelando, iniciar] = useTransition();

  function cancelar() {
    iniciar(async () => {
      await cancelarInvitacion(invitacion.id);
      toast.success("Invitación cancelada");
      router.refresh();
    });
  }

  return { cancelando, cancelar };
}

function BotonCancelarInvitacion({ invitacion }: { invitacion: InvitacionPendiente }) {
  const { cancelando, cancelar } = useCancelarInvitacion(invitacion);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={cancelando}
      onClick={cancelar}
    >
      {cancelando && <Loader2 className="animate-spin" />}
      Cancelar
    </Button>
  );
}

function InvitacionFila({ invitacion }: { invitacion: InvitacionPendiente }) {
  return (
    <TableRow>
      <TableCell className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tertiary/15 text-tertiary-foreground">
            <Clock className="size-4" />
          </span>
          <span className="font-medium">Invitación para {TEXTO_ROL[invitacion.rol].toLowerCase()}</span>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
        {fecha.format(invitacion.creadaEn)}
      </TableCell>
      <TableCell className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
        {fecha.format(invitacion.expiraEn)}
      </TableCell>
      <TableCell className="px-4 py-3.5">
        <span className="inline-flex rounded-full bg-tertiary/15 px-2.5 py-1 text-[0.78rem] font-medium whitespace-nowrap text-tertiary-foreground">
          Sin usar
        </span>
      </TableCell>
      <TableCell className="px-4 py-3.5">
        <div className="flex justify-end">
          <BotonCancelarInvitacion invitacion={invitacion} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function TarjetaInvitacion({ invitacion }: { invitacion: InvitacionPendiente }) {
  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tertiary/15 text-tertiary-foreground">
            <Clock className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="font-medium">Invitación para {TEXTO_ROL[invitacion.rol].toLowerCase()}</div>
            <div className="text-[0.8rem] text-muted-foreground">
              Vence el {fecha.format(invitacion.expiraEn)}
            </div>
          </div>
        </div>
        <span className="inline-flex shrink-0 rounded-full bg-tertiary/15 px-2.5 py-1 text-[0.78rem] font-medium whitespace-nowrap text-tertiary-foreground">
          Sin usar
        </span>
      </div>
      <div className="flex justify-end">
        <BotonCancelarInvitacion invitacion={invitacion} />
      </div>
    </li>
  );
}

function InvitarTecnico({ rol }: { rol: RolEquipo }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [comite, setComite] = useState("");
  const [telefono, setTelefono] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [generando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setAbierto(true);
    setUrl(null);
    setTelefono("");
    setError(null);
    iniciar(async () => {
      const r = await generarInvitacionOperador(rol);
      if (r.ok) {
        setUrl(r.url);
        setComite(r.comite);
      }
      else {
        setError(r.error);
        toast.error(r.error);
      }
    });
  }

  // Con teléfono se abre el chat de esa persona; sin él, WhatsApp deja elegir a quién.
  const telefonoNormalizado = telefono.trim() ? normalizarTelefono(telefono) : "";
  const telefonoMalo = telefonoNormalizado !== "" && !telefonoValidoParaWhatsApp(telefonoNormalizado);

  function enviarPorWhatsApp() {
    if (!url || telefonoMalo) return;
    window.open(
      enlaceWhatsApp(telefonoNormalizado, mensajeInvitacionTecnico(comite, url, rol)),
      "_blank",
      "noopener"
    );
  }

  async function copiar() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Enlace de invitación copiado");
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <>
      <Button type="button" variant={rol === "OPERADOR" ? "default" : "outline"} data-tour={rol === "OPERADOR" ? "tec-invitar" : undefined} onClick={abrir}>
        <UserPlus />
        Invitar {TEXTO_ROL[rol].toLowerCase()}
      </Button>

      <Dialog
        open={abierto}
        onOpenChange={(v) => {
          setAbierto(v);
          if (!v) router.refresh();
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Invitar {TEXTO_ROL[rol].toLowerCase()}</DialogTitle>
            <DialogDescription>
              Mándalo por WhatsApp o copia el enlace. Sirve una sola vez y
              vence en 7 días.
            </DialogDescription>
          </DialogHeader>

          {generando && (
            <div className="flex items-center gap-2 text-[0.9rem] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Generando enlace…
            </div>
          )}

          {error && <p className="text-[0.88rem] text-destructive">{error}</p>}

          {url && (
            // min-w-0: el modal es un grid y sus hijos no se achican por debajo
            // del contenido; sin esto el enlace largo ensancha todo y el botón
            // queda fuera del recuadro.
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 py-2">
              <span
                title={url}
                className="min-w-0 flex-1 truncate text-[0.87rem]"
              >
                {url}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={copiar}
              >
                {copiado ? <Check className="text-forest" /> : <Copy />}
                {copiado ? "Copiado" : "Copiar"}
              </Button>
            </div>
          )}

          {url && (
            <div className="flex flex-col gap-2">
              <label htmlFor="tecnico-telefono" className="text-[0.85rem] font-medium">
                Teléfono del {TEXTO_ROL[rol].toLowerCase()} <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <Input
                id="tecnico-telefono"
                inputMode="tel"
                placeholder="9 1234 5678"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                aria-invalid={telefonoMalo}
              />
              {telefonoMalo ? (
                <p className="text-[0.8rem] text-destructive">Revisa el número: no parece un teléfono válido.</p>
              ) : (
                <p className="text-[0.8rem] text-muted-foreground">
                  Si lo dejas vacío, WhatsApp te deja elegir el contacto.
                </p>
              )}
              <Button type="button" onClick={enviarPorWhatsApp} disabled={telefonoMalo}>
                <MessageCircle />
                Enviar por WhatsApp
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
