"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { renovarContrato } from "@/app/panel/personal/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PLAZOS_FIJOS, PLAZO_COMUN_MESES, PLAZO_MAXIMO_MESES, diasHasta, fechaTermino, type TrabajadorFila } from "@/lib/personal-comun";

const GRIS = "text-[#5B5970]";
const fechaCL = (iso: string) => iso.split("-").reverse().join("-");

/**
 * Renovar un contrato a plazo fijo: sumarle meses (una sola vez) o pasarlo a indefinido. Una segunda renovación, o seguir
 * trabajando después del término, lo deja indefinido por ley.
 */
export function RenovarContratoDialog({ persona, hoy, onCerrar }: { persona: TrabajadorFila; hoy: string; onCerrar: () => void }) {
  const [meses, setMeses] = useState(3);
  const [guardando, iniciar] = useTransition();
  const inicio = persona.fechaIngreso ?? "";
  const actual = persona.plazoMeses ?? 0;
  const termino = inicio && actual ? fechaTermino(inicio, actual) : "";
  const vencido = termino ? diasHasta(termino, hoy) < 0 : false;
  const soloIndefinido = vencido || persona.renovaciones >= 1;
  const total = actual + meses;
  const nuevoTermino = inicio ? fechaTermino(inicio, total) : "";

  function guardar(accion: number | "indefinido") {
    iniciar(async () => {
      const r = await renovarContrato(persona.id, accion);
      if (r.ok) {
        toast.success(accion === "indefinido" ? "Contrato pasó a indefinido" : "Contrato renovado");
        onCerrar();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renovar contrato</DialogTitle>
          <DialogDescription>
            {persona.nombre}
            {termino ? ` · termina el ${fechaCL(termino)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {soloIndefinido ? (
          <p className={`rounded-xl bg-[#F8F7FC] px-3.5 py-3 text-sm ${GRIS}`}>{vencido ? "El contrato ya venció. Si sigue trabajando, pasa a indefinido." : "Ya se renovó una vez. Una nueva renovación lo deja indefinido."}</p>
        ) : (
          <div>
            <span className="text-[13px] font-semibold">Renovar por</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PLAZOS_FIJOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMeses(m)}
                  aria-pressed={meses === m}
                  className={`h-9 min-w-[64px] rounded-lg border px-3 text-[13px] font-semibold ${meses === m ? "border-[#3A0CE3] bg-[#F4F1FF] text-[#2A07A8]" : "border-[#E4E1F0] text-[#46435C] hover:bg-[#F8F7FC]"}`}
                >
                  {m} {m === 1 ? "mes" : "meses"}
                </button>
              ))}
            </div>
            {nuevoTermino ? (
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                <span>
                  <span className={GRIS}>Nuevo término</span> <b className="font-semibold">{fechaCL(nuevoTermino)}</b>
                </span>
                {total > PLAZO_COMUN_MESES ? <span className="text-xs font-medium text-[#8A4B00]">Más de 1 año solo para gerentes o profesionales (máx. 2 años)</span> : null}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button variant="outline" disabled={guardando} onClick={() => guardar("indefinido")}>
            Pasar a indefinido
          </Button>
          {!soloIndefinido ? (
            <Button disabled={guardando || total > PLAZO_MAXIMO_MESES} onClick={() => guardar(meses)}>
              {guardando ? <Loader2 className="animate-spin" /> : null}
              Renovar
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
