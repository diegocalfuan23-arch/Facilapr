"use client";

import { toast } from "sonner";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Clock, Copy, Crown, Link2, Loader2, MessageCircle, Plus, Power, Search, ShieldCheck, Trash2, UserPlus, Users, Wallet, Wrench, X, type LucideIcon } from "lucide-react";
import { generarInvitacionOperador } from "@/app/panel/lecturas/actions";
import { cambiarRolEquipo, cancelarInvitacion, desactivarOperador, reactivarOperador, renovarInvitacion } from "@/app/panel/tecnicos/actions";
import { iniciales, normalizarTelefono } from "@/lib/formato";
import { enlaceWhatsApp, mensajeInvitacionTecnico, telefonoValidoParaWhatsApp } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RolEquipo = "OPERADOR" | "TESORERO";

const GRIS = "text-[#5B5970]";
const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";

const ROL: Record<RolEquipo, { nombre: string; icono: LucideIcon; tono: string; chip: string; donde: string; puede: string[] }> = {
  TESORERO: { nombre: "Tesorero", icono: Wallet, tono: "bg-[#E6F6EF] text-[#0A7A52]", chip: "bg-[#E6F6EF] text-[#075A3C]", donde: "Panel web", puede: ["Pagos, caja y giros", "Compras, rendiciones y reportes", "Bodega e inventario"] },
  OPERADOR: { nombre: "Operador", icono: Wrench, tono: "bg-[#ECE8FD] text-[#3A0CE3]", chip: "bg-[#ECE8FD] text-[#2A07A8]", donde: "App en terreno", puede: ["Lecturas en terreno", "Rutas y ubicación de socios", "Órdenes de trabajo"] },
};

const fechaCorta = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" });
const fechaLarga = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Santiago" });

export type Tecnico = {
  id: string;
  nombre: string;
  correo: string | null;
  /** Su cargo en la ficha de Personal, si tiene ficha. */
  cargo: string | null;
  /** Cuándo se creó su cuenta (ISO). */
  desde: string | null;
  /** «hace 25 min», «ayer»…; null si nunca entró. */
  acceso: string | null;
  /** false = desactivado por la directiva: no puede entrar. */
  activo: boolean;
  /** null = tiene ficha en Personal pero no tiene cuenta: no entra al panel. */
  rol: RolEquipo | null;
};

export type InvitacionPendiente = {
  id: string;
  enlace: string;
  /** Días que le quedan; 0 o menos si ya venció. */
  quedan: number;
  expira: string;
  creada: string;
  rol: RolEquipo;
};

type Filtro = "todos" | "OPERADOR" | "TESORERO" | "inactivos";

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Avatar({ t, grande }: { t: Tecnico; grande?: boolean }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full font-bold", grande ? "size-12 text-[15px]" : "size-10 text-[13px]", t.activo && t.rol ? "bg-[#ECE8FD] text-[#2A07A8]" : "bg-[#F1F0F5] text-[#8F8CA3]")}>
      {iniciales(t.nombre)}
    </span>
  );
}

function ChipRol({ t }: { t: Tecnico }) {
  if (!t.activo) return <span className="rounded-full bg-[#F1F0F5] px-2.5 py-1 text-xs font-semibold text-[#6E6B85]">Inactivo</span>;
  if (!t.rol) return <span className="rounded-full bg-[#F1F0F5] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#6E6B85]">Sin cuenta</span>;
  const r = ROL[t.rol];
  const I = r.icono;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", r.chip)}>
      <I className="size-3.5" aria-hidden />
      {r.nombre}
    </span>
  );
}

