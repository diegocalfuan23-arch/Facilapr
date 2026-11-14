"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

const GRIS = "text-[#5B5970]";
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const corto = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);

type Mes = { corto: string; largo: string };

/** Curva monótona: no se pasa de los puntos (no inventa valores negativos ni picos). */
function curva(p: [number, number][]) {
  const n = p.length;
  if (n < 2) return "";
  const d = p.slice(0, -1).map((a, i) => (p[i + 1][1] - a[1]) / (p[i + 1][0] - a[0] || 1));
  const m = p.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  let s = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (p[i + 1][0] - p[i][0]) / 3;
    s += ` C${p[i][0] + h},${p[i][1] + m[i] * h} ${p[i + 1][0] - h},${p[i + 1][1] - m[i + 1] * h} ${p[i + 1][0]},${p[i + 1][1]}`;
  }
  return s;
}

/** El tope redondeado del eje: 29.200 → 30.000, 790 → 800. */
const techo = (max: number) => {
  const e = Math.pow(10, Math.floor(Math.log10(Math.max(max, 1))));
  return Math.ceil(max / e) * e;
};

function Ejes({ tope, formato }: { tope: number; formato: (n: number) => string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {[1, 0.5, 0].map((f) => (
        <div key={f} className="absolute inset-x-0 flex items-center gap-2" style={{ top: `${(1 - f) * 100}%` }}>
          <span className={cn("w-11 -translate-y-1/2 text-right text-[11px] tabular-nums", GRIS)}>{f === 0 ? "0" : formato(tope * f)}</span>
          <span className={cn("flex-1 -translate-y-1/2 border-t", f === 0 ? "border-[#E4E1F0]" : "border-dashed border-[#ECEAF4]")} />
        </div>
      ))}
    </div>
  );
}

