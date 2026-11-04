import type { MesDelAnio } from "@/lib/reportes";

const ABREVIATURA = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/** Un monto corto para caber bajo una barra: $950 · $2,9 mil · $83 mil · $1,5 M. */
function compacto(n: number) {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${(m >= 10 ? Math.round(m) : Math.round(m * 10) / 10).toString().replace(".", ",")} M`;
  }
  if (n >= 1000) {
    const k = n / 1000;
    return `$${(k >= 10 ? Math.round(k) : Math.round(k * 10) / 10).toString().replace(".", ",")} mil`;
  }
  return `$${n}`;
}

/**
 * Ingresos y egresos de cada mes, en barras: verde lo que entró y rojo lo que salió, con el monto
 * escrito debajo de cada mes. Es HTML y CSS simple, sin librería de gráficos, así que sale igual
 * al imprimir. En pantallas angostas los montos no caben y quedan solo al pasar el cursor.
 */
export function GraficoMeses({ meses }: { meses: MesDelAnio[] }) {
  const maximo = Math.max(1, ...meses.flatMap((m) => [m.ingresos, m.egresos]));

  return (
    <div>
      {/* Las barras. */}
      <div className="flex h-40 items-end gap-2" role="img" aria-label="Ingresos y egresos por mes">
        {meses.map((m, i) => (
          <div key={m.mes} className="flex h-full flex-1 items-end justify-center gap-1">
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
        ))}
      </div>

      {/* El mes y, debajo, cuánto entró y cuánto salió. */}
      <div className="mt-2 flex gap-2 border-t border-border pt-2">
        {meses.map((m, i) => (
          <div key={m.mes} className="flex flex-1 flex-col items-center gap-0.5 text-center">
            <span className="text-[0.7rem] text-muted-foreground">{ABREVIATURA[i]}</span>
            <span className="hidden min-h-8 flex-col items-center text-[0.65rem] leading-tight font-medium tabular-nums md:flex">
              {m.ingresos > 0 && <span className="text-emerald-700 dark:text-emerald-400">{compacto(m.ingresos)}</span>}
              {m.egresos > 0 && <span className="text-red-600 dark:text-red-400">−{compacto(m.egresos)}</span>}
            </span>
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
