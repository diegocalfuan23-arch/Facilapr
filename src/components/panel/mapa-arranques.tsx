"use client";

/**
 * Mapas de arranques con Leaflet + OpenStreetMap (gratis, sin clave). Se cargan solo en el navegador
 * (`next/dynamic` con ssr: false) porque Leaflet necesita `window`.
 */
import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Layers, LocateFixed } from "lucide-react";
import type { Punto } from "@/lib/arranques-comun";

export type ArranqueMapa = { id: string; nombre: string; lat: number | null; lng: number | null; socios: number };

/** Centro por defecto del mapa cuando todavía no hay ningún arranque ubicado (La Araucanía). */
const CENTRO_POR_DEFECTO: Punto = { lat: -38.7714, lng: -72.5937 };

const CAPAS = {
  mapa: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satelite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: "Imágenes &copy; Esri",
  },
} as const;

const pin = (activo = true) =>
  L.divIcon({
    className: "",
    iconSize: [30, 38],
    iconAnchor: [15, 36],
    html: `<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 4px rgba(21,19,43,.25))"><path d="M15 37s12-12.2 12-21.5C27 8.6 21.6 3 15 3S3 8.6 3 15.5C3 24.8 15 37 15 37z" fill="${activo ? "#3A0CE3" : "#8F78F2"}" stroke="#fff" stroke-width="2.5"/><circle cx="15" cy="15.5" r="4.5" fill="#fff"/></svg>`,
  });

/** El nombre va en un nodo de texto (no en HTML) para que un nombre con símbolos no rompa ni inyecte nada. */
const etiqueta = (nombre: string, n: number, activo: boolean) => {
  const raiz = document.createElement("div");
  raiz.style.cssText = "transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center";
  const chip = document.createElement("div");
  chip.style.cssText = `white-space:nowrap;padding:5px 9px;border-radius:9px;font:600 12px/1.2 system-ui;background:${activo ? "#3A0CE3" : "#fff"};color:${activo ? "#fff" : "#15132B"};box-shadow:0 4px 12px rgba(21,19,43,.18)`;
  chip.append(document.createTextNode(`${nombre} `));
  const cuenta = document.createElement("span");
  cuenta.style.cssText = "opacity:.7;font-weight:500";
  cuenta.textContent = `· ${n}`;
  chip.append(cuenta);
  const palo = document.createElement("div");
  palo.style.cssText = `width:2px;height:8px;background:${activo ? "#3A0CE3" : "#fff"}`;
  const punto = document.createElement("div");
  punto.style.cssText = `width:10px;height:10px;border-radius:99px;background:${activo ? "#3A0CE3" : "#6B46F5"};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25)`;
  raiz.append(chip, palo, punto);
  return L.divIcon({ className: "", iconSize: [0, 0], iconAnchor: [0, 0], html: raiz });
};

function SinPrefijo() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl?.setPrefix(false);
  }, [map]);
  return null;
}

