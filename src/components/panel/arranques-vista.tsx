"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TEXTO_ESTADO_ARRANQUE, type ArranqueFila, type EstadoArranque } from "@/lib/arranques";
import { formatearPeriodo } from "@/lib/boletas";
import { cn } from "@/lib/utils";

const clp = (n: number) => "$" + n.toLocaleString("es-CL");
const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const ESTILO_ESTADO: Record<EstadoArranque, { pastilla: string; punto: string }> = {
  AL_DIA: { pastilla: "bg-[#DFF4EB] text-[#075A3C]", punto: "bg-[#0A9B68]" },
  MOROSO: { pastilla: "bg-[#FFEEDC] text-[#8F4400]", punto: "bg-[#E58200]" },
  CORTADO: { pastilla: "bg-[#FDECEC] text-[#A32020]", punto: "bg-[#D13B3B]" },
  INACTIVO: { pastilla: "bg-[#F1F0F7] text-[#5B5970]", punto: "bg-[#9A98AD]" },
};

function Stat({ label, valor, detalle }: { label: string; valor: number; detalle?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl bg-card p-4 lg:p-5", SOMBRA)}>
      <p className={cn("text-[13px] font-medium", GRIS)}>{label}</p>
      <p className="mt-1 text-[24px] leading-tight font-semibold tracking-tight tabular-nums lg:text-[28px]">{valor}</p>
      {detalle && <p className={cn("mt-1 text-[13px]", GRIS)}>{detalle}</p>}
    </div>
  );
}

function Estado({ estado }: { estado: EstadoArranque }) {
  const e = ESTILO_ESTADO[estado];
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap", e.pastilla)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", e.punto)} />
      {TEXTO_ESTADO_ARRANQUE[estado]}
    </span>
  );
}

type Filtro = "todos" | EstadoArranque;

