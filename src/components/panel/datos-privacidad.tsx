"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import {
  cancelarCierre,
  exportarDatos,
  solicitarCierre,
} from "@/app/panel/configuracion/datos-actions";
import { DIAS_HASTA_BORRADO } from "@/lib/retencion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ResumenDatos = {
  socios: number;
  boletas: number;
  cierreSolicitadoEn: Date | null;
};

const fechaLarga = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function Bloque({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-[1rem] font-semibold">{titulo}</h3>
      <p className="mt-1 max-w-[62ch] text-[0.88rem] leading-relaxed text-muted-foreground">
        {descripcion}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function DatosPrivacidad({
  resumen,
  nombreComite,
}: {
  resumen: ResumenDatos;
  nombreComite: string;
}) {
  const [exportando, iniciarExportar] = useTransition();
  const [cerrando, iniciarCerrar] = useTransition();
  const [confirmacion, setConfirmacion] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function descargar() {
    setError(null);
    setAviso(null);
    iniciarExportar(async () => {
      const r = await exportarDatos();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // Se arma el archivo en el navegador: así el JSON no viaja como
      // adjunto ni queda guardado en ningún servidor intermedio.
      const url = URL.createObjectURL(
        new Blob([r.contenido], { type: "application/json" })
      );
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = r.nombreArchivo;
      enlace.click();
      URL.revokeObjectURL(url);
      setAviso("Descarga iniciada.");
    });
  }

  const fechaBorrado = resumen.cierreSolicitadoEn
    ? new Date(
        resumen.cierreSolicitadoEn.getTime() +
          DIAS_HASTA_BORRADO * 24 * 60 * 60 * 1000
      )
    : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[68ch] text-[0.9rem] leading-relaxed text-muted-foreground">
        La Ley 21.719 te da derecho a llevarte tus datos y a pedir que se
        eliminen. Aquí puedes ejercer ambos.
      </p>

      {aviso && (
        <p className="rounded-lg border border-forest/30 bg-forest/5 px-4 py-3 text-[0.88rem] text-forest">
          {aviso}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[0.88rem] text-destructive">
          {error}
        </p>
      )}

      <Bloque
        titulo="Exportar todos mis datos"
        descripcion="Descarga un archivo con el comité, sus socios, boletas y lecturas. Sirve para guardar un respaldo o llevarlo a otro sistema."
      >
        <Button type="button" variant="outline" disabled={exportando} onClick={descargar}>
          {exportando ? <Loader2 className="animate-spin" /> : <Download />}
          Descargar mis datos
        </Button>
      </Bloque>

      {resumen.cierreSolicitadoEn && fechaBorrado ? (
        <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-destructive" />
            <h3 className="text-[1rem] font-semibold text-destructive">
              Cierre de cuenta solicitado
            </h3>
          </div>
          <p className="mt-2 max-w-[62ch] text-[0.88rem] leading-relaxed">
            Pediste cerrar la cuenta el{" "}
            {fechaLarga.format(resumen.cierreSolicitadoEn)}. Todos los datos se
            eliminarán el <strong>{fechaLarga.format(fechaBorrado)}</strong>.
            Hasta entonces puedes cancelar y seguir usando el servicio.
          </p>
          <Button
            type="button"
            className="mt-4"
            disabled={cerrando}
            onClick={() => {
              setError(null);
              iniciarCerrar(async () => {
                const r = await cancelarCierre();
                if (r.ok) setAviso("Cierre cancelado. Tu cuenta sigue activa.");
                else setError(r.error);
              });
            }}
          >
            {cerrando && <Loader2 className="animate-spin" />}
            Cancelar el cierre
          </Button>
        </section>
      ) : (
        <Bloque
          titulo="Cerrar la cuenta y borrar todo"
          descripcion={`Se eliminarán ${resumen.socios} socio(s), ${resumen.boletas} boleta(s) y todo lo demás, ${DIAS_HASTA_BORRADO} días después de solicitarlo. Durante ese plazo puedes arrepentirte. Exporta tus datos antes.`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmacion">
                Escribe «{nombreComite}» para confirmar
              </Label>
              <Input
                id="confirmacion"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                placeholder={nombreComite}
                className="max-w-sm"
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              disabled={cerrando || confirmacion.trim() === ""}
              className="self-start"
              onClick={() => {
                setError(null);
                setAviso(null);
                iniciarCerrar(async () => {
                  const r = await solicitarCierre(confirmacion);
                  if (r.ok) {
                    setConfirmacion("");
                    setAviso("Cierre solicitado.");
                  } else setError(r.error);
                });
              }}
            >
              {cerrando && <Loader2 className="animate-spin" />}
              Solicitar cierre de cuenta
            </Button>
          </div>
        </Bloque>
      )}
    </div>
  );
}
