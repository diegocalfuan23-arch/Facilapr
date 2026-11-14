"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { borrarComunicado, publicarComunicado } from "@/app/panel/comunicados-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmar } from "@/components/ui/confirmar";
import { MENSAJE_COMUNICADO_MAX, TITULO_COMUNICADO_MAX } from "@/lib/comunicados-comun";
import type { DatosResumen } from "@/lib/resumen-comun";

const GRIS = "text-[#5B5970]";

/** Escribir un comunicado para los socios y ver (o borrar) los que ya se publicaron. */
export function ComunicadoDialog({ comunicados, onCerrar }: { comunicados: DatosResumen["comunicados"]; onCerrar: () => void }) {
  const router = useRouter();
  const { confirmar, dialogo } = useConfirmar();
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function publicar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await publicarComunicado(titulo, mensaje);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success("Comunicado publicado", { description: "Los socios lo ven en «Avisos del comité» de su cuenta en línea." });
      router.refresh();
      onCerrar();
    });
  }

  async function borrar(id: string, t: string) {
    if (!(await confirmar({ titulo: `¿Borrar «${t}»?`, descripcion: "Los socios dejan de verlo en su cuenta.", boton: "Borrar" }))) return;
    iniciar(async () => {
      const r = await borrarComunicado(id);
      if (r.ok) {
        toast.success("Comunicado borrado");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-lg sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Comunicado a los socios</DialogTitle>
          <DialogDescription className="text-[0.9rem]">Lo ven los socios que entran a su cuenta en línea, en «Avisos del comité». Úsalo para cortes de agua, asambleas o cambios de tarifa.</DialogDescription>
        </DialogHeader>

        <form onSubmit={publicar} className="mt-2 flex flex-col gap-4">
          <div>
            <label htmlFor="com-titulo" className="mb-2 block text-[0.8rem] font-medium">
              Título
            </label>
            <Input id="com-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={TITULO_COMUNICADO_MAX} placeholder="Ej.: Corte de agua el sábado" className="h-10 px-3 text-[0.95rem]" autoFocus required />
          </div>
          <div>
            <label htmlFor="com-mensaje" className="mb-2 block text-[0.8rem] font-medium">
              Mensaje
            </label>
            <Textarea id="com-mensaje" value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={MENSAJE_COMUNICADO_MAX} rows={5} placeholder="Qué pasa, cuándo y qué tienen que hacer los socios." required />
            <p className={`mt-1 text-right text-xs tabular-nums ${GRIS}`}>
              {mensaje.length} / {MENSAJE_COMUNICADO_MAX}
            </p>
          </div>

          {error && (
            <p className="text-[0.8rem] text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" className="h-10 rounded-full px-5 text-[0.95rem]" disabled={pendiente || !titulo.trim() || !mensaje.trim()}>
              {pendiente && <Loader2 className="animate-spin" />}
              Publicar
            </Button>
          </div>
        </form>

        {comunicados.length > 0 && (
          <div className="mt-4 border-t border-[#F0EEF6] pt-4">
            <p className="mb-2 text-[13px] font-semibold">Publicados</p>
            <ul className="flex flex-col gap-2">
              {comunicados.map((c) => (
                <li key={c.id} className="flex items-start gap-3 rounded-xl border border-[#EFEDF6] px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.titulo}</span>
                    <span className={`block truncate text-xs ${GRIS}`}>{c.hace}</span>
                  </span>
                  <Button variant="ghost" size="icon" aria-label={`Borrar ${c.titulo}`} className="size-8 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-700" disabled={pendiente} onClick={() => borrar(c.id, c.titulo)}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {dialogo}
      </DialogContent>
    </Dialog>
  );
}
