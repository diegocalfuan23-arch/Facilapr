"use client";

import { useEffect, useState } from "react";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Los mismos textos que arma la app (boleta disponible y comprobante de pago), con un comité de ejemplo.
 * Cada mensaje entra uno tras otro y la secuencia vuelve a empezar. Con "reducir movimiento" se ven todos quietos.
 */
const MENSAJES = [
  {
    hora: "9:02",
    etiqueta: "Boleta del mes",
    lineas: [
      "Hola María, te escribe APR Las Vertientes. Tu boleta de agua de noviembre de 2026 ya está disponible por un total de $12.400, con vencimiento el 10-12-2026. Descarga tu recibo en PDF aquí: facilapr.cl/r/k3x9",
      "",
      "Gracias por tu pago.",
    ],
  },
  {
    hora: "16:40",
    etiqueta: "Comprobante de pago",
    lineas: [
      "Hola María, te escribe APR Las Vertientes.",
      "",
      "Registramos tu pago de $12.400 de la boleta de noviembre de 2026.",
      "Con esto la boleta queda pagada completa. ¡Gracias!",
      "",
      "Descarga tu comprobante: facilapr.cl/r/p7m2",
    ],
  },
];

/** Pasos de la secuencia: 0 vacío, uno por mensaje y una pausa final antes de reiniciar. */
const PASOS = MENSAJES.length + 2;

export function MensajesWhatsapp() {
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPaso((p) => (p + 1) % PASOS), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      role="img"
      aria-label="Así recibe el socio por WhatsApp su boleta del mes y, al pagar, su comprobante"
      className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[2rem] border-[6px] border-[#15132B] bg-[#ECE5DD] shadow-[0_16px_40px_rgba(21,19,43,0.18)]"
    >
      <div className="flex items-center gap-2.5 bg-[#075E54] px-4 py-3 text-white">
        <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
          AV
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.92rem] font-semibold">APR Las Vertientes</p>
          <p className="text-[0.72rem] text-white/75">Cuenta de empresa</p>
        </div>
      </div>

      <div className="flex min-h-[420px] flex-col justify-end gap-2.5 px-3 py-4">
        {MENSAJES.map((m, i) => {
          const visible = paso > i;
          return (
            <div
              key={m.etiqueta}
              className={cn(
                "max-w-[92%] rounded-xl rounded-tl-sm bg-white px-3 py-2 text-[0.8rem] leading-snug text-[#15132B] shadow-sm transition-all duration-500 motion-reduce:translate-y-0 motion-reduce:opacity-100",
                visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              )}
            >
              {m.lineas.map((l, j) => (
                <p key={j} className={l === "" ? "h-2" : undefined}>
                  {l}
                </p>
              ))}
              <p className="mt-1 flex items-center justify-end gap-1 text-[0.68rem] text-[#667781]">
                {m.hora}
                {i === 0 ? <Check className="size-3" aria-hidden /> : <CheckCheck className="size-3 text-[#34B7F1]" aria-hidden />}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
