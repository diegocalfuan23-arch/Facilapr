"use client";

import { useId, useState } from "react";
import { Check, Droplet } from "lucide-react";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const puntos = [
  {
    titulo: "Consumo, cargo fijo y variable",
    detalle:
      "Desglosados igual que en la boleta impresa, para que el socio entienda de dónde sale el total.",
  },
  {
    titulo: "Historial de boletas pendientes",
    detalle:
      "Si hay más de un mes impago, Facilapr lo suma y lo explica sin que el socio tenga que preguntar dos veces.",
  },
  {
    titulo: "Cálculo automático, nunca a mano",
    detalle:
      "Cargas el cargo fijo, el valor del m³ y la lectura del medidor; Facilapr calcula el total y emite la boleta.",
  },
];

/** Valores por defecto: un cargo fijo y tarifa típicos de un APR chileno. */
const CARGO_FIJO_INICIAL = 2100;
const VALOR_M3_INICIAL = 450;
const CONSUMO_INICIAL = 14;

/** Quita ceros a la izquierda mientras se escribe, para que "0" + "2" dé "2" y no "02". */
function limpiarCeros(valor: string) {
  const soloDigitos = valor.replace(/\D/g, "");
  const sinCeros = soloDigitos.replace(/^0+(?=\d)/, "");
  return sinCeros;
}

function CampoMonto({
  id,
  etiqueta,
  valor,
  onCambiar,
}: {
  id: string;
  etiqueta: string;
  valor: number;
  onCambiar: (valor: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.78rem] text-muted-foreground">
        {etiqueta}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={valor === 0 ? "" : String(valor)}
        placeholder="0"
        onChange={(e) => {
          const limpio = limpiarCeros(e.target.value);
          onCambiar(limpio === "" ? 0 : Number(limpio));
        }}
        className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 font-mono text-[0.9rem] tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
  );
}

export function InvoiceSection() {
  const idCargoFijo = useId();
  const idValorM3 = useId();
  const idConsumo = useId();

  const [cargoFijo, setCargoFijo] = useState(CARGO_FIJO_INICIAL);
  const [valorM3, setValorM3] = useState(VALOR_M3_INICIAL);
  const [consumo, setConsumo] = useState(CONSUMO_INICIAL);

  const totalConsumo = valorM3 * consumo;
  const total = cargoFijo + totalConsumo;

  return (
    <section id="boleta" className="border-y border-border bg-muted/40 py-24">
      <div className="mx-auto grid max-w-[1180px] gap-16 px-7 sm:grid-cols-[0.9fr_1.1fr] sm:items-center">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          <div className="bg-foreground px-5.5 py-4.5 text-background">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary">
                <Droplet className="size-3.5 fill-white text-white" />
              </span>
              <span className="text-[0.98rem] font-semibold">
                Simula la boleta de tu APR
              </span>
            </div>
            <p className="mt-2 text-[0.8rem] opacity-75">
              Pon el cargo fijo y el valor del m³ de tu comité, mueve el
              consumo y mira el total.
            </p>
          </div>

          <div className="flex flex-col gap-4 border-b border-border px-5.5 py-5">
            <div className="grid grid-cols-2 gap-4">
              <CampoMonto
                id={idCargoFijo}
                etiqueta="Cargo fijo (CLP)"
                valor={cargoFijo}
                onCambiar={setCargoFijo}
              />
              <CampoMonto
                id={idValorM3}
                etiqueta="Valor del m³ (CLP)"
                valor={valorM3}
                onCambiar={setValorM3}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor={idConsumo}
                  className="text-[0.78rem] text-muted-foreground"
                >
                  Consumo simulado
                </label>
                <span className="font-mono text-[0.85rem] font-semibold tabular-nums">
                  {consumo} m³
                </span>
              </div>
              <input
                id={idConsumo}
                type="range"
                min={0}
                max={60}
                step={1}
                value={consumo}
                onChange={(e) => setConsumo(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
              />
            </div>
          </div>

          <div className="p-5.5">
            <div className="flex justify-between border-b border-dashed border-border py-3 text-[0.92rem]">
              <span className="text-muted-foreground">
                Consumo ({consumo} m³)
              </span>
              <span className="font-semibold tabular-nums">
                {clp.format(totalConsumo)}
              </span>
            </div>
            <div className="flex justify-between py-3 text-[0.92rem]">
              <span className="text-muted-foreground">Cargo fijo</span>
              <span className="font-semibold tabular-nums">
                {clp.format(cargoFijo)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t-2 border-foreground pt-4">
              <span>Total simulado</span>
              <span className="font-mono text-[1.6rem] font-bold tabular-nums text-primary">
                {clp.format(total)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mt-3 text-[clamp(1.7rem,2.8vw,2.2rem)] font-semibold text-balance">
            Lo que hoy vive en una planilla, ahora cabe en un mensaje.
          </h2>
          <ul className="mt-6.5 flex flex-col gap-4">
            {puntos.map(({ titulo, detalle }) => (
              <li key={titulo} className="flex gap-3">
                <Check className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <strong className="mb-0.5 block">{titulo}</strong>
                  <span className="text-[0.9rem] text-muted-foreground">
                    {detalle}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