/** El catastro de arranques (plan Grande): buscador, filtro por estado y una fila por conexión. */
export function ArranquesVista({ arranques }: { arranques: ArranqueFila[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<Filtro>("todos");
  const [uso, setUso] = useState<"todos" | "RESIDENCIAL" | "COMERCIAL">("todos");

  const cuenta = (e: EstadoArranque) => arranques.filter((a) => a.estado === e).length;
  const deudaTotal = arranques.reduce((s, a) => s + a.deuda, 0);

  const q = sinTildes(busqueda.trim());
  const filtrados = arranques.filter((a) => {
    if (estado !== "todos" && a.estado !== estado) return false;
    if (uso !== "todos" && a.uso !== uso) return false;
    if (!q) return true;
    return sinTildes(`${a.nombre} ${a.rut ?? ""} ${a.numero ?? ""} ${a.direccion ?? ""}`).includes(q);
  });

  const select = "h-10 w-full appearance-none rounded-lg border border-[#E4E1F0] bg-white pr-8 pl-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Arranques" valor={arranques.length} detalle={`${cuenta("AL_DIA") + cuenta("MOROSO")} activos`} />
        <Stat label="Con deuda vencida" valor={cuenta("MOROSO")} detalle={deudaTotal > 0 ? `${clp(deudaTotal)} por cobrar` : "Sin deuda"} />
        <Stat label="Cortados" valor={cuenta("CORTADO")} />
        <Stat label="Inactivos" valor={cuenta("INACTIVO")} />
      </section>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative lg:w-[340px]">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Buscar arranque" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, RUT, N.º o dirección" className="h-10 rounded-lg border-[#E4E1F0] bg-white pl-9 shadow-none" />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:w-[400px]">
          <div className="relative">
            <select aria-label="Filtrar por estado" value={estado} onChange={(e) => setEstado(e.target.value as Filtro)} className={select}>
              <option value="todos">Todos los estados</option>
              <option value="AL_DIA">Al día</option>
              <option value="MOROSO">Con deuda vencida</option>
              <option value="CORTADO">Cortados</option>
              <option value="INACTIVO">Inactivos</option>
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="relative">
            <select aria-label="Filtrar por uso" value={uso} onChange={(e) => setUso(e.target.value as typeof uso)} className={select}>
              <option value="todos">Todos los usos</option>
              <option value="RESIDENCIAL">Residencial</option>
              <option value="COMERCIAL">Comercial</option>
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className={cn("overflow-hidden rounded-2xl bg-card", SOMBRA)}>
        {filtrados.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-medium">{arranques.length === 0 ? "Todavía no hay arranques" : "Ningún arranque coincide con la búsqueda."}</p>
            <p className={cn("mx-auto mt-1 max-w-xl text-sm", GRIS)}>
              {arranques.length === 0 ? "Los arranques salen de los socios y usuarios del comité. Cárgalos en Socios." : "Prueba con otra palabra o cambia los filtros."}
            </p>
            {arranques.length === 0 && (
              <Link href="/panel/socios" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
                Ir a Socios
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#F7F6FC] text-[13px] text-[#3F3C55]">
                    <th scope="col" className="px-5 py-3 font-semibold">N.°</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Socio</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Dirección</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Uso</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Última lectura</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Último consumo</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Deuda</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((a) => (
                    <tr key={a.id} className="border-t border-[#F0EEF6] hover:bg-[#FBFAFF]">
                      <td className="px-5 py-4 text-[15px] font-semibold tabular-nums">{a.numero ?? "—"}</td>
                      <td className="px-4 py-4">
                        <p className="text-[15px] font-semibold">{a.nombre}</p>
                        <p className={cn("text-[13px]", GRIS)}>{[a.rut, a.tipo === "USUARIO" ? "Usuario" : null].filter(Boolean).join(" · ") || "Sin RUT"}</p>
                      </td>
                      <td className="px-4 py-4 text-[15px] text-[#3F3C55]">{a.direccion ?? "—"}</td>
                      <td className="px-4 py-4 text-[15px] text-[#3F3C55]">{a.uso === "COMERCIAL" ? "Comercial" : "Residencial"}</td>
                      <td className="px-4 py-4">
                        <Estado estado={a.estado} />
                      </td>
                      <td className="px-4 py-4 text-right text-[15px] tabular-nums">
                        {a.ultimaLectura ? (
                          <>
                            {a.ultimaLectura.valor.toLocaleString("es-CL")}
                            <span className={cn("block text-[12px]", GRIS)}>{formatearPeriodo(a.ultimaLectura.periodo)}</span>
                          </>
                        ) : (
                          <span className={GRIS}>Sin lectura</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right text-[15px] tabular-nums">
                        {a.ultimoConsumo ? (
                          <>
                            {a.ultimoConsumo.m3.toLocaleString("es-CL")} m³
                            <span className={cn("block text-[12px]", GRIS)}>{formatearPeriodo(a.ultimoConsumo.periodo)}</span>
                          </>
                        ) : (
                          <span className={GRIS}>—</span>
                        )}
                      </td>
                      <td className={cn("px-5 py-4 text-right text-[15px] font-bold tabular-nums", a.deuda > 0 && "text-[#A32020]")}>{a.deuda > 0 ? clp(a.deuda) : "$0"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[#F0EEF6] lg:hidden">
              {filtrados.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold">
                        {a.numero ? `N.º ${a.numero} · ` : ""}
                        {a.nombre}
                      </p>
                      <p className={cn("truncate text-[13px]", GRIS)}>{a.direccion ?? "Sin dirección"}</p>
                    </div>
                    <Estado estado={a.estado} />
                  </div>
                  <div className={cn("mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px] tabular-nums", GRIS)}>
                    <span>{a.uso === "COMERCIAL" ? "Comercial" : "Residencial"}</span>
                    <span>{a.ultimoConsumo ? `${a.ultimoConsumo.m3.toLocaleString("es-CL")} m³ (${formatearPeriodo(a.ultimoConsumo.periodo)})` : "Sin consumo"}</span>
                    <span className={cn(a.deuda > 0 && "font-bold text-[#A32020]")}>{a.deuda > 0 ? `Debe ${clp(a.deuda)}` : "Sin deuda"}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className={cn("border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-3 text-sm tabular-nums", GRIS)}>
              {filtrados.length} arranque{filtrados.length === 1 ? "" : "s"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
