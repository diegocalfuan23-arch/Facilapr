"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CLASES, claseDe } from "@/lib/ausencias-clases";
import type { AusenciaFila } from "@/lib/rrhh-comun";

const MOTIVOS_RAPIDOS = ["Coincide con otra ausencia", "Período de toma de lecturas", "No tiene días suficientes", "Lo pidió el trabajador"];

const corta = (iso: string) => iso.split("-").reverse().slice(0, 2).join("-");

/** Pide el motivo al rechazar una solicitud o anular unas vacaciones ya aprobadas. El motivo queda en la tarjeta. */
export function MotivoRechazoDialog({
  ausencia,
  anular,
  onCerrar,
  onConfirmar,
}: {
  ausencia: AusenciaFila;
  /** true: se anula algo que ya estaba aprobado. */
  anular: boolean;
  onCerrar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const clase = CLASES[claseDe(ausencia)];
  const fechas = ausencia.desde === ausencia.hasta ? corta(ausencia.desde) : `${corta(ausencia.desde)} al ${corta(ausencia.hasta)}`;
  const verbo = anular ? "Anular" : "Rechazar";

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent showCloseButton={false} className="gap-0 rounded-2xl bg-white p-6 sm:max-w-[520px] sm:p-6">
        <DialogTitle className="text-lg font-semibold">
          {verbo} {clase.texto.toLowerCase()}
        </DialogTitle>
        <p className="mt-1 text-sm text-[#5B5970]">
          {ausencia.trabajador} · {fechas}. El motivo queda registrado.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {MOTIVOS_RAPIDOS.map((m) => (
            <button key={m} type="button" onClick={() => setMotivo(m)} className={`h-9 rounded-full border px-3.5 text-[13px] ${motivo === m ? "border-[#3A0CE3] bg-[#F4F1FF] font-semibold text-[#2A07A8]" : "border-[#E4E1F0] text-[#46435C] hover:bg-[#F8F7FC]"}`}>
              {m}
            </button>
          ))}
        </div>

        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value.slice(0, 300))}
          placeholder="Escribe el motivo"
          rows={3}
          autoFocus
          className="mt-3 w-full resize-none rounded-xl border border-[#E4E1F0] bg-white px-3.5 py-3 text-[15px] outline-none placeholder:text-[#A19FB2] focus-visible:border-[#3A0CE3] focus-visible:ring-2 focus-visible:ring-[#3A0CE3]/20"
        />

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCerrar} className="h-11 rounded-xl border-[#E4E1F0] bg-white font-semibold">
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!motivo.trim()}
            onClick={() => {
              onConfirmar(motivo.trim());
              onCerrar();
            }}
            className="h-11 rounded-xl bg-[#D6403D] px-5 font-semibold hover:bg-[#B8322F]"
          >
            {verbo}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
