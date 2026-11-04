import type { MesDelAnio } from "@/lib/reportes";

const ABREVIATURA = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/**
 * Ingresos y egresos de cada mes, en barras: verde lo que entró y rojo lo que salió. Es HTML y
 * CSS simple, sin librería de gráficos, así que sale igual al imprimir.
 */
export function GraficoMeses({ meses }: { meses: MesDelAnio[] }) {
  const maximo = Math.max(1, ...meses.flatMap((m) => [m.ingresos, m.egresos]));

  return (
    <div>
      <div className="flex h-44 items-end gap-2" role="img" aria-label="Ingresos y egresos por mes">
        {meses.map((m, i) => (
          <div key={m.mes} className="flex h-full flex-1 flex-col justify-end gap-2">
            <div className="flex h-full items-end justify-center gap-1">
              <div
                className="w-full max-w-4 rounded-t bg-emerald-500"
                style={{ height: `${(m.ingresos / maximo) * 100}%`, minHeight: m.ingresos > 0 ? 2 : 0 }}
                title={`${ABREVIATURA[i]}: ingresos ${clp.format(m.ingresos)}`}
              />
              <div
                className="w-full max-w-4 rounded-t bg-red-500"
                style={{ height: `${(m.egresos / maximo) * 100}%`, minHeight: m.egresos > 0 ? 2 : 0 }}
                title={`${ABREVIATURA[i]}: egresos ${clp.format(m.egresos)}`}
              />
            </div>
            <span className="text-center text-[0.7rem] text-muted-foreground">{ABREVIATURA[i]}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[0.8rem] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-emerald-500" />
          Ingresos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-red-500" />
          Egresos
        </span>
      </div>
    </div>
  );
}
