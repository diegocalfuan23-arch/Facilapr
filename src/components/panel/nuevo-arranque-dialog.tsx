"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LocateFixed } from "lucide-react";
import { guardarArranque, type ResultadoArranques } from "@/app/panel/arranques/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Punto } from "@/lib/arranques-comun";

const GRIS = "text-[#5B5970]";

/** Crear un arranque: su nombre, dónde está y, si se quiere, su punto con el GPS. Después se le asignan los socios. */
export function NuevoArranqueDialog({ onCerrar, onCreado }: { onCerrar: () => void; onCreado?: () => void }) {
  const [estado, enviar, pendiente] = useActionState<ResultadoArranques | null, FormData>(guardarArranque, null);
  const [punto, setPunto] = useState<Punto | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [errorGps, setErrorGps] = useState<string | null>(null);

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Arranque registrado");
      onCreado?.();
      onCerrar();
    }
  }, [estado, onCerrar, onCreado]);

  function usarGps() {
    if (!navigator.geolocation) {
      setErrorGps("Este dispositivo no permite usar el GPS.");
      return;
    }
    setBuscando(true);
    setErrorGps(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPunto({ lat: p.coords.latitude, lng: p.coords.longitude });
        setBuscando(false);
      },
      () => {
        setBuscando(false);
        setErrorGps("No pudimos obtener tu ubicación. Revisa el permiso del navegador o márcala después en el mapa.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-[460px] overflow-hidden rounded-2xl p-0">
        <div className="bg-gradient-to-br from-[#3A0CE3] to-[#6B46F5] px-5 pt-5 pb-5 text-white">
          <DialogTitle className="text-lg font-semibold">Nuevo arranque</DialogTitle>
          <DialogDescription className="mt-0.5 text-[13px] text-white/80">Después podrás asignarle socios.</DialogDescription>
        </div>
        <form action={enviar} className="flex flex-col gap-4 p-5">
          <input type="hidden" name="socios" value="[]" />
          {punto && (
            <>
              <input type="hidden" name="lat" value={punto.lat} />
              <input type="hidden" name="lng" value={punto.lng} />
            </>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Nombre
            <Input name="nombre" autoFocus required maxLength={120} placeholder="Ej.: Arranque 4" className="h-11 rounded-lg border-[#E4E1F0] shadow-none" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Dónde está <span className={`font-normal ${GRIS}`}>(opcional)</span>
            </span>
            <Input name="ubicacion" maxLength={200} placeholder="Ej.: Camino a Maquehue, km 3" className="h-11 rounded-lg border-[#E4E1F0] shadow-none" />
          </label>
          <div className="flex flex-col gap-1.5">
            <Button type="button" variant="outline" onClick={usarGps} disabled={buscando} className="h-10 justify-start rounded-lg border-dashed border-[#D6D1EC] font-semibold text-[#2A07A8]">
              {buscando ? <Loader2 className="animate-spin" /> : <LocateFixed />}
              {punto ? "Ubicación tomada: volver a tomarla" : "Usar mi ubicación actual (GPS)"}
            </Button>
            {punto && (
              <p className={`text-xs tabular-nums ${GRIS}`}>
                {punto.lat.toFixed(5)}, {punto.lng.toFixed(5)}
              </p>
            )}
            {errorGps && (
              <p className="text-xs text-destructive" role="alert">
                {errorGps}
              </p>
            )}
          </div>
          {estado && !estado.ok && (
            <p className="text-[13px] text-destructive" role="alert">
              {estado.error}
            </p>
          )}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCerrar} className="h-10 rounded-lg px-4 font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente} className="h-10 rounded-lg px-5 font-semibold">
              {pendiente && <Loader2 className="animate-spin" />}
              Crear arranque
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
