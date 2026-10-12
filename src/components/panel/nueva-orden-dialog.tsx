"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ordenarCorte, solicitarOrden } from "@/app/panel/ordenes/actions";
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
import { SocioBuscador, type OpcionSocio } from "@/components/panel/socio-buscador";
import { TIPOS_ORDEN, type TipoCampo } from "@/lib/ordenes";
import { cn } from "@/lib/utils";

/**
 * Crear una orden a mano: elegir el arranque, el tipo y, si hace falta, el detalle.
 * La directiva puede pedir los tres tipos; el técnico solo reposiciones y
 * reparaciones, y esas quedan pendientes de que la directiva las apruebe.
 */
export function NuevaOrdenDialog({
  socios,
  tipos,
  titulo,
  descripcion,
  onCerrar,
}: {
  socios: OpcionSocio[];
  tipos: TipoCampo[];
  titulo: string;
  descripcion: string;
  onCerrar: () => void;
}) {
  const [socioId, setSocioId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoCampo>(tipos[0]);
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <SocioBuscador socios={socios} onElegir={(s) => setSocioId(s?.id ?? null)} />

          {tipos.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label>Qué hay que hacer</Label>
              <div className="flex flex-wrap gap-2">
                {tipos.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={tipo === t ? "default" : "outline"}
                    onClick={() => setTipo(t)}
                    className={cn(tipo === t && "pointer-events-none")}
                  >
                    {TIPOS_ORDEN[t].texto}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="detalle-orden">Detalle (opcional)</Label>
            <Textarea
              id="detalle-orden"
              rows={3}
              maxLength={300}
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder={
                tipo === "CORTE"
                  ? "Ej: Tres boletas impagas."
                  : tipo === "REPOSICION"
                    ? "Ej: Pagó la deuda el lunes."
                    : "Ej: Fuga en el empalme."
              }
            />
          </div>

          {error && <p className="text-[0.88rem] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={!socioId || pendiente}
            onClick={() =>
              iniciar(async () => {
                if (!socioId) return;
                setError(null);
                const r =
                  tipo === "CORTE"
                    ? await ordenarCorte(socioId, detalle)
                    : await solicitarOrden(socioId, tipo, detalle);
                if (r.ok) {
                  toast.success("Orden creada");
                  onCerrar();
                } else {
                  setError(r.error);
                  toast.error(r.error);
                }
              })
            }
          >
            {pendiente && <Loader2 className="animate-spin" />}
            Crear orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
