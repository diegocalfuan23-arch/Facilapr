"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Navigation } from "lucide-react";
import { marcarUbicacion } from "@/app/panel/lecturas/ubicacion-actions";
import { Button } from "@/components/ui/button";
import { encolarUbicacion } from "@/lib/ubicaciones-offline";
import { PRECISION_BUENA_M, distanciaM, rumboGrados, textoDistancia, textoRumbo, type Punto } from "@/lib/ubicacion";
import { cn } from "@/lib/utils";

const GRIS = "text-[#5B5970]";

export type UbicacionSocio = { lat: number; lng: number; precision: number | null };
type Gps = Punto & { precision: number };

/**
 * Dónde queda el socio, para quien sale a terreno. Con ubicación: a cuántos metros y hacia dónde está, según el GPS del
 * teléfono (sin mapas ni internet). Sin ubicación: se marca parado frente a la casa y queda para las próximas visitas.
 */
export function UbicacionSocioCampo({ socioId, nombre, ubicacion }: { socioId: string; nombre: string; ubicacion: UbicacionSocio | null }) {
  const [guardada, setGuardada] = useState<UbicacionSocio | null>(null);
  const actual = guardada ?? ubicacion;
  const [marcando, setMarcando] = useState(false);
  const [gps, setGps] = useState<Gps | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  // El GPS se enciende solo cuando hace falta: para mostrar la distancia o para marcar.
  const necesitaGps = Boolean(actual) || marcando;
  useEffect(() => {
    if (!necesitaGps) return;
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGps({ lat: p.coords.latitude, lng: p.coords.longitude, precision: Math.round(p.coords.accuracy) });
        setError(null);
      },
      (e) => setError(e.code === 1 ? "Permite el acceso a la ubicación en el navegador." : "Todavía no hay señal de GPS."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [necesitaGps]);

  function guardar() {
    if (!gps) return;
    const u = { socioId, lat: gps.lat, lng: gps.lng, precision: gps.precision };
    const alTeléfono = () => {
      encolarUbicacion(u);
      setGuardada({ lat: u.lat, lng: u.lng, precision: u.precision });
      setMarcando(false);
      toast.message("Ubicación guardada en este teléfono: se envía al volver la señal.");
    };
    if (!navigator.onLine) return alTeléfono();
    iniciar(async () => {
      try {
        const r = await marcarUbicacion(u.socioId, u.lat, u.lng, u.precision);
        if (r.ok) {
          setGuardada({ lat: u.lat, lng: u.lng, precision: u.precision });
          setMarcando(false);
          toast.success("Ubicación guardada");
        } else toast.error(r.error);
      } catch {
        alTeléfono();
      }
    });
  }

  function abrirMapa(e: React.MouseEvent<HTMLAnchorElement>) {
    // El enlace «geo:» deja que el teléfono elija con qué app abrirlo. En iPhone no existe: se abre OpenStreetMap.
    if (actual && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      e.preventDefault();
      window.open(`https://www.openstreetmap.org/?mlat=${actual.lat}&mlon=${actual.lng}#map=18/${actual.lat}/${actual.lng}`, "_blank", "noopener");
    }
  }

  if (marcando) {
    const buena = gps !== null && gps.precision <= PRECISION_BUENA_M;
    return (
      <div className="mx-4 mb-3 rounded-xl bg-[#F8F7FC] p-3 sm:mx-5">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold">
          <MapPin className="size-4 text-[#3A0CE3]" aria-hidden />
          Párate frente a la casa de {nombre}
        </p>
        <p role="status" className={cn("mt-1.5 flex items-center gap-1.5 text-sm", buena ? "font-semibold text-[#075A3C]" : GRIS)}>
          {gps === null ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {error ?? "Buscando señal de GPS…"}
            </>
          ) : buena ? (
            <>
              <CheckCircle2 className="size-4" aria-hidden />
              Precisión: {gps.precision} m
            </>
          ) : (
            <>
              <AlertTriangle className="size-4 text-[#8F4400]" aria-hidden />
              Precisión: {gps.precision} m · esperando mejor señal
            </>
          )}
        </p>
        <div className="mt-2.5 flex gap-2">
          <Button type="button" onClick={guardar} disabled={gps === null || guardando} className="h-10 rounded-lg font-semibold">
            {guardando ? <Loader2 className="animate-spin" /> : null}
            {buena || gps === null ? "Guardar ubicación" : "Guardar igual"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setMarcando(false)} disabled={guardando} className="h-10 rounded-lg">
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (!actual) {
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-[#FFF8EC] px-3 py-2.5 sm:mx-5">
        <MapPin className="size-4 shrink-0 text-[#8F4400]" aria-hidden />
        <span className="min-w-0 flex-1 text-[13px] text-[#6B3A00]">Sin ubicación</span>
        <Button type="button" size="sm" variant="outline" onClick={() => setMarcando(true)} className="h-9 rounded-lg bg-white font-semibold">
          Marcar aquí
        </Button>
      </div>
    );
  }

  const aqui = gps ? { lat: gps.lat, lng: gps.lng } : null;
  const metros = aqui ? distanciaM(aqui, actual) : null;
  const porConfirmar = actual.precision !== null && actual.precision > PRECISION_BUENA_M;

  return (
    <div className="mx-4 mb-3 rounded-xl bg-[#F8F7FC] px-3 py-2.5 sm:mx-5">
      <div className="flex items-center gap-2">
        <Navigation className="size-4 shrink-0 text-[#3A0CE3]" aria-hidden />
        <p className="min-w-0 flex-1 text-sm font-semibold">
          {metros !== null && aqui ? (
            metros < 15 ? (
              "Ya estás aquí"
            ) : (
              <>
                A {textoDistancia(metros)} <span className="font-medium">{textoRumbo(rumboGrados(aqui, actual))}</span>
              </>
            )
          ) : (
            <span className={cn("font-normal", GRIS)}>{error ?? "Calculando tu posición…"}</span>
          )}
        </p>
        <a href={`geo:${actual.lat},${actual.lng}?q=${actual.lat},${actual.lng}`} onClick={abrirMapa} className="shrink-0 text-xs font-semibold text-[#2A07A8] hover:underline">
          Abrir en el mapa
        </a>
      </div>
      <p className={cn("mt-1 flex flex-wrap items-center gap-x-2 text-xs", GRIS)}>
        {porConfirmar ? <span className="font-semibold text-[#8F4400]">Ubicación por confirmar</span> : null}
        <button type="button" onClick={() => setMarcando(true)} className="font-semibold text-[#2A07A8] hover:underline">
          Volver a marcar
        </button>
      </p>
    </div>
  );
}
