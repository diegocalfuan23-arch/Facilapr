"use client";

import { startTransition, useActionState, useState, useTransition, type FormEvent } from "react";
import { Check, FileText, Loader2, ShieldCheck, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { guardarCertificado, guardarEmisor, quitarCertificado, quitarFolios, subirFolios, type ResultadoSii } from "@/app/panel/sii/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { foliosDisponibles, nombreTipoBoleta, TIPOS_BOLETA } from "@/lib/sii/folios";
import { formatearRut } from "@/lib/formato";
import { cn } from "@/lib/utils";

type Emisor = {
  rutEmisor: string | null;
  razonSocial: string | null;
  giro: string | null;
  direccion: string | null;
  comuna: string | null;
  tipoBoleta: number | null;
  resolucionNumero: number | null;
  resolucionFecha: string | null;
  certificadoNombre: string | null;
  representanteNombre: string | null;
  representanteRut: string | null;
  autorizadoAt: Date | null;
};

type Folio = { id: string; tipo: number; desde: number; hasta: number; siguiente: number; fechaAutorizacion: string };

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const dia = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago" });

/** Una acción de formulario que avisa cuando salió bien. */
function useGuardar(accion: (p: ResultadoSii | null, f: FormData) => Promise<ResultadoSii>, aviso: string, alGuardar?: () => void) {
  return useActionState<ResultadoSii | null, FormData>(async (previo, formData) => {
    const r = await accion(previo, formData);
    if (r.ok) {
      toast.success(aviso);
      alGuardar?.();
    }
    return r;
  }, null);
}

/** Envía sin vaciar el formulario: con `action`, React lo devuelve a sus valores iniciales aunque el guardado falle. */
const sinVaciar = (accion: (f: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const datos = new FormData(e.currentTarget);
  startTransition(() => accion(datos));
};

function Titulo({ texto, hecho }: { texto: string; hecho: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-base font-semibold">{texto}</h2>
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", hecho ? "bg-[#E6F6EF] text-[#075A3C]" : "bg-[#FFF3E0] text-[#8A4B00]")}>
        {hecho && <Check className="size-3.5" aria-hidden />}
        {hecho ? "Listo" : "Pendiente"}
      </span>
    </div>
  );
}

const Aviso = ({ estado }: { estado: ResultadoSii | null }) => (estado && !estado.ok ? <p className="text-sm text-destructive">{estado.error}</p> : null);

export function SiiVista({
  comite,
  listo,
  emisor,
  folios,
}: {
  comite: { nombre: string; razonSocial: string | null; rut: string | null; direccion: string | null; comuna: string | null };
  listo: boolean;
  emisor: Emisor | null;
  folios: Folio[];
}) {
  const [estadoEmisor, accionEmisor, guardandoEmisor] = useGuardar(guardarEmisor, "Datos guardados");
  const [cambiando, setCambiando] = useState(false);
  const [estadoCert, accionCert, guardandoCert] = useGuardar(guardarCertificado, "Certificado guardado", () => setCambiando(false));
  const [estadoFolios, accionFolios, subiendo] = useGuardar(subirFolios, "Folios cargados");
  const [quitando, setQuitando] = useState<"certificado" | Folio | null>(null);
  const [pendiente, iniciar] = useTransition();

  const conEmisor = Boolean(emisor?.rutEmisor);
  const conCertificado = Boolean(emisor?.certificadoNombre);
  const disponibles = folios.filter((f) => f.tipo === emisor?.tipoBoleta).reduce((s, f) => s + foliosDisponibles(f), 0);

  const campo = (name: keyof Emisor | "rutEmisor", etiqueta: string, inicial: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name}>{etiqueta}</Label>
      <Input id={name} name={name} defaultValue={inicial} required {...props} />
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Boletas SII</h1>
        <Button variant="outline" nativeButton={false} render={<a href="/panel/sii/prueba" target="_blank" rel="noopener" />}>
          <FileText />
          Boleta de prueba
        </Button>
      </div>
      {!listo && <p className="rounded-xl bg-[#FFF3E0] p-4 text-sm text-[#8A4B00]">Falta configurar el cifrado en el servidor.</p>}

      <Card className={cn("gap-4 rounded-2xl border-0 p-6", SOMBRA)}>
        <Titulo texto="Datos del emisor" hecho={conEmisor} />
        <form onSubmit={sinVaciar(accionEmisor)} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {campo("rutEmisor", "RUT del comité", emisor?.rutEmisor ? formatearRut(emisor.rutEmisor) : comite.rut ? formatearRut(comite.rut) : "")}
            {campo("razonSocial", "Razón social", emisor?.razonSocial ?? comite.razonSocial ?? comite.nombre, { maxLength: 100 })}
            {campo("giro", "Giro", emisor?.giro ?? "", { maxLength: 80 })}
            {campo("direccion", "Dirección", emisor?.direccion ?? comite.direccion ?? "", { maxLength: 70 })}
            {campo("comuna", "Comuna", emisor?.comuna ?? comite.comuna ?? "", { maxLength: 20 })}
            <div className="flex flex-col gap-1">
              <Label htmlFor="tipoBoleta">Tipo de boleta</Label>
              <select id="tipoBoleta" name="tipoBoleta" defaultValue={emisor?.tipoBoleta ?? ""} required className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="" disabled>
                  Elige…
                </option>
                {TIPOS_BOLETA.map((t) => (
                  <option key={t.tipo} value={t.tipo}>
                    {t.nombre} ({t.tipo})
                  </option>
                ))}
              </select>
            </div>
            {campo("resolucionNumero", "N.º de resolución · opcional", emisor?.resolucionNumero?.toString() ?? "", { required: false, inputMode: "numeric" })}
            {campo("resolucionFecha", "Fecha de resolución · opcional", emisor?.resolucionFecha ?? "", { required: false, type: "date" })}
          </div>
          <Aviso estado={estadoEmisor} />
          <Button type="submit" disabled={!listo || guardandoEmisor} className="self-start">
            {guardandoEmisor && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </form>
      </Card>

      <Card className={cn("gap-4 rounded-2xl border-0 p-6", SOMBRA)}>
        <Titulo texto="Certificado digital" hecho={conCertificado} />
        {conCertificado && !cambiando ? (
          <div className="flex flex-wrap items-center gap-4">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E6F6EF] text-[#0A7A52]">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{emisor!.certificadoNombre}</p>
              <p className={cn("text-xs", GRIS)}>
                {emisor!.representanteNombre} · {formatearRut(emisor!.representanteRut)}
                {emisor!.autorizadoAt ? ` · autorizado el ${dia.format(new Date(emisor!.autorizadoAt))}` : ""}
              </p>
            </div>
            <Button variant="outline" onClick={() => setCambiando(true)}>
              Cambiar
            </Button>
            <Button variant="ghost" size="icon" aria-label="Quitar el certificado" onClick={() => setQuitando("certificado")}>
              <Trash2 />
            </Button>
          </div>
        ) : (
          <form onSubmit={sinVaciar(accionCert)} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="representanteNombre">Dueño del certificado</Label>
                <Input id="representanteNombre" name="representanteNombre" required maxLength={100} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="representanteRut">Su RUT</Label>
                <Input id="representanteRut" name="representanteRut" required />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="archivoCert">Archivo (.pfx o .p12)</Label>
                <Input id="archivoCert" name="archivo" type="file" accept=".pfx,.p12" required />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="clave">Clave del certificado</Label>
                <Input id="clave" name="clave" type="password" autoComplete="off" required />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="autorizo" required className="mt-1 size-4 shrink-0 accent-primary" />
              <span>
                Autorizo a Facilapr a guardar cifrado este certificado y su clave, y a usarlos solo para emitir las boletas de {comite.nombre} ante el SII. Puedo
                quitarlos cuando quiera.
              </span>
            </label>
            <Aviso estado={estadoCert} />
            <div className="flex gap-2">
              <Button type="submit" disabled={!listo || guardandoCert}>
                {guardandoCert ? <Loader2 className="animate-spin" /> : <Upload />}
                Guardar certificado
              </Button>
              {conCertificado && (
                <Button type="button" variant="ghost" onClick={() => setCambiando(false)}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        )}
      </Card>

      <Card className={cn("gap-4 rounded-2xl border-0 p-6", SOMBRA)}>
        <Titulo texto="Folios" hecho={disponibles > 0} />
        {folios.length > 0 && (
          <ul className="divide-y divide-[#F3F1F8]">
            {folios.map((f) => (
              <li key={f.id} className="flex items-center gap-4 py-2">
                <FileText className="size-4 shrink-0 text-[#6E6B85]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {nombreTipoBoleta(f.tipo)} · {f.desde} a {f.hasta}
                  </p>
                  <p className={cn("text-xs", GRIS)}>
                    Quedan {foliosDisponibles(f)} · autorizados el {f.fechaAutorizacion}
                  </p>
                </div>
                {f.siguiente === f.desde && (
                  <Button variant="ghost" size="icon" aria-label={`Quitar los folios ${f.desde} a ${f.hasta}`} onClick={() => setQuitando(f)}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form action={accionFolios} className="flex flex-col gap-2">
          <Label htmlFor="archivoCaf">Archivo de folios del SII (.xml)</Label>
          <div className="flex flex-wrap gap-2">
            <Input id="archivoCaf" name="archivo" type="file" accept=".xml" required disabled={!conEmisor} className="max-w-[360px]" />
            <Button type="submit" disabled={!listo || !conEmisor || subiendo}>
              {subiendo ? <Loader2 className="animate-spin" /> : <Upload />}
              Cargar
            </Button>
          </div>
          <Aviso estado={estadoFolios} />
        </form>
      </Card>

      <Dialog open={!!quitando} onOpenChange={(v) => !v && setQuitando(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{quitando === "certificado" ? "¿Quitar el certificado?" : "¿Quitar estos folios?"}</DialogTitle>
            <DialogDescription>
              {quitando === "certificado" ? "Se borra de Facilapr junto con su clave." : quitando ? `Folios ${quitando.desde} a ${quitando.hasta}.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuitando(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = quitando === "certificado" ? await quitarCertificado() : await quitarFolios(quitando!.id);
                  if (r.ok) toast.success("Quitado");
                  else toast.error(r.error);
                  setQuitando(null);
                })
              }
            >
              Quitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