function AlTocar({ onTocar }: { onTocar: (p: Punto) => void }) {
  useMapEvents({ click: (e) => onTocar({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Acerca el mapa a los puntos. Solo se mueve cuando cambian de verdad, no en cada pintado. */
function Encuadrar({ clave }: { clave: string }) {
  const map = useMap();
  useEffect(() => {
    const puntos = clave ? clave.split("|").map((t) => t.split(",").map(Number) as [number, number]) : [];
    if (puntos.length === 1) map.setView(puntos[0], 15);
    else if (puntos.length > 1) map.fitBounds(L.latLngBounds(puntos), { padding: [48, 48] });
  }, [map, clave]);
  return null;
}

function SelectorCapa({ capa, onCambio }: { capa: keyof typeof CAPAS; onCambio: (c: keyof typeof CAPAS) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onCambio(capa === "mapa" ? "satelite" : "mapa");
      }}
      className="absolute top-2 right-2 z-[500] flex h-8 items-center gap-1.5 rounded-lg bg-white/95 px-2.5 text-xs font-semibold text-[#15132B] shadow-md hover:bg-white focus-visible:ring-2 focus-visible:ring-[#6B46F5] focus-visible:outline-none"
    >
      <Layers className="size-3.5" aria-hidden />
      {capa === "mapa" ? "Satélite" : "Mapa"}
    </button>
  );
}

const clavePuntos = (ps: Punto[]) => ps.map((p) => `${p.lat},${p.lng}`).join("|");

/** Mapa chico del detalle. Si `editable`, tocar el mapa elige el punto. */
export function MapaArranque({ punto, editable, onElegir, alto = 180 }: { punto?: Punto; editable?: boolean; onElegir?: (p: Punto) => void; alto?: number }) {
  const [capa, setCapa] = useState<keyof typeof CAPAS>("mapa");
  const [buscando, setBuscando] = useState(false);
  const [errorGps, setErrorGps] = useState(false);
  const usarGps = () => {
    if (!navigator.geolocation || !onElegir) return;
    setBuscando(true);
    setErrorGps(false);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onElegir({ lat: p.coords.latitude, lng: p.coords.longitude });
        setBuscando(false);
      },
      () => {
        setBuscando(false);
        setErrorGps(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  const centro = punto ?? CENTRO_POR_DEFECTO;
  return (
    <div className={`relative isolate overflow-hidden rounded-xl border border-[#ECEAF4] ${editable ? "cursor-crosshair" : ""}`} style={{ height: alto }}>
      <MapContainer center={[centro.lat, centro.lng]} zoom={punto ? 15 : 13} scrollWheelZoom={false} zoomControl={false} attributionControl className="size-full" style={{ background: "#EEF0F4" }}>
        <TileLayer key={capa} url={CAPAS[capa].url} attribution={CAPAS[capa].attr} />
        <SinPrefijo />
        {punto ? <Marker position={[punto.lat, punto.lng]} icon={pin()} /> : null}
        {punto ? <Encuadrar clave={clavePuntos([punto])} /> : null}
        {editable && onElegir ? <AlTocar onTocar={onElegir} /> : null}
      </MapContainer>
      <SelectorCapa capa={capa} onCambio={setCapa} />
      {editable ? (
        <button
          type="button"
          onClick={usarGps}
          className="absolute bottom-2 left-2 z-[500] flex h-8 items-center gap-1.5 rounded-lg bg-[#15132B] px-2.5 text-xs font-semibold text-white shadow-md hover:bg-[#15132B]/90 focus-visible:ring-2 focus-visible:ring-[#6B46F5] focus-visible:outline-none"
        >
          <LocateFixed className="size-3.5" aria-hidden />
          {buscando ? "Buscando…" : errorGps ? "No se pudo, reintentar" : "Mi ubicación"}
        </button>
      ) : null}
    </div>
  );
}

/** Mapa grande con todos los arranques ubicados. */
export function MapaRed({ arranques, sel, onElegir, alto = 460 }: { arranques: ArranqueMapa[]; sel: string | null; onElegir: (id: string) => void; alto?: number }) {
  const [capa, setCapa] = useState<keyof typeof CAPAS>("mapa");
  const ubicados = arranques.filter((a): a is ArranqueMapa & { lat: number; lng: number } => a.lat !== null && a.lng !== null);
  const puntos = ubicados.map((a) => ({ lat: a.lat, lng: a.lng }));
  const centro = puntos[0] ?? CENTRO_POR_DEFECTO;
  return (
    <div className="relative isolate" style={{ height: alto }}>
      <MapContainer center={[centro.lat, centro.lng]} zoom={13} scrollWheelZoom className="size-full" style={{ background: "#EEF0F4" }}>
        <TileLayer key={capa} url={CAPAS[capa].url} attribution={CAPAS[capa].attr} />
        <SinPrefijo />
        {ubicados.map((a) => (
          <Marker key={a.id} position={[a.lat, a.lng]} icon={etiqueta(a.nombre, a.socios, a.id === sel)} eventHandlers={{ click: () => onElegir(a.id) }} />
        ))}
        <Encuadrar clave={clavePuntos(puntos)} />
      </MapContainer>
      <SelectorCapa capa={capa} onCambio={setCapa} />
    </div>
  );
}
