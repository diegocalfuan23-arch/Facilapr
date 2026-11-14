"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, CornerDownLeft, Loader2, MessageSquarePlus, Search, SkipForward, X } from "lucide-react";
import { registrarLectura, type ResultadoAccion } from "@/app/panel/lecturas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AvatarSocio } from "@/components/panel/avatar-socio";
import { largoDeMes } from "@/components/panel/selector-mes-lecturas";
import { formatearRut } from "@/lib/formato";
import { cn } from "@/lib/utils";

const GRIS = "text-[#5B5970]";
const num = (n: number) => n.toLocaleString("es-CL");
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Un socio de la ruta, con lo que hace falta para cargarle la lectura. */
export type ItemRuta = {
  id: string;
  nombre: string;
  numeroCliente: string | null;
  rut: string | null;
  anterior: number | null;
  /** AAAA-MM de la lectura anterior, si se conoce. */
  periodoAnterior: string | null;
  promedio: number | null;
};

/** Formulario de una lectura: se vuelve a montar con cada socio (por su `key`) para empezar limpio y con el cursor en el campo. */
function FormularioLectura({ socio, periodo, onSaltar, onRegistrada }: { socio: ItemRuta; periodo: string; onSaltar: () => void; onRegistrada: () => void }) {
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const [estado, accion, pendiente] = useActionState<ResultadoAccion | null, FormData>(async (prev, datos) => {
    const r = await registrarLectura(prev, datos);
    if (r.ok) onRegistrada();
    return r;
  }, null);

  const v = valor ? Number(valor.replace(/\D/g, "")) : null;
  const consumo = v !== null && socio.anterior !== null ? v - socio.anterior : null;
  const retrocede = consumo !== null && consumo < 0;
  const alto = !retrocede && consumo !== null && socio.promedio !== null && socio.promedio > 0 && consumo > socio.promedio * 2;
  const aviso = retrocede || alto;

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    // Una lectura dudosa (retrocede o muy alta) pide apretar una segunda vez antes de enviarla.
    if (aviso && !confirmar) {
      e.preventDefault();
      setConfirmar(true);
    }
  }

  return (
    <form action={accion} onSubmit={enviar} className="px-5 pb-5">
      <input type="hidden" name="socioId" value={socio.id} />
      <input type="hidden" name="periodo" value={periodo} />
      <input type="hidden" name="valor" value={v ?? ""} />
      <input type="hidden" name="observacion" value={obs ?? ""} />

      <div className={cn("rounded-xl border p-4 transition-colors", retrocede ? "border-[#F2C1C0] bg-[#FFF7F7]" : alto ? "border-[#F6D9B8] bg-[#FFF9F1]" : "border-[#E9E6F4] bg-[#F9F8FD] focus-within:border-[#B9A9F8]")}>
        <div className="flex items-center justify-between">
          <label htmlFor="lectura-actual" className="text-[13px] font-medium">
            Lectura actual
          </label>
          <span className={cn("text-xs", GRIS)}>m³</span>
        </div>
        <input
          id="lectura-actual"
          autoFocus
          inputMode="numeric"
          autoComplete="off"
          value={valor ? num(Number(valor.replace(/\D/g, ""))) : ""}
          onChange={(e) => {
            setValor(e.target.value.replace(/\D/g, "").slice(0, 7));
            setConfirmar(false);
          }}
          placeholder="0"
          className="mt-1 w-full bg-transparent text-center text-[48px] font-semibold tracking-tight text-[#15132B] tabular-nums outline-none placeholder:text-[#D4D1E3]"
        />
        <div className="mt-2 grid grid-cols-2 border-t border-[#E9E6F4] pt-3 text-center">
          <div>
            <p className={cn("text-xs", GRIS)}>Anterior</p>
            <p className="font-semibold tabular-nums">{socio.anterior !== null ? num(socio.anterior) : "—"}</p>
            <p className={cn("text-[11px]", GRIS)}>{socio.periodoAnterior ? `${largoDeMes(socio.periodoAnterior)} ${socio.periodoAnterior.slice(0, 4)}` : "sin lecturas aprobadas"}</p>
          </div>
          <div className="border-l border-[#E9E6F4]">
            <p className={cn("text-xs", GRIS)}>Consumo</p>
            <p className={cn("font-semibold tabular-nums", retrocede ? "text-[#A32020]" : alto ? "text-[#B86400]" : consumo !== null ? "text-[#075A3C]" : "text-[#B4B2C4]")}>
              {socio.anterior === null && v !== null ? "Primera" : consumo === null ? "—" : `${consumo > 0 ? "+" : ""}${num(consumo)} m³`}
            </p>
            <p className={cn("text-[11px]", GRIS)}>{socio.promedio !== null ? `promedio ${num(socio.promedio)} m³` : "sin promedio"}</p>
          </div>
        </div>
      </div>

      <p role={aviso ? "alert" : undefined} className={cn("mt-2 flex items-start gap-1.5 text-[13px] leading-snug", retrocede ? "text-[#A32020]" : alto ? "text-[#8F4400]" : GRIS)}>
        {retrocede ? (
          <>
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>Es menor que la anterior ({num(socio.anterior ?? 0)}). Revisa el número o anota en la observación si cambiaron el medidor. {confirmar && "Presiona otra vez para enviarla igual."}</span>
          </>
        ) : alto ? (
          <>
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Consumo {Math.round((consumo ?? 0) / (socio.promedio ?? 1))}× mayor que su promedio. {confirmar ? "Presiona otra vez para enviarla igual." : "¿Está bien el número?"}
            </span>
          </>
        ) : socio.anterior !== null ? (
          `Debe ser igual o mayor a ${num(socio.anterior)}.`
        ) : (
          "Primera lectura de este socio: no hay una anterior con la que comparar."
        )}
      </p>

      {/* Sin lectura anterior: esta puede ser el punto de partida del medidor, sin cobrar nada. */}
      {socio.anterior === null && (
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#E4DEFC] bg-[#F7F5FF] px-3.5 py-3 text-[13px]">
          <input type="checkbox" name="comoInicial" defaultChecked className="mt-0.5 size-4 shrink-0 accent-primary" />
          <span>
            <span className="font-medium">Cuenta como lectura inicial</span>
            <span className={cn("mt-0.5 block text-xs", GRIS)}>Queda aprobada como punto de partida y no genera boleta: la próxima lectura se compara con esta. Desmárcalo si quieres cobrarla.</span>
          </span>
        </label>
      )}

      {obs === null ? (
        <button type="button" onClick={() => setObs("")} className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-[#2A07A8] hover:underline">
          <MessageSquarePlus className="size-4" aria-hidden />
          Agregar observación
        </button>
      ) : (
        <div className="relative mt-3">
          <Textarea autoFocus aria-label="Observación" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300} placeholder={retrocede ? "Ej.: cambio de medidor" : "Ej.: medidor empañado, perro suelto…"} className="min-h-[68px] rounded-lg border-[#E4E1F0] pr-9 text-sm shadow-none" />
          <button type="button" aria-label="Quitar observación" onClick={() => setObs(null)} className="absolute top-2 right-2 rounded-md p-1 text-[#8A8799] hover:bg-[#F2F1F7]">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {estado && !estado.ok && (
        <p className="mt-3 text-[13px] text-destructive" role="alert">
          {estado.error}
        </p>
      )}

      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
        <Button type="button" variant="outline" onClick={onSaltar} className="h-11 rounded-lg border-[#E4E1F0] px-4 font-semibold">
          <SkipForward />
          Saltar
        </Button>
        <Button type="submit" disabled={v === null || pendiente} className={cn("h-11 rounded-lg font-semibold", confirmar && "bg-[#B86400] hover:bg-[#B86400]/90")}>
          {pendiente && <Loader2 className="animate-spin" />}
          {confirmar ? "Enviar igual" : "Registrar y seguir"}
          <kbd className="ml-1 hidden items-center rounded bg-white/20 px-1.5 py-0.5 font-sans text-[11px] sm:inline-flex">
            <CornerDownLeft className="size-3" aria-hidden />
            <span className="sr-only">Enter</span>
          </kbd>
        </Button>
      </div>
    </form>
  );
}

/**
 * El panel lateral para cargar lecturas siguiendo la ruta del mes: el siguiente socio, su lectura anterior y su promedio,
 * el consumo en vivo con avisos, y los próximos de la ruta. Se abre desde «Nueva lectura» o «Continuar ruta».
 */
export function PanelCargaLectura({
  periodo,
  totalSocios,
  leidos,
  ruta,
  onCerrar,
  onSaltar,
  onIrA,
  onRegistrada,
}: {
  periodo: string;
  totalSocios: number;
  leidos: number;
  ruta: ItemRuta[];
  onCerrar: () => void;
  onSaltar: (id: string) => void;
  onIrA: (id: string) => void;
  onRegistrada: (id: string) => void;
}) {
  const actual = ruta[0] ?? null;
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", esc);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = previo;
    };
  }, [onCerrar]);

  const t = sinTildes(q.trim());
  const resultados = t ? ruta.filter((s) => sinTildes(`${s.nombre} ${s.numeroCliente ?? ""} ${s.rut ?? ""}`).includes(t)).slice(0, 6) : [];

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Cerrar panel" onClick={onCerrar} className="absolute inset-0 bg-[#15132B]/35 backdrop-blur-[1px]" />
      <aside role="dialog" aria-modal="true" aria-label="Nueva lectura" className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-[-16px_0_40px_rgba(21,19,43,0.18)] sm:w-[480px]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#F0EEF6] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[17px] font-semibold">Nueva lectura</p>
            <p className={cn("text-[13px]", GRIS)}>
              Ruta de {largoDeMes(periodo)} · <span className="tabular-nums">{leidos} de {totalSocios}</span> · faltan {Math.max(0, totalSocios - leidos)}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onCerrar} className="size-9 rounded-lg">
            <X />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {actual ? (
            <>
              <div className="flex items-center gap-3 p-5 pb-4">
                <AvatarSocio id={actual.id} nombre={actual.nombre} className="size-11 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-xs font-medium", GRIS)}>Siguiente en la ruta</p>
                  <p className="truncate text-[17px] leading-tight font-semibold">{actual.nombre}</p>
                  <p className={cn("mt-0.5 flex items-center gap-1.5 text-[13px]", GRIS)}>
                    {actual.numeroCliente ? `Cliente N° ${actual.numeroCliente}` : "Sin número"}
                    {actual.rut ? (
                      <span>· {formatearRut(actual.rut)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#FFF3E5] px-1.5 py-px text-[11px] font-semibold text-[#8F4400]">
                        <AlertTriangle className="size-3" aria-hidden />
                        Sin RUT
                      </span>
                    )}
                  </p>
                </div>
                <Button variant="outline" aria-label="Buscar socio" aria-expanded={buscando} onClick={() => setBuscando((b) => !b)} className="size-10 shrink-0 rounded-lg border-[#E4E1F0] p-0 sm:h-9 sm:w-auto sm:px-3 sm:text-[13px] sm:font-semibold">
                  <Search className="size-4" />
                  <span className="hidden sm:inline">Buscar socio</span>
                </Button>
              </div>

              {buscando && (
                <div className="mx-5 mb-4 rounded-xl border border-[#E9E6F4] bg-[#F9F8FD] p-3">
                  <Input autoFocus aria-label="Buscar socio de la ruta" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, N° de cliente o RUT" className="h-10 rounded-lg border-[#E4E1F0] bg-white shadow-none" />
                  {t && (
                    <ul className="mt-2">
                      {resultados.length === 0 ? (
                        <li className={cn("px-2 py-2 text-sm", GRIS)}>Ningún socio pendiente coincide.</li>
                      ) : (
                        resultados.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              onClick={() => {
                                onIrA(s.id);
                                setBuscando(false);
                                setQ("");
                              }}
                              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white"
                            >
                              <AvatarSocio id={s.id} nombre={s.nombre} className="size-7 text-[10px]" />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.nombre}</span>
                              <span className={cn("text-xs tabular-nums", GRIS)}>{s.numeroCliente ? `N° ${s.numeroCliente}` : ""}</span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              )}

              <FormularioLectura key={actual.id} socio={actual} periodo={periodo} onSaltar={() => onSaltar(actual.id)} onRegistrada={() => onRegistrada(actual.id)} />

              {ruta.length > 1 && (
                <div className="border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-3">
                  <p className={cn("mb-1.5 text-xs font-semibold tracking-wide uppercase", GRIS)}>Próximos en la ruta</p>
                  <ul>
                    {ruta.slice(1, 4).map((p) => (
                      <li key={p.id}>
                        <button type="button" onClick={() => onIrA(p.id)} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                          <AvatarSocio id={p.id} nombre={p.nombre} className="size-7 text-[10px]" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.nombre}</span>
                          <span className={cn("text-xs tabular-nums", GRIS)}>
                            {p.numeroCliente ? `N° ${p.numeroCliente} · ` : ""}
                            {p.anterior !== null ? `ant. ${num(p.anterior)}` : "primera"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center">
              <p className="font-semibold">Ruta completa</p>
              <p className={cn("mt-1 text-sm", GRIS)}>Ya hay una lectura de todos los socios este mes.</p>
              <Button onClick={onCerrar} className="mt-4 h-9 rounded-lg font-semibold">
                Cerrar
              </Button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
