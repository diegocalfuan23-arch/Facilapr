"use client";

import { useCallback, useState } from "react";
import { Plus, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArranqueDialog } from "@/components/panel/arranque-dialog";
import type { ArranqueFila, SocioAsignable } from "@/lib/arranques-comun";
import { cn } from "@/lib/utils";

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Stat({ label, valor, detalle }: { label: string; valor: number; detalle?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl bg-card p-4 lg:p-5", SOMBRA)}>
      <p className={cn("text-[13px] font-medium", GRIS)}>{label}</p>
      <p className="mt-1 text-[24px] leading-tight font-semibold tracking-tight tabular-nums lg:text-[28px]">{valor}</p>
      {detalle && <p className={cn("mt-1 text-[13px]", GRIS)}>{detalle}</p>}
    </div>
  );
}

/** Los nombres de los primeros socios de un arranque, y cuántos más hay. */
function ListaSocios({ socios }: { socios: ArranqueFila["socios"] }) {
  if (socios.length === 0) return <span className={GRIS}>Sin socios asignados</span>;
  const primeros = socios.slice(0, 3).map((s) => s.nombre);
  return (
    <span>
      {primeros.join(", ")}
      {socios.length > 3 && <span className={GRIS}> y {socios.length - 3} más</span>}
    </span>
  );
}

/** Los arranques del comité (plan Grande): cada conexión de la red y a qué socios abastece. */
export function ArranquesVista({ arranques, socios, sinTablas }: { arranques: ArranqueFila[]; socios: SocioAsignable[]; sinTablas: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<ArranqueFila | null>(null);
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
  }, []);

  const abastecidos = arranques.reduce((t, a) => t + a.socios.length, 0);
  const sinArranque = socios.length - abastecidos;

  const q = sinTildes(busqueda.trim());
  const filtrados = arranques.filter((a) => !q || sinTildes(`${a.nombre} ${a.ubicacion ?? ""} ${a.socios.map((s) => s.nombre).join(" ")}`).includes(q));

  if (sinTablas) {
    return (
      <div className={cn("flex items-start gap-3 rounded-2xl bg-[#FFF3E5] p-5 text-[#8F4400]", SOMBRA)}>
        <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="text-[15px]">Falta actualizar la base de datos para usar esta sección. Avisa a soporte.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <Stat label="Arranques" valor={arranques.length} />
        <Stat label="Socios abastecidos" valor={abastecidos} detalle={arranques.length > 0 ? `${(abastecidos / arranques.length).toLocaleString("es-CL", { maximumFractionDigits: 1 })} por arranque en promedio` : undefined} />
        <div className="col-span-2 lg:col-span-1">
          <Stat label="Socios sin arranque" valor={Math.max(0, sinArranque)} detalle={sinArranque > 0 ? "Todavía no están asignados a ninguno" : "Todos están asignados"} />
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-[340px]">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Buscar arranque" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por arranque, lugar o socio" className="h-10 rounded-lg border-[#E4E1F0] bg-white pl-9 shadow-none" />
        </div>
        <Button className="h-10 rounded-lg px-4 font-semibold" onClick={() => setCreando(true)}>
          <Plus />
          Nuevo arranque
        </Button>
      </div>

      <div className={cn("overflow-hidden rounded-2xl bg-card", SOMBRA)}>
        {filtrados.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-medium">{arranques.length === 0 ? "Todavía no registras arranques" : "Ningún arranque coincide con la búsqueda."}</p>
            <p className={cn("mx-auto mt-1 max-w-xl text-sm", GRIS)}>
              {arranques.length === 0 ? "Registra cada arranque de tu red y marca qué socios abastece. Así sabes a quién afecta si hay que cortar el agua en uno." : "Prueba con otra palabra."}
            </p>
            {arranques.length === 0 && (
              <Button className="mt-4 h-10 rounded-lg px-4 font-semibold" onClick={() => setCreando(true)}>
                <Plus />
                Registrar el primer arranque
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#F7F6FC] text-[13px] text-[#3F3C55]">
                    <th scope="col" className="px-5 py-3 font-semibold">Arranque</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Dónde está</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Socios</th>
                    <th scope="col" className="px-5 py-3 font-semibold">A quiénes abastece</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((a) => (
                    <tr key={a.id} onClick={() => setEditando(a)} className="cursor-pointer border-t border-[#F0EEF6] hover:bg-[#FBFAFF]">
                      <td className="px-5 py-4 text-[15px] font-semibold">{a.nombre}</td>
                      <td className="px-4 py-4 text-[15px] text-[#3F3C55]">{a.ubicacion ?? "—"}</td>
                      <td className="px-4 py-4 text-right text-[15px] font-bold tabular-nums">{a.socios.length}</td>
                      <td className="px-5 py-4 text-[15px]">
                        <ListaSocios socios={a.socios} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[#F0EEF6] md:hidden">
              {filtrados.map((a) => (
                <li key={a.id} className="cursor-pointer px-4 py-3" onClick={() => setEditando(a)}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[15px] font-semibold">{a.nombre}</p>
                    <p className="text-[15px] font-bold tabular-nums">
                      {a.socios.length} {a.socios.length === 1 ? "socio" : "socios"}
                    </p>
                  </div>
                  {a.ubicacion && <p className={cn("text-[13px]", GRIS)}>{a.ubicacion}</p>}
                  <p className="mt-1 text-[13px]">
                    <ListaSocios socios={a.socios} />
                  </p>
                </li>
              ))}
            </ul>

            <div className={cn("border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-3 text-sm tabular-nums", GRIS)}>
              {filtrados.length} arranque{filtrados.length === 1 ? "" : "s"}
            </div>
          </>
        )}
      </div>

      {(creando || editando) && <ArranqueDialog key={editando?.id ?? "nuevo"} arranque={editando} arranques={arranques} socios={socios} onCerrar={cerrar} />}
    </div>
  );
}