/** La recaudación mes a mes: una curva con relleno, y el valor de cada mes al pasar el mouse o al enfocar. */
export function GraficoRecaudacion({ meses, valores, actual }: { meses: Mes[]; valores: number[]; actual: number }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const tope = techo(Math.max(...valores, 1));
  const W = 700;
  const H = 200;
  const pts = valores.map((v, i) => [(i + 0.5) * (W / valores.length), H - (v / tope) * H] as [number, number]);
  const linea = curva(pts);
  const ver = hover ?? actual;
  return (
    <div className="mt-12 sm:mt-14">
      <div className="relative h-[150px] sm:h-[210px]">
        <Ejes tope={tope} formato={corto} />
        <div className="absolute inset-y-0 right-0 left-[52px]">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id={`${id}-r`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6B46F5" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#6B46F5" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${linea} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`} fill={`url(#${id}-r)`} />
            <path d={linea} fill="none" stroke="#3A0CE3" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            <line x1={pts[ver][0]} x2={pts[ver][0]} y1={pts[ver][1]} y2={H} stroke="#3A0CE3" strokeOpacity="0.25" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          </svg>
          {pts.map(([x, y], i) => (
            <span
              key={i}
              aria-hidden
              className={cn("absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white", i === ver ? "size-3.5 bg-[#3A0CE3] shadow-[0_0_0_4px_rgba(58,12,227,0.15)]" : "bg-[#A895F8]")}
              style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
            />
          ))}
          <div
            className={cn(
              "pointer-events-none absolute z-10 -translate-y-[calc(100%+14px)] rounded-lg bg-[#15132B] px-2.5 py-1.5 text-center whitespace-nowrap text-white shadow-lg",
              ver >= valores.length - 1 ? "-translate-x-[80%]" : ver === 0 ? "-translate-x-[20%]" : "-translate-x-1/2"
            )}
            style={{ left: `${(pts[ver][0] / W) * 100}%`, top: `${(pts[ver][1] / H) * 100}%` }}
          >
            <span className="block text-[11px] text-white/70">{meses[ver].largo}</span>
            <span className="block text-[13px] font-semibold tabular-nums">{clp(valores[ver])}</span>
          </div>
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${valores.length}, 1fr)` }}>
            {valores.map((v, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${meses[i].largo}: ${clp(v)}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="focus-visible:outline-none"
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 ml-[52px] grid" style={{ gridTemplateColumns: `repeat(${valores.length}, 1fr)` }}>
        {meses.map((m, i) => (
          <span key={m.largo} className={cn("text-center text-[11px]", i === ver ? "font-semibold text-[#15132B]" : GRIS)}>
            {m.corto}
          </span>
        ))}
      </div>
    </div>
  );
}

/** El consumo de agua por mes: barras, con el mes actual destacado, los meses sin lecturas con una línea punteada y el mes raro rayado. */
export function GraficoConsumo({ meses, valores, actual, raro }: { meses: Mes[]; valores: (number | null)[]; actual: number; raro: number | null }) {
  const tope = techo(Math.max(...valores.map((v) => v ?? 0), 1));
  return (
    <div className="mt-5">
      <div className="relative h-[130px] sm:h-[170px]">
        <Ejes tope={tope} formato={(n) => `${Math.round(n)} m³`} />
        <ul className="absolute inset-y-0 right-0 left-[52px] grid items-end gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${valores.length}, 1fr)` }}>
          {valores.map((v, i) => (
            <li key={i} className="group relative flex h-full items-end justify-center">
              {v == null ? (
                <span title="Sin lecturas" className="h-[3px] w-full max-w-[34px] bg-[repeating-linear-gradient(90deg,#CFCBE0_0_4px,transparent_4px_7px)]" />
              ) : (
                <span
                  className={cn(
                    "w-full max-w-[34px] rounded-t-md",
                    i === actual ? "bg-linear-to-t from-[#0B6FB0] to-[#2BA8EE]" : i === raro ? "bg-[repeating-linear-gradient(135deg,#FCE3BE_0_6px,#FFF1DC_6px_12px)] ring-1 ring-[#F0C27A] ring-inset" : "bg-[#CDE9FA]"
                  )}
                  style={{ height: `${Math.max((v / tope) * 100, 1)}%` }}
                />
              )}
              <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-[#15132B] px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-white group-hover:block">
                {meses[i].largo}: {v == null ? "Sin lecturas" : `${v.toLocaleString("es-CL")} m³`}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-2 ml-[52px] grid gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${valores.length}, 1fr)` }}>
        {meses.map((m, i) => (
          <span key={m.largo} className={cn("text-center text-[11px]", i === actual ? "font-semibold text-[#15132B]" : GRIS)}>
            {m.corto}
          </span>
        ))}
      </div>
    </div>
  );
}

/** El anillo de lo cobrado, sobre el fondo morado de la tarjeta principal. */
export function Anillo({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[92px] shrink-0 sm:size-[132px]">
      <svg viewBox="0 0 132 132" className="size-full -rotate-90" aria-hidden>
        <circle cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="12" />
        <circle cx="66" cy="66" r={r} fill="none" stroke="#7CF0C4" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(Math.max(Math.min(pct, 100), 2) / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[20px] leading-none font-semibold tabular-nums sm:text-[28px]">{pct}%</span>
        <span className="mt-1 text-[11px] text-white/70">cobrado</span>
      </div>
    </div>
  );
}

/** El saldo de la caja de los últimos días, en miniatura. Con menos de dos puntos no hay curva que dibujar. */
export function MiniSaldo({ valores }: { valores: number[] }) {
  const id = useId();
  if (valores.length < 2) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const pts = valores.map((v, i) => [(i / (valores.length - 1)) * 100, 36 - ((v - min) / (max - min || 1)) * 30 - 3] as [number, number]);
  const l = curva(pts);
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
      <defs>
        <linearGradient id={`${id}-m`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2FB386" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#2FB386" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${l} L100,36 L0,36 Z`} fill={`url(#${id}-m)`} />
      <path d={l} fill="none" stroke="#1F9A70" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
