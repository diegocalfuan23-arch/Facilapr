"use client";

import { useEffect, useId, useState } from "react";
import { MapPinOff } from "lucide-react";
import type { Punto } from "@/lib/ubicacion";

const GRIS = "text-[#5B5970]";

export type PuntoCroquis = {
  /** Su lugar en el recorrido. */
  n: number;
  lat: number;
  lng: number;
  /** Solo en terreno: los hechos van en verde y el actual resaltado. */
  estado?: "hecho" | "actual" | "pendiente";
};

/**
 * El recorrido dibujado con las ubicaciones marcadas: puntos numerados en el orden de visita, sin mapa de fondo.
 * Con `seguirme` muestra también dónde está quien mira, según el GPS del teléfono (solo mientras el dibujo está abierto).
 */
export function CroquisRuta({ nombre, color, puntos, faltan, seguirme = false }: { nombre: string; color: string; puntos: PuntoCroquis[]; faltan: number; seguirme?: boolean }) {
  const idGrilla = useId();
  const [aqui, setAqui] = useState<Punto | null>(null);

  useEffect(() => {
    if (!seguirme || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setAqui({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [seguirme]);

  if (puntos.length === 0) {
    return (
      <div className="flex h-[170px] flex-col items-center justify-center gap-1 rounded-xl bg-[#F3F4FA] px-6 text-center ring-1 ring-[#ECEAF4]">
        <MapPinOff className="size-5 text-[#8A4B00]" aria-hidden />
        <p className="text-[13px] font-semibold">Aún no hay ubicaciones</p>
        <p className={`text-xs ${GRIS}`}>Se marcan con «Marcar aquí» al visitar a cada socio.</p>
      </div>
    );
  }

  // Un grado de longitud mide menos que uno de latitud (~38°S): se corrige para que el dibujo no quede estirado.
  const todos = aqui ? [...puntos, { lat: aqui.lat, lng: aqui.lng }] : puntos;
  const xs = todos.map((p) => p.lng * 0.79);
  const ys = todos.map((p) => -p.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const ancho = Math.max(Math.max(...xs) - minX, 1e-5);
  const alto = Math.max(Math.max(...ys) - minY, 1e-5);
  const W = 340;
  const H = 150;
  const k = Math.min((W - 40) / ancho, (H - 40) / alto);
  const ox = (W - ancho * k) / 2;
  const oy = (H - alto * k) / 2;
  const sitio = (p: { lat: number; lng: number }) => ({ x: ox + (p.lng * 0.79 - minX) * k, y: oy + (-p.lat - minY) * k });
  const pos = puntos.map((p) => ({ ...p, ...sitio(p) }));
  const camino = pos.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const yo = aqui ? sitio(aqui) : null;
  const conEstado = puntos.some((p) => p.estado);

  return (
    <div className="overflow-hidden rounded-xl bg-[#F3F4FA] ring-1 ring-[#ECEAF4]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-[170px] w-full" role="img" aria-label={`Croquis de ${nombre}: ${puntos.length} socios con ubicación, en orden de visita`}>
        <defs>
          <pattern id={idGrilla} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0V16" fill="none" stroke="#E3E4F0" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill={`url(#${idGrilla})`} />
        <path d={camino} fill="none" stroke={color} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
        {pos.map((p) => {
          const hecho = p.estado === "hecho";
          const actual = p.estado === "actual";
          return (
            <g key={p.n}>
              {actual ? <circle cx={p.x} cy={p.y} r="12" fill={color} opacity="0.2" /> : null}
              <circle cx={p.x} cy={p.y} r={actual ? 9 : 8} fill={hecho ? "#0A7A52" : color} stroke={actual ? "#fff" : "none"} strokeWidth="2" />
              <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">
                {p.n}
              </text>
            </g>
          );
        })}
        {yo ? (
          <g>
            <circle cx={yo.x} cy={yo.y} r="11" fill="#0B84C6" opacity="0.2" />
            <circle cx={yo.x} cy={yo.y} r="5.5" fill="#0B84C6" stroke="#fff" strokeWidth="2" />
          </g>
        ) : null}
      </svg>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#ECEAF4] bg-white px-3 py-1.5 text-[11px] text-[#46435C]">
        {conEstado ? (
          <>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-[#0A7A52]" />
              Hecho
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full" style={{ background: color }} />
              Por visitar
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ background: color }} />
            Socio, en orden de visita
          </span>
        )}
        {seguirme ? (
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-[#0B84C6]" />
            {yo ? "Tú" : "Buscando tu posición…"}
          </span>
        ) : null}
        {faltan > 0 ? (
          <span className="ml-auto flex items-center gap-1 font-medium text-[#8A4B00]">
            <MapPinOff className="size-3" aria-hidden />
            {faltan} sin ubicación
          </span>
        ) : !seguirme ? (
          <span className="ml-auto text-[#8F8CA3]">Según GPS</span>
        ) : null}
      </div>
    </div>
  );
}
