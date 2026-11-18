"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, Gauge, MapPin, Route } from "lucide-react";
import { SociosDeLaborEnRuta } from "@/components/panel/socios-labor";
import { guardarRutaElegida } from "@/components/panel/rutas-panel";
import { Button } from "@/components/ui/button";
import { TEXTO_ESTADO_LABOR, textoTipoLabor, type LaborFila } from "@/lib/labores-comun";
import { cn } from "@/lib/utils";

const GRIS = "text-[#5B5970]";
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");

/** Las labores del comité que se hacen en rutas de socios: quien las recorre marca cada socio al terminarlo. */
export function MisLabores({ labores }: { labores: LaborFila[] }) {
  const router = useRouter();

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Labores</h1>
        <p className={cn("mt-0.5 text-[0.9rem]", GRIS)}>Lo que hay que hacer en los socios de cada ruta.</p>
      </div>

      {labores.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted">
            <ClipboardList className="size-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 text-[1rem] font-semibold">No hay labores pendientes</h2>
          <p className={cn("mt-2 max-w-[44ch] text-[0.9rem] leading-relaxed", GRIS)}>Cuando la directiva asigne una labor a una ruta, aparecerá aquí.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {labores.map((l) => (
            <li key={l.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ECE8FD] text-[#3A0CE3]">
                  {l.tipo === "LECTURA" ? <Gauge className="size-5" /> : <ClipboardList className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-xs font-medium", GRIS)}>
                    L-{l.numero} · {textoTipoLabor(l.tipo)}
                  </p>
                  <h2 className="text-[15px] leading-tight font-semibold">{l.titulo}</h2>
                  <p className={cn("mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs", GRIS)}>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" aria-hidden />
                      {fechaCorta(l.fecha)}
                      {l.hora ? ` · ${l.hora}` : ""}
                    </span>
                    {l.lugar ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" aria-hidden />
                        {l.lugar}
                      </span>
                    ) : null}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", l.estado === "EN_CURSO" ? "bg-[#FFF3E5] text-[#8F4400]" : "bg-[#E2F2FC] text-[#0A5F91]")}>{TEXTO_ESTADO_LABOR[l.estado]}</span>
              </div>

              <div className="mt-3 space-y-3">
                {l.rutas.map((r) => (
                  <div key={r.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Route className="size-3.5 text-[#5B5970]" aria-hidden />
                      <span className="text-sm font-medium">{r.nombre}</span>
                      {l.tipo === "LECTURA" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            guardarRutaElegida(r.id);
                            router.push("/panel/lecturas/terreno");
                          }}
                          className="ml-auto h-9 rounded-lg"
                        >
                          <Gauge className="size-4" />
                          Tomar lecturas
                        </Button>
                      ) : null}
                    </div>
                    <SociosDeLaborEnRuta laborId={l.id} socios={l.socios.filter((s) => s.rutaId === r.id)} bloqueada={l.estado === "HECHA"} abierto />
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