export function TecnicosPanel({
  yo,
  tecnicos,
  invitacionesPendientes,
  puedeTesorero,
}: {
  yo: { nombre: string; correo: string };
  tecnicos: Tecnico[];
  invitacionesPendientes: InvitacionPendiente[];
  /** El plan incluye Finanzas: solo entonces se puede invitar a un tesorero. */
  puedeTesorero: boolean;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [q, setQ] = useState("");
  const [invitar, setInvitar] = useState<RolEquipo | null>(null);
  const [gestion, setGestion] = useState<string | null>(null);

  const activos = tecnicos.filter((t) => t.activo);
  const cuenta: Record<Filtro, number> = {
    todos: activos.length,
    OPERADOR: activos.filter((t) => t.rol === "OPERADOR").length,
    TESORERO: activos.filter((t) => t.rol === "TESORERO").length,
    inactivos: tecnicos.length - activos.length,
  };
  const buscado = sinTildes(q.trim());
  const lista = tecnicos.filter((t) => (filtro === "inactivos" ? !t.activo : t.activo && (filtro === "todos" || t.rol === filtro)) && (!buscado || sinTildes(`${t.nombre} ${t.correo ?? ""}`).includes(buscado)));
  const vigentes = invitacionesPendientes.filter((i) => i.quedan > 0).length;
  const sel = tecnicos.find((t) => t.id === gestion) ?? null;
  const rolSugerido: RolEquipo = filtro === "TESORERO" && puedeTesorero ? "TESORERO" : "OPERADOR";

  const tabs: [Filtro, string][] = [
    ["todos", "Activos"],
    ["OPERADOR", "Operadores"],
    ["TESORERO", "Tesorería"],
    ["inactivos", "Inactivos"],
  ];

  return (
    <div className="mx-auto w-full max-w-[1260px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[28px]">Equipo</h1>
          <p className={`mt-0.5 max-w-[560px] text-[15px] ${GRIS}`}>Quién trabaja en el comité y a qué tiene acceso. Solo entra quien tú invitas.</p>
        </div>
        <Button data-tour="tec-invitar" onClick={() => setInvitar("OPERADOR")} className="h-10 rounded-lg px-4 font-semibold">
          <UserPlus className="size-4" />
          Invitar persona
        </Button>
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
        <div data-tour="tec-tabla" className={`overflow-hidden rounded-2xl bg-white ${SOMBRA}`}>
          <div className="flex flex-col gap-2.5 border-b border-[#F0EEF6] p-4 sm:flex-row sm:items-center sm:px-5">
            <div role="tablist" aria-label="Filtrar" className="flex gap-1 rounded-lg bg-[#F4F3F9] p-1 sm:w-[430px]">
              {tabs.map(([k, t]) => (
                <button key={k} role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)} className={cn("h-8 flex-auto rounded-md px-1.5 text-[12.5px] font-semibold whitespace-nowrap sm:text-[13px]", filtro === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}>
                  {t} <span className={cn("hidden text-xs font-medium sm:inline", filtro === k ? "text-[#6B46F5]" : "text-[#A19FB2]")}>{cuenta[k]}</span>
                </button>
              ))}
            </div>
            <div className="relative sm:ml-auto sm:w-[220px]">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8B89A0]" />
              <Input aria-label="Buscar persona" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o correo" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
            </div>
          </div>

          <div className={`hidden grid-cols-[minmax(0,1fr)_120px_150px_20px] gap-x-4 border-b border-[#F3F1F8] bg-[#FAFAFD] px-5 py-2.5 text-xs font-medium md:grid ${GRIS}`}>
            <span>Persona</span>
            <span>Rol</span>
            <span>Actividad</span>
            <span />
          </div>

          <ul className="divide-y divide-[#F3F1F8]">
            {filtro === "todos" && !q ? (
              <li className="flex items-center gap-3 bg-[#FBFAFF] px-4 py-3.5 sm:px-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6B46F5] to-[#3A0CE3] text-[13px] font-bold text-white">{iniciales(yo.nombre)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-semibold">
                    <span className="truncate">{yo.nombre}</span>
                    <span className="rounded-full bg-[#ECE8FD] px-2 py-0.5 text-[11px] font-semibold text-[#2A07A8]">Tú</span>
                  </span>
                  <span className={`block truncate text-[13px] ${GRIS}`}>Administrador · acceso completo al panel</span>
                </span>
                <span className={`hidden items-center gap-1.5 text-xs font-medium sm:flex ${GRIS}`}>
                  <Crown className="size-3.5 text-[#B86400]" aria-hidden />
                  Dueño de la cuenta
                </span>
              </li>
            ) : null}

            {lista.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setGestion(t.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3.5 text-left hover:bg-[#FBFAFF] sm:px-5 md:grid-cols-[minmax(0,1fr)_120px_150px_20px]">
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar t={t} />
                    <span className="min-w-0">
                      <span className={cn("block truncate text-[15px] font-semibold", !t.activo && "text-[#8F8CA3]")}>{t.nombre}</span>
                      <span className={`block truncate text-[13px] ${GRIS}`}>{[t.cargo, t.correo].filter(Boolean).join(" · ") || "Sin correo"}</span>
                    </span>
                  </span>
                  <span>
                    <ChipRol t={t} />
                  </span>
                  <span className="hidden min-w-0 md:block">
                    {t.rol ? (
                      <>
                        <span className="block truncate text-[13px]">{t.acceso ? `Último acceso ${t.acceso}` : "Aún no entra"}</span>
                        <span className={`block truncate text-xs ${GRIS}`}>{t.desde ? `En el equipo desde ${fechaCorta.format(new Date(t.desde))}` : ""}</span>
                      </>
                    ) : (
                      <span className={`block truncate text-xs ${GRIS}`}>Tiene ficha en Personal</span>
                    )}
                  </span>
                  <ChevronRight className="hidden size-4 text-[#B4B2C4] md:block" aria-hidden />
                </button>
              </li>
            ))}

            {lista.length === 0 ? (
              <li className="px-6 py-12 text-center">
                <span aria-hidden className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#ECE8FD] text-[#3A0CE3]">
                  <Users className="size-6" />
                </span>
                <p className="mt-3 font-semibold">{q ? "Nadie coincide con la búsqueda" : filtro === "inactivos" ? "No hay personas inactivas" : "Aún no hay nadie aquí"}</p>
                {!q && filtro !== "inactivos" ? (
                  <Button onClick={() => setInvitar(rolSugerido)} className="mt-4 h-10 rounded-lg font-semibold">
                    <Plus className="size-4" />
                    Invitar
                  </Button>
                ) : null}
              </li>
            ) : null}
          </ul>

          {lista.length > 0 && filtro !== "inactivos" ? (
            <button type="button" onClick={() => setInvitar(rolSugerido)} className="flex w-full items-center gap-3 border-t border-[#F3F1F8] px-4 py-3 text-left text-[13px] font-semibold text-[#2A07A8] hover:bg-[#FBFAFF] sm:px-5">
              <span aria-hidden className="flex size-10 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#C9BCFB]">
                <Plus className="size-4" />
              </span>
              Invitar a otra persona
            </button>
          ) : null}
        </div>

        <section className={`rounded-2xl bg-white p-4 sm:p-5 ${SOMBRA}`}>
          <p className="flex items-center gap-2 text-[14px] font-semibold">
            <ShieldCheck className="size-4 text-[#3A0CE3]" aria-hidden />
            Roles y accesos
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {(["TESORERO", "OPERADOR"] as const)
              .filter((k) => k === "OPERADOR" || puedeTesorero)
              .map((k) => {
                const r = ROL[k];
                const I = r.icono;
                return (
                  <li key={k} className="flex gap-3 rounded-xl p-3 ring-1 ring-[#F0EEF6]">
                    <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", r.tono)}>
                      <I className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold">
                        {r.nombre} <span className={`text-xs font-normal ${GRIS}`}>· {r.donde}</span>
                      </p>
                      <p className={`mt-0.5 text-xs leading-relaxed ${GRIS}`}>{r.puede.join(" · ")}</p>
                    </div>
                  </li>
                );
              })}
          </ul>
          <p className={`mt-3 text-xs ${GRIS}`}>Desactivar a alguien le quita el acceso al instante. Su historial se mantiene.</p>
        </section>
        </div>

        <aside aria-label="Invitaciones" className="space-y-5 lg:sticky lg:top-4">
          <section data-tour="tec-invitaciones" aria-labelledby="inv-titulo">
            <div className="mb-2.5 flex items-baseline justify-between px-1">
              <h2 id="inv-titulo" className="flex items-center gap-2 text-[15px] font-semibold">
                Invitaciones
                {vigentes ? <span className="rounded-full bg-[#FFF3E0] px-2 py-0.5 text-xs font-semibold text-[#8A4B00]">{vigentes} sin usar</span> : null}
              </h2>
              <button type="button" onClick={() => setInvitar("OPERADOR")} className="text-[13px] font-semibold text-[#2A07A8] hover:underline">
                + Nueva
              </button>
            </div>
            <div className={`overflow-hidden rounded-2xl bg-white ${SOMBRA}`}>
              {invitacionesPendientes.length ? (
                <ul className="divide-y divide-[#F3F1F8]">
                  {invitacionesPendientes.map((i) => (
                    <FilaInvitacion key={i.id} i={i} />
                  ))}
                </ul>
              ) : (
                <p className={`px-6 py-8 text-center text-sm ${GRIS}`}>No hay invitaciones pendientes.</p>
              )}
            </div>
          </section>

        </aside>
      </div>

      {invitar ? <Invitar rolInicial={invitar} puedeTesorero={puedeTesorero} onCerrar={() => setInvitar(null)} /> : null}
      {sel ? (
        <Gestionar
          t={sel}
          puedeTesorero={puedeTesorero}
          onCerrar={() => setGestion(null)}
          onInvitar={(rol) => {
            setGestion(null);
            setInvitar(rol);
          }}
        />
      ) : null}
    </div>
  );
}

