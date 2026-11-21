"use client";

import { Hammer, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { formatoCantidad, unidadCorta, type Insumo } from "@/lib/inventario-comun";
import { cn } from "@/lib/utils";

const GRIS = "text-[#5B5970]";
const SELECT = "h-11 w-full rounded-xl border border-[#E4E1F0] bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Linea = { clave: number; insumoId: string; cantidad: string };

/** Lo que se pide al aprobar o crear una reparación para que su labor nazca completa. */
export type FormLaborReparacion = { responsable: string; fecha: string; lineas: Linea[] };

export const laborReparacionInicial = (): FormLaborReparacion => ({ responsable: "", fecha: hoyEnChile(), lineas: [] });

/** Lo que se manda al servidor: solo los materiales completos. */
export function datosDeLaborReparacion(f: FormLaborReparacion) {
  return {
    responsable: f.responsable,
    fecha: f.fecha,
    materiales: f.lineas.flatMap((l) => {
      const cantidad = Number(l.cantidad.replace(",", "."));
      return l.insumoId && cantidad > 0 ? [{ insumoId: l.insumoId, cantidad }] : [];
    }),
  };
}

/** Responsable, fecha y materiales de la labor que acompaña a una reparación. Todo es opcional. */
export function CamposLaborReparacion({ valor, onCambio, insumos, responsables }: { valor: FormLaborReparacion; onCambio: (v: FormLaborReparacion) => void; insumos: Insumo[]; responsables: string[] }) {
  const porId = new Map(insumos.map((i) => [i.id, i]));
  const cambiar = (clave: number, parte: Partial<Linea>) => onCambio({ ...valor, lineas: valor.lineas.map((l) => (l.clave === clave ? { ...l, ...parte } : l)) });

  return (
    <section aria-label="Labor de la reparación" className="space-y-4 rounded-xl bg-[#FBFAFE] p-4 ring-1 ring-[#F0EEF6]">
      <p className="flex items-center gap-2 text-[13px] font-semibold">
        <Hammer className="size-4 text-[#3A0CE3]" aria-hidden />
        Labor de la reparación
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">
            Responsable <span className={cn("font-normal", GRIS)}>· opcional</span>
          </span>
          <select value={valor.responsable} onChange={(e) => onCambio({ ...valor, responsable: e.target.value })} className={SELECT}>
            <option value="">Sin asignar</option>
            {responsables.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold">Fecha</span>
          <Input type="date" value={valor.fecha} onChange={(e) => onCambio({ ...valor, fecha: e.target.value })} className="h-11 rounded-xl border-[#E4E1F0] bg-white shadow-none" />
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-[13px] font-semibold">
          Materiales a usar <span className={cn("font-normal", GRIS)}>· opcional</span>
        </p>
        {valor.lineas.length > 0 ? (
          <ul className="divide-y divide-[#F3F1F8] rounded-xl bg-white ring-1 ring-[#ECEAF4]">
            {valor.lineas.map((l) => {
              const mat = porId.get(l.insumoId);
              return (
                <li key={l.clave} className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap">
                  <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                    <select aria-label="Material" value={l.insumoId} onChange={(e) => cambiar(l.clave, { insumoId: e.target.value })} className="h-9 w-full rounded-lg border-0 bg-transparent px-1 text-sm font-medium outline-none hover:bg-[#F7F6FB] focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="">Elegir material…</option>
                      {insumos.map((i) => (
                        <option key={i.id} value={i.id} disabled={valor.lineas.some((x) => x.insumoId === i.id && x.clave !== l.clave)}>
                          {i.nombre}
                        </option>
                      ))}
                    </select>
                    {mat ? (
                      <p className={cn("px-1 text-xs", GRIS)}>
                        Quedan {formatoCantidad(mat.stock)} {unidadCorta(mat.unidad)}
                      </p>
                    ) : null}
                  </div>
                  <input aria-label="Cantidad" inputMode="decimal" value={l.cantidad} onChange={(e) => cambiar(l.clave, { cantidad: e.target.value.replace(/[^\d.,]/g, "").slice(0, 10) })} className="h-9 w-16 rounded-lg border border-[#E4E1F0] bg-white text-center text-sm font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <button type="button" aria-label={`Quitar ${mat?.nombre ?? "material"}`} onClick={() => onCambio({ ...valor, lineas: valor.lineas.filter((x) => x.clave !== l.clave) })} className="flex size-9 items-center justify-center rounded-lg text-[#8F8CA3] hover:bg-[#FDF3F3] hover:text-[#A32020]">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <button
          type="button"
          disabled={insumos.length === 0}
          onClick={() => onCambio({ ...valor, lineas: [...valor.lineas, { clave: valor.lineas.reduce((m, l) => Math.max(m, l.clave), 0) + 1, insumoId: "", cantidad: "1" }] })}
          className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#C9BCFB] bg-white text-[13px] font-semibold text-[#2A07A8] hover:bg-[#FAF8FF] disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden />
          Agregar material
        </button>
      </div>
    </section>
  );
}
