"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { asignarSocios } from "@/app/panel/arranques/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvatarSocio } from "@/components/panel/avatar-socio";
import type { ArranqueFila, SocioAsignable } from "@/lib/arranques-comun";

const GRIS = "text-[#5B5970]";
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Asignar varios socios que todavía no tienen arranque a uno de los arranques. */
export function AsignarSociosDialog({
  arranques,
  libres,
  destinoInicial,
  onCerrar,
}: {
  arranques: ArranqueFila[];
  /** Los socios que todavía no tienen arranque. */
  libres: SocioAsignable[];
  destinoInicial?: string;
  onCerrar: () => void;
}) {
  const [q, setQ] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [destino, setDestino] = useState(destinoInicial ?? arranques[0]?.id ?? "");
  const [guardando, iniciar] = useTransition();

  const lista = useMemo(() => {
    const t = sinTildes(q.trim());
    return libres.filter((s) => !t || sinTildes(`${s.nombre} ${s.numero ?? ""}`).includes(t));
  }, [libres, q]);
  const todos = lista.length > 0 && lista.every((s) => marcados.includes(s.id));

  function asignar() {
    iniciar(async () => {
      const r = await asignarSocios(destino, marcados);
      if (r.ok) {
        toast.success(`${marcados.length} socio${marcados.length === 1 ? "" : "s"} asignado${marcados.length === 1 ? "" : "s"}`);
        onCerrar();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="flex max-h-[90vh] max-w-[520px] flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <div className="bg-gradient-to-br from-[#3A0CE3] to-[#6B46F5] px-5 pt-5 pb-5 text-white">
          <DialogTitle className="text-lg font-semibold">Asignar socios a un arranque</DialogTitle>
          <DialogDescription className="mt-0.5 text-[13px] text-white/80">Solo aparecen los socios que todavía no tienen arranque.</DialogDescription>
        </div>
        <div className="flex flex-col gap-3 border-b border-[#F0EEF6] p-5 pb-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Arranque
            <Select value={destino} onValueChange={(v) => setDestino(v as string)}>
              <SelectTrigger className="h-10 w-full rounded-lg border-[#E4E1F0] px-3">
                <SelectValue placeholder="Elige un arranque">
                  {(v) => {
                    const a = arranques.find((x) => x.id === v);
                    return a ? `${a.nombre} · ${a.socios.length} socios` : "Elige un arranque";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {arranques.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nombre} · {a.socios.length} socios
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Buscar socio" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o N° de socio" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
          </div>
          <label className={`flex items-center gap-2.5 text-[13px] font-medium ${GRIS}`}>
            <input
              type="checkbox"
              checked={todos}
              onChange={() => setMarcados(todos ? marcados.filter((id) => !lista.some((s) => s.id === id)) : [...new Set([...marcados, ...lista.map((s) => s.id)])])}
              className="size-4 accent-[#3A0CE3]"
            />
            Seleccionar {q ? "los resultados" : "todos"} ({lista.length})
          </label>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
          {lista.slice(0, 300).map((s) => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#F8F7FC]">
                <input type="checkbox" checked={marcados.includes(s.id)} onChange={() => setMarcados((m) => (m.includes(s.id) ? m.filter((x) => x !== s.id) : [...m, s.id]))} className="size-4 accent-[#3A0CE3]" />
                <AvatarSocio id={s.id} nombre={s.nombre} className="size-8" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.nombre}</span>
                {s.numero && <span className={`text-xs tabular-nums ${GRIS}`}>N° {s.numero}</span>}
              </label>
            </li>
          ))}
          {lista.length === 0 && <li className={`px-3 py-8 text-center text-sm ${GRIS}`}>{libres.length === 0 ? "Todos los socios ya tienen arranque." : "No hay socios con ese nombre."}</li>}
          {lista.length > 300 && <li className={`px-3 py-3 text-center text-xs ${GRIS}`}>Se muestran los primeros 300. Escribe para acotar.</li>}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-[#F0EEF6] p-4">
          <span className={`text-sm ${GRIS}`}>
            <strong className="font-semibold text-[#15132B]">{marcados.length}</strong> seleccionado{marcados.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCerrar} className="h-10 rounded-lg px-4 font-semibold">
              Cancelar
            </Button>
            <Button disabled={!marcados.length || !destino || guardando} onClick={asignar} className="h-10 rounded-lg px-4 font-semibold">
              {guardando && <Loader2 className="animate-spin" />}
              Asignar{marcados.length ? ` ${marcados.length}` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