function FilaInvitacion({ i }: { i: InvitacionPendiente }) {
  const router = useRouter();
  const [trabajando, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const vencida = i.quedan <= 0;
  const r = ROL[i.rol];
  const I = r.icono;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(i.enlace);
      toast.success("Enlace de invitación copiado");
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      toast.error("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
    }
  }

  function hacer(accion: () => Promise<{ ok: boolean }>, aviso: string) {
    iniciar(async () => {
      await accion();
      toast.success(aviso);
      router.refresh();
    });
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <span aria-hidden className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg", vencida ? "bg-[#F1F0F5] text-[#8F8CA3]" : r.tono)}>
        <I className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-[14px] font-semibold", vencida && "text-[#8F8CA3]")}>{r.nombre}</p>
          <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", vencida ? "bg-[#F1F0F5] text-[#6E6B85]" : i.quedan <= 2 ? "bg-[#FFF3E0] text-[#8A4B00]" : "bg-[#E2F2FC] text-[#0A5F91]")}>
            <Clock className="size-3" aria-hidden />
            {vencida ? "Vencida" : `Vence en ${i.quedan} ${i.quedan === 1 ? "día" : "días"}`}
          </span>
        </div>
        <p className={`mt-0.5 flex items-center gap-1 truncate text-xs ${GRIS}`}>
          <Link2 className="size-3 shrink-0" aria-hidden />
          Enlace para compartir
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          {vencida ? (
            <Button type="button" variant="outline" disabled={trabajando} onClick={() => hacer(() => renovarInvitacion(i.id), "Invitación renovada por 7 días")} className="h-8 rounded-lg border-[#E4E1F0] bg-white px-3 text-xs font-semibold">
              {trabajando ? <Loader2 className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />}
              Renovar 7 días
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={copiar} className="h-8 rounded-lg border-[#E4E1F0] bg-white px-3 text-xs font-semibold">
              {copiado ? <Check className="size-3.5 text-[#0A9B68]" /> : <Copy className="size-3.5" />}
              {copiado ? "Copiado" : "Copiar enlace"}
            </Button>
          )}
          <span className={`ml-auto text-[11px] ${GRIS}`}>{vencida ? `venció el ${fechaCorta.format(new Date(i.expira))}` : `creada el ${fechaCorta.format(new Date(i.creada))}`}</span>
          <Button type="button" variant="ghost" size="icon" aria-label="Cancelar invitación" title="Cancelar invitación" disabled={trabajando} onClick={() => hacer(() => cancelarInvitacion(i.id), "Invitación cancelada")} className="size-8 rounded-lg text-[#8F8CA3] hover:bg-[#FDF3F3] hover:text-[#A32020]">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </li>
  );
}

/** Invitar: se elige el rol, se crea el enlace y se comparte por WhatsApp o copiándolo. */
function Invitar({ rolInicial, puedeTesorero, onCerrar }: { rolInicial: RolEquipo; puedeTesorero: boolean; onCerrar: () => void }) {
  const router = useRouter();
  const [rol, setRol] = useState<RolEquipo>(rolInicial);
  const [url, setUrl] = useState<string | null>(null);
  const [comite, setComite] = useState("");
  const [telefono, setTelefono] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [generando, iniciar] = useTransition();

  function crear() {
    iniciar(async () => {
      const r = await generarInvitacionOperador(rol);
      if (r.ok) {
        setUrl(r.url);
        setComite(r.comite);
      } else toast.error(r.error);
    });
  }

  // Con teléfono se abre el chat de esa persona; sin él, WhatsApp deja elegir a quién.
  const telefonoNormalizado = telefono.trim() ? normalizarTelefono(telefono) : "";
  const telefonoMalo = telefonoNormalizado !== "" && !telefonoValidoParaWhatsApp(telefonoNormalizado);

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace de invitación copiado");
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
    }
  }

  function cerrar() {
    if (url) router.refresh();
    onCerrar();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && cerrar()}>
      <DialogContent showCloseButton={false} className="top-auto bottom-0 left-0 flex max-h-[92dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[520px] sm:max-w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0">
        <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-6 pt-5 pb-4">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ECE8FD] text-[#3A0CE3]">
            <UserPlus className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-semibold">{url ? "Invitación lista" : "Invitar al equipo"}</DialogTitle>
            <p className={`mt-0.5 text-[13px] ${GRIS}`}>{url ? "Compártela. Sirve una sola vez y vence en 7 días." : "La persona crea su cuenta con el enlace. Solo entra quien tú invitas."}</p>
          </div>
          <DialogClose aria-label="Cerrar" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
            <X className="size-[18px]" />
          </DialogClose>
        </div>

        {!url ? (
          <div className="overflow-y-auto px-6 py-5">
            <div role="radiogroup" aria-label="Rol" className="grid gap-2.5 sm:grid-cols-2">
              {(["OPERADOR", "TESORERO"] as const)
                .filter((k) => k === "OPERADOR" || puedeTesorero)
                .map((k) => {
                  const r = ROL[k];
                  const I = r.icono;
                  const on = rol === k;
                  return (
                    <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setRol(k)} className={cn("rounded-xl border p-3.5 text-left transition-colors", on ? "border-[#3A0CE3] bg-[#F7F5FF] ring-1 ring-[#3A0CE3]" : "border-[#E9E6F2] hover:bg-[#FBFAFE]")}>
                      <span className="flex items-center gap-2.5">
                        <span aria-hidden className={cn("flex size-9 items-center justify-center rounded-lg", r.tono)}>
                          <I className="size-[18px]" />
                        </span>
                        <span>
                          <span className={cn("block text-[15px] font-semibold", on && "text-[#2A07A8]")}>{r.nombre}</span>
                          <span className={`block text-xs ${GRIS}`}>{r.donde}</span>
                        </span>
                      </span>
                      <ul className={`mt-2.5 space-y-1 text-xs ${GRIS}`}>
                        {r.puede.map((x) => (
                          <li key={x} className="flex items-center gap-1.5">
                            <Check className="size-3 shrink-0 text-[#0A9B68]" aria-hidden />
                            {x}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto px-6 py-5">
            <div className="rounded-xl bg-[#F7F5FF] p-4">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", ROL[rol].chip)}>{ROL[rol].nombre}</span>
              <div className="mt-3 flex min-w-0 items-center gap-2 rounded-lg bg-white px-3 py-2.5 ring-1 ring-[#E4DEFA]">
                <Link2 className="size-4 shrink-0 text-[#6B46F5]" aria-hidden />
                <span title={url} className="min-w-0 flex-1 truncate font-mono text-[13px]">
                  {url}
                </span>
                <Button type="button" variant="ghost" onClick={copiar} className="h-8 shrink-0 rounded-md px-2.5 text-[13px] font-semibold text-[#2A07A8]">
                  {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copiado ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
            <label className="block">
              <span className="text-[13px] font-semibold">
                Teléfono <span className={`font-normal ${GRIS}`}>(opcional)</span>
              </span>
              <Input inputMode="tel" placeholder="9 1234 5678" value={telefono} onChange={(e) => setTelefono(e.target.value)} aria-invalid={telefonoMalo} className="mt-1.5 h-11 rounded-xl border-[#E4E1F0] shadow-none" />
              <span className={cn("mt-1.5 block text-xs", telefonoMalo ? "text-[#A32020]" : GRIS)}>{telefonoMalo ? "Revisa el número: no parece un teléfono válido." : "Sin teléfono, WhatsApp te deja elegir el contacto."}</span>
            </label>
            <Button type="button" variant="outline" disabled={telefonoMalo} onClick={() => window.open(enlaceWhatsApp(telefonoNormalizado, mensajeInvitacionTecnico(comite, url, rol)), "_blank", "noopener")} className="h-11 w-full rounded-xl border-[#CDEFD9] bg-[#F2FBF5] font-semibold text-[#0A7A52] hover:bg-[#E6F6EF]">
              <MessageCircle className="size-4" />
              Enviar por WhatsApp
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3.5">
          {url ? (
            <Button type="button" onClick={cerrar} className="h-11 rounded-xl px-5 font-semibold">
              Listo
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={cerrar} disabled={generando} className="h-11 rounded-xl font-semibold text-[#46435C]">
                Cancelar
              </Button>
              <Button type="button" onClick={crear} disabled={generando} className="h-11 rounded-xl px-5 font-semibold">
                {generando ? <Loader2 className="animate-spin" /> : <Link2 className="size-4" />}
                Crear enlace
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** La ficha de una persona: su rol, su último acceso y desactivarla o reactivarla. */
function Gestionar({ t, puedeTesorero, onCerrar, onInvitar }: { t: Tecnico; puedeTesorero: boolean; onCerrar: () => void; onInvitar: (rol: RolEquipo) => void }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [trabajando, iniciar] = useTransition();

  function hacer(accion: () => Promise<{ ok: boolean; error?: string }>, aviso: string, cerrar: boolean) {
    iniciar(async () => {
      const r = await accion();
      if (r.ok) {
        toast.success(aviso);
        router.refresh();
        if (cerrar) onCerrar();
      } else toast.error(r.error ?? "No pudimos completar la acción.");
    });
  }

  const primer = t.nombre.split(" ")[0];
  const datos: [string, string][] = [
    ["En el equipo desde", t.desde ? fechaLarga.format(new Date(t.desde)) : "—"],
    ["Último acceso", t.rol ? (t.acceso ?? "Nunca") : "—"],
    ["Cargo", t.cargo ?? "—"],
    ["Cuenta", t.rol ? (t.activo ? "Con acceso" : "Desactivada") : "Sin cuenta"],
  ];

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent showCloseButton={false} className="top-auto bottom-0 left-0 flex max-h-[92dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[480px] sm:max-w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0">
        <div className="flex items-start gap-3 px-6 pt-5 pb-4">
          <Avatar t={t} grande />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-lg font-semibold">{t.nombre}</DialogTitle>
            <p className={`truncate text-[13px] ${GRIS}`}>{t.correo ?? "Sin correo"}</p>
          </div>
          <DialogClose aria-label="Cerrar" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
            <X className="size-[18px]" />
          </DialogClose>
        </div>

        <dl className="mx-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[#F0EEF6] ring-1 ring-[#F0EEF6]">
          {datos.map(([l, v]) => (
            <div key={l} className="bg-white px-3.5 py-2.5">
              <dt className="text-[11px] text-[#5B5970]">{l}</dt>
              <dd className="mt-0.5 truncate text-[13px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          {t.rol === null ? (
            <div className="rounded-xl bg-[#F8F7FC] p-4 text-[13px]">
              <p className="font-semibold">Tiene ficha en Personal, pero no cuenta</p>
              <p className={`mt-1 ${GRIS}`}>No entra al panel. Si necesita acceso, invítala.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => onInvitar("OPERADOR")} className="h-9 rounded-lg border-[#E4E1F0] bg-white font-semibold">
                  <UserPlus className="size-4" />
                  Como operador
                </Button>
                {puedeTesorero ? (
                  <Button type="button" variant="outline" onClick={() => onInvitar("TESORERO")} className="h-9 rounded-lg border-[#E4E1F0] bg-white font-semibold">
                    <UserPlus className="size-4" />
                    Como tesorero
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[13px] font-semibold">Rol</p>
              {puedeTesorero ? (
                <div role="radiogroup" aria-label="Rol" className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-[#F4F3F9] p-1">
                  {(["OPERADOR", "TESORERO"] as const).map((k) => {
                    const I = ROL[k].icono;
                    return (
                      <button key={k} type="button" role="radio" aria-checked={t.rol === k} disabled={!t.activo || trabajando} onClick={() => t.rol !== k && hacer(() => cambiarRolEquipo(t.id, k), `${primer} ahora es ${ROL[k].nombre.toLowerCase()}`, false)} className={cn("flex h-10 items-center justify-center gap-2 rounded-lg text-[13px] font-semibold disabled:opacity-50", t.rol === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}>
                        <I className="size-4" aria-hidden />
                        {ROL[k].nombre}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-1.5">
                  <ChipRol t={t} />
                </p>
              )}
              <p className={`mt-1.5 text-xs ${GRIS}`}>Puede: {ROL[t.rol].puede.join(" · ").toLowerCase()}.</p>
            </div>
          )}

          {confirmar ? (
            <div className="rounded-xl bg-[#FDF3F3] p-4 text-[13px] text-[#7A1A1A]">
              <p className="font-semibold">¿Desactivar a {primer}?</p>
              <p className="mt-1">No podrá entrar al panel ni a la app, y se cierra su sesión. Sus lecturas, pagos y labores se mantienen.</p>
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setConfirmar(false)} disabled={trabajando} className="h-9 rounded-lg font-semibold text-[#46435C]">
                  No
                </Button>
                <Button type="button" disabled={trabajando} onClick={() => hacer(() => desactivarOperador(t.id), `${t.nombre} fue desactivado`, true)} className="h-9 rounded-lg bg-[#D92D20] px-4 font-semibold hover:bg-[#D92D20]/90">
                  {trabajando ? <Loader2 className="animate-spin" /> : null}
                  Sí, desactivar
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3.5">
          {t.rol === null ? null : t.activo ? (
            <Button type="button" variant="outline" disabled={confirmar || trabajando} onClick={() => setConfirmar(true)} className="h-11 rounded-xl border-[#F3D1D1] bg-white font-semibold text-[#A32020] hover:bg-[#FDF3F3]">
              <Power className="size-4" />
              Desactivar acceso
            </Button>
          ) : (
            <Button type="button" disabled={trabajando} onClick={() => hacer(() => reactivarOperador(t.id), `${t.nombre} fue reactivado`, true)} className="h-11 rounded-xl px-5 font-semibold">
              {trabajando ? <Loader2 className="animate-spin" /> : <Power className="size-4" />}
              Reactivar acceso
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onCerrar} className="ml-auto h-11 rounded-xl font-semibold text-[#46435C]">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
