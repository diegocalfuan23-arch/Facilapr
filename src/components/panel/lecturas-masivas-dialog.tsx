"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { aprobarLecturasListas } from "@/app/panel/lecturas/actions";
import {
  confirmarLecturas,
  previsualizarLecturas,
  type PrevisualizacionMasiva,
} from "@/app/panel/lecturas/masivas-actions";
import type { ModoLecturas } from "@/lib/importar-lecturas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Vista = Extract<PrevisualizacionMasiva, { ok: true }>;

type Final =
  | { tipo: "pendientes"; cargadas: number; ids: string[] }
  | { tipo: "iniciales"; cargadas: number }
  | { tipo: "aprobadas"; aprobadas: number; fallidas: { id: string; error: string }[] };

const numero = new Intl.NumberFormat("es-CL");
const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

/**
 * Cargar lecturas desde Excel o CSV, con revisión antes de guardar. Dos usos:
 * las del MES (quedan por revisar; muestra m³ y monto de cada una y permite
 * aprobarlas en bloque para generar las boletas) y las INICIALES (la lectura de
 * partida de cada medidor, sin boleta).
 */
export function LecturasMasivasDialog({
  abierto,
  onAbiertoChange,
}: {
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<ModoLecturas>("mensual");
  // Vacío = se toma del archivo (de un encabezado como «agosto»); si ahí no está, se le pide al usuario.
  const [periodo, setPeriodo] = useState("");
  const [vista, setVista] = useState<Vista | null>(null);
  const [final, setFinal] = useState<Final | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, iniciar] = useTransition();

  function cambiarAbierto(v: boolean) {
    onAbiertoChange(v);
    if (!v) {
      setVista(null);
      setFinal(null);
      setError(null);
    }
  }

  function elegirModo(m: ModoLecturas) {
    setModo(m);
  }

  function leer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    datos.set("modo", modo);
    setError(null);
    iniciar(async () => {
      const r = await previsualizarLecturas(datos);
      if (r.ok) setVista(r);
      else setError(r.error);
    });
  }

  const validas = vista?.filas.filter((f) => !f.error && f.socioId) ?? [];
  const conProblema = (vista?.filas.length ?? 0) - validas.length;
  // Cada arranque se estima con su tarifa: la comercial si el comité definió una.
  const monto = (consumo: number | null, socioId: string | null) => {
    if (!vista?.tarifas || consumo === null) return null;
    const t =
      socioId && vista.tarifasComercial && vista.comercialIds.includes(socioId)
        ? vista.tarifasComercial
        : vista.tarifas;
    return t.cargoFijo + consumo * t.valorM3;
  };
  const totalM3 = validas.reduce((s, f) => s + (f.consumo ?? 0), 0);
  const totalMonto = vista?.tarifas
    ? validas.reduce((s, f) => s + (monto(f.consumo, f.socioId) ?? 0), 0)
    : null;

  function confirmar() {
    if (!vista) return;
    setError(null);
    iniciar(async () => {
      const r = await confirmarLecturas(
        validas.map((f) => ({ socioId: f.socioId!, valor: f.valor! })),
        vista.periodo,
        vista.modo
      );
      if (!r.ok) return setError(r.error);
      setFinal(
        vista.modo === "inicial"
          ? { tipo: "iniciales", cargadas: r.cargadas }
          : { tipo: "pendientes", cargadas: r.cargadas, ids: r.ids }
      );
      router.refresh();
    });
  }

  function aprobarYGenerar(ids: string[]) {
    setError(null);
    iniciar(async () => {
      const r = await aprobarLecturasListas(ids);
      if (!r.ok) return setError(r.error);
      setFinal({ tipo: "aprobadas", aprobadas: r.aprobadas, fallidas: r.fallidas });
      router.refresh();
    });
  }

  const mensual = vista?.modo === "mensual";

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogContent className={vista && !final ? "sm:max-w-4xl" : "sm:max-w-130"}>
        <DialogHeader>
          <DialogTitle>Cargar lecturas desde un archivo</DialogTitle>
          <DialogDescription>
            {final
              ? "Listo."
              : vista
                ? "Revisa a qué arranque entendí cada lectura. Las que tienen un problema no se cargan."
                : "Sube una planilla de Excel o CSV con las lecturas de los medidores."}
          </DialogDescription>
        </DialogHeader>

        {final ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-lg border border-forest/30 bg-forest/5 p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-forest" />
              <div className="text-[0.92rem]">
                {final.tipo === "iniciales" && (
                  <p>
                    <strong>{final.cargadas}</strong> lecturas iniciales cargadas. La próxima lectura de
                    cada arranque cobrará solo su consumo.
                  </p>
                )}
                {final.tipo === "pendientes" && (
                  <p>
                    <strong>{final.cargadas}</strong> lecturas cargadas, por revisar. Aún no se generó
                    ninguna boleta.
                  </p>
                )}
                {final.tipo === "aprobadas" && (
                  <p>
                    <strong>{final.aprobadas}</strong> boletas generadas.
                    {final.fallidas.length > 0 &&
                      ` ${final.fallidas.length} no se pudieron aprobar y siguen por revisar.`}
                  </p>
                )}
              </div>
            </div>
            {final.tipo === "aprobadas" && final.fallidas.length > 0 && (
              <ul className="max-h-40 overflow-y-auto text-[0.82rem] text-destructive">
                {final.fallidas.map((f) => (
                  <li key={f.id}>{f.error}</li>
                ))}
              </ul>
            )}
            {error && <p className="text-[0.88rem] text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => cambiarAbierto(false)} disabled={trabajando}>
                {final.tipo === "pendientes" ? "Dejarlas por revisar" : "Cerrar"}
              </Button>
              {final.tipo === "pendientes" && (
                <Button onClick={() => aprobarYGenerar(final.ids)} disabled={trabajando}>
                  {trabajando && <Loader2 className="animate-spin" />}
                  Aprobar y generar {final.cargadas} {final.cargadas === 1 ? "boleta" : "boletas"}
                </Button>
              )}
            </DialogFooter>
          </div>
        ) : vista ? (
          <div className="flex min-w-0 flex-col gap-3">
            <ul className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-[0.82rem] text-muted-foreground">
              {vista.notas.map((n) => (
                <li key={n}>{n}</li>
              ))}
              <li>
                {mensual ? "Lecturas del período" : "Se guardan como lecturas iniciales del período"}{" "}
                {vista.periodo}.
              </li>
            </ul>

            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.88rem]">
              <span>
                <strong className="tabular-nums">{validas.length}</strong> listas
              </span>
              {mensual && (
                <>
                  <span>
                    <strong className="tabular-nums">{numero.format(totalM3)}</strong> m³ en total
                  </span>
                  {totalMonto !== null && (
                    <span>
                      <strong className="tabular-nums">{clp.format(totalMonto)}</strong> a cobrar
                    </span>
                  )}
                </>
              )}
              {conProblema > 0 && (
                <span className="font-medium text-destructive">
                  {conProblema} con problema (no se cargan)
                </span>
              )}
            </div>

            {mensual && !vista.tarifas && (
              <p className="flex items-start gap-2 rounded-lg border border-tertiary/40 bg-tertiary/10 px-3.5 py-2.5 text-[0.85rem]">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-tertiary" />
                Faltan el cargo fijo y el valor del m³ (Configuración → Facturación): no puedo estimar
                el monto, y las boletas no se podrán generar hasta que los definas.
              </p>
            )}

            <div className="max-h-[44vh] overflow-auto rounded-lg border border-border/60">
              <table className="w-full min-w-[640px] text-[0.85rem]">
                <thead className="sticky top-0 bg-muted text-left text-[0.78rem] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Fila</th>
                    <th className="px-3 py-2 font-medium">Arranque</th>
                    {mensual && <th className="px-3 py-2 text-right font-medium">Anterior</th>}
                    <th className="px-3 py-2 text-right font-medium">Lectura</th>
                    {mensual && <th className="px-3 py-2 text-right font-medium">Consumo</th>}
                    {mensual && vista.tarifas && (
                      <th className="px-3 py-2 text-right font-medium">Monto</th>
                    )}
                    <th className="px-3 py-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {vista.filas.map((f) => (
                    <tr key={f.linea} className={cn(f.error && "bg-destructive/5")}>
                      <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{f.linea}</td>
                      <td className="px-3 py-1.5">
                        <div className="font-medium">{f.nombre ?? f.referencia}</div>
                        {f.nombre && (
                          <div className="text-[0.76rem] text-muted-foreground">{f.referencia}</div>
                        )}
                      </td>
                      {mensual && (
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {f.anterior !== null ? numero.format(f.anterior) : "—"}
                        </td>
                      )}
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {f.valor !== null ? numero.format(f.valor) : "—"}
                      </td>
                      {mensual && (
                        <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                          {f.consumo !== null ? `${numero.format(f.consumo)} m³` : "—"}
                        </td>
                      )}
                      {mensual && vista.tarifas && (
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {monto(f.consumo, f.socioId) !== null ? clp.format(monto(f.consumo, f.socioId)!) : "—"}
                        </td>
                      )}
                      <td className="px-3 py-1.5">
                        {f.error ? (
                          <span className="text-[0.78rem] font-medium text-destructive">{f.error}</span>
                        ) : (
                          <span className="text-[0.78rem] text-forest">Lista</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <p className="text-[0.88rem] text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => setVista(null)} disabled={trabajando}>
                Elegir otro archivo
              </Button>
              <Button onClick={confirmar} disabled={trabajando || validas.length === 0}>
                {trabajando && <Loader2 className="animate-spin" />}
                {mensual
                  ? `Cargar ${validas.length} ${validas.length === 1 ? "lectura" : "lecturas"}`
                  : `Cargar ${validas.length} ${validas.length === 1 ? "lectura inicial" : "lecturas iniciales"}`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={leer} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qué lecturas son">
              {(
                [
                  { id: "mensual", titulo: "Lecturas del mes", texto: "Para calcular el consumo y generar las boletas." },
                  { id: "inicial", titulo: "Lecturas iniciales", texto: "El punto de partida de cada medidor. No cobra." },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={modo === o.id}
                  onClick={() => elegirModo(o.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    modo === o.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  )}
                >
                  <span className="block text-[0.9rem] font-medium">{o.titulo}</span>
                  <span className="mt-0.5 block text-[0.78rem] text-muted-foreground">{o.texto}</span>
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-[0.85rem] text-muted-foreground">
              Una fila por arranque, con una columna <strong>Lectura</strong> y otra que lo identifique:{" "}
              <strong>N.º</strong>, <strong>Nombre</strong> o <strong>RUT</strong>. Si hay socios y usuarios
              con el mismo N.º, agrega una columna <strong>Tipo</strong>.{" "}
              {modo === "mensual"
                ? "Solo se aceptan arranques que ya tienen una lectura anterior: es de ahí que sale el consumo."
                : "Solo se aceptan arranques que todavía no tienen lecturas."}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="periodo-masivo">
                {modo === "mensual" ? "Período de estas lecturas" : "Período de la lectura de partida"}{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="periodo-masivo"
                name="periodo"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                placeholder="Automático"
                className="max-w-40"
              />
              <span className="text-[0.8rem] text-muted-foreground">
                Si lo dejas vacío, lo tomo del archivo (por ejemplo, de un encabezado «agosto»). Si no lo encuentro, te lo pido.{" "}
                {modo === "mensual"
                  ? "Es el mes que se va a cobrar."
                  : "En la lectura de partida es el mes anterior al primero que vas a cobrar."}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="archivo-masivo">Archivo (Excel o CSV)</Label>
              <Input
                id="archivo-masivo"
                name="archivo"
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
              />
            </div>

            {error && (
              <p className="flex items-start gap-2 text-[0.88rem] text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => cambiarAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={trabajando}>
                {trabajando ? <Loader2 className="animate-spin" /> : <FileUp />}
                {trabajando ? "Leyendo…" : "Leer y revisar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
