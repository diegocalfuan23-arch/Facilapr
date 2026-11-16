"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays, Check, ChevronRight, Clock3, HandCoins, KeyRound, Mail, Palmtree, Pencil, Phone, Plus, Search, Smartphone, UserX, Users, X } from "lucide-react";
import { cambiarActivoTrabajador } from "@/app/panel/personal/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TrabajadorDialog } from "@/components/panel/trabajador-dialog";
import { RenovarContratoDialog } from "@/components/panel/renovar-contrato-dialog";
import { TASA_RETENCION_HONORARIOS, TEXTO_ACCESO, diasHasta, esPlazoFijo, fechaTermino, liquidacionEstimada, textoTasa, type AccesoPanel, type CuentaPanel, type ExtrasPersona, type TrabajadorFila } from "@/lib/personal-comun";

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const iniciales = (s: string) =>
  s
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
const fechaCL = (iso: string) => iso.split("-").reverse().join("-");
const numero = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });

/** Cuánto lleva trabajando alguien: «7 años», «5 meses» o «menos de un mes». */
function antiguedad(iso: string, hoy: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const [yh, mh, dh] = hoy.split("-").map(Number);
  const meses = Math.max(0, (yh - y) * 12 + (mh - m) - (dh < d ? 1 : 0));
  if (meses < 1) return "menos de un mes";
  if (meses < 12) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const a = Math.floor(meses / 12);
  return `${a} ${a === 1 ? "año" : "años"}`;
}

const tipoDe = (p: TrabajadorFila) => (p.contrato === "HONORARIO" ? "honorarios" : p.porDia ? "diario" : "mensual");
const ETIQUETA_TIPO = { mensual: "Sueldo", diario: "Por día", honorarios: "Honorarios" } as const;
const COLOR_TIPO = {
  mensual: "bg-[#ECE8FD] text-[#2A07A8]",
  diario: "bg-[#E3F3FD] text-[#0B5E94]",
  honorarios: "bg-[#FFF3E0] text-[#8A4B00]",
} as const;
const NOMBRE_TIPO = { mensual: "Sueldo mensual", diario: "Pago por día", honorarios: "Honorarios" } as const;

/** Lo que cobra al mes: null si se le paga por día, porque eso depende de los días que trabaje. */
const brutoMensual = (p: TrabajadorFila) => (p.porDia ? null : p.sueldo);

/** Cuándo termina su contrato a plazo fijo y cuántos días faltan; null si no está a plazo fijo o falta algún dato. */
function plazoDe(p: TrabajadorFila, hoy: string) {
  if (!esPlazoFijo(p) || !p.plazoMeses || !p.fechaIngreso) return null;
  const termino = fechaTermino(p.fechaIngreso, p.plazoMeses);
  return { termino, dias: diasHasta(termino, hoy) };
}

const iconoAcceso = (a: AccesoPanel) => (a === "OPERADOR" ? Smartphone : KeyRound);

function Liquidacion({ p }: { p: TrabajadorFila }) {
  const bruto = brutoMensual(p);
  if (bruto === null) {
    return (
      <dl className="text-sm">
        <div className="flex justify-between py-1.5">
          <dt className={GRIS}>Valor por día</dt>
          <dd className="font-semibold tabular-nums">{clp(p.valorDia ?? 0)}</dd>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between border-t border-[#E9E6F3] pt-2.5">
          <dt className="font-semibold">Líquido a pagar</dt>
          <dd className={`text-sm ${GRIS}`}>según los días</dd>
        </div>
      </dl>
    );
  }
  const l = liquidacionEstimada(p, bruto);
  const filas =
    p.contrato === "HONORARIO"
      ? [{ t: `Retención honorarios (${textoTasa(TASA_RETENCION_HONORARIOS)})`, v: l.desc.retencion }]
      : [
          { t: `AFP (${textoTasa(p.afpTasa)})`, v: l.desc.afp },
          { t: `Salud (${textoTasa(p.saludTasa)})`, v: l.desc.salud },
          ...(p.cesantia ? [{ t: "Cesantía (0,6 %)", v: l.desc.cesantia }] : []),
        ];
  return (
    <dl className="text-sm">
      <div className="flex justify-between py-1.5">
        <dt className={GRIS}>Sueldo bruto</dt>
        <dd className="font-semibold tabular-nums">{clp(l.bruto)}</dd>
      </div>
      {filas.map((f) => (
        <div key={f.t} className="flex justify-between py-1.5">
          <dt className={GRIS}>− {f.t}</dt>
          <dd className="text-[#A32020] tabular-nums">{clp(f.v)}</dd>
        </div>
      ))}
      {l.colacion > 0 ? (
        <div className="flex justify-between py-1.5">
          <dt className={GRIS}>+ Colación y movilización</dt>
          <dd className="text-[#075A3C] tabular-nums">{clp(l.colacion)}</dd>
        </div>
      ) : null}
      <div className="mt-1.5 flex items-baseline justify-between border-t border-[#E9E6F3] pt-2.5">
        <dt className="font-semibold">Líquido a pagar</dt>
        <dd className="text-xl font-semibold tabular-nums">{clp(l.liquido)}</dd>
      </div>
    </dl>
  );
}

function Detalle({
  p,
  acceso,
  extras,
  hoy,
  cambiando,
  onEditar,
  onEstado,
  onRenovar,
  onCerrar,
}: {
  p: TrabajadorFila;
  acceso: AccesoPanel | null;
  extras: ExtrasPersona | undefined;
  hoy: string;
  cambiando: boolean;
  onEditar: () => void;
  onEstado: () => void;
  onRenovar: () => void;
  onCerrar?: () => void;
}) {
  const tipo = tipoDe(p);
  const plazo = plazoDe(p, hoy);
  const vacaciones = p.contrato === "HONORARIO" ? "No aplica" : extras?.vacaciones == null ? "—" : `${numero(extras.vacaciones)} días`;
  const anticipo = extras && extras.anticipo > 0 ? clp(extras.anticipo) : "Ninguno";
  const tiles = [
    { I: Palmtree, t: "Ausencias", v: vacaciones, href: "/panel/ausencias" },
    { I: Clock3, t: "Asistencia", v: "Este mes", href: "/panel/asistencia" },
    { I: HandCoins, t: "Anticipos", v: anticipo, href: "/panel/prestamos" },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-5 py-4">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#ECE8FD] text-sm font-bold text-[#2A07A8]">
          {iniciales(p.nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg leading-tight font-semibold">{p.nombre}</p>
          <p className={`text-xs ${GRIS}`}>
            {p.cargo} · {p.rut || "Sin RUT"}
          </p>
          <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.activo ? "bg-[#E6F6EF] text-[#075A3C]" : "bg-[#F1F0F6] text-[#5B5970]"}`}>
            <span aria-hidden className={`size-1.5 rounded-full ${p.activo ? "bg-[#2FB386]" : "bg-[#A19FB2]"}`} />
            {p.activo ? (p.fechaIngreso ? `Activo · ${antiguedad(p.fechaIngreso, hoy)}` : "Activo") : "De baja"}
          </span>
        </div>
        <Button variant="ghost" size="icon" aria-label="Editar" onClick={onEditar} className="size-9 rounded-lg">
          <Pencil className="size-4" />
        </Button>
        {onCerrar ? (
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onCerrar} className="size-9 rounded-lg lg:hidden">
            <X />
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 divide-y divide-[#F0EEF6] overflow-y-auto">
        <section className="px-5 py-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-semibold">Liquidación mensual</p>
            <span className={`text-xs ${GRIS}`}>estimada</span>
          </div>
          <div className="mt-2">
            <Liquidacion p={p} />
          </div>
          <Button variant="outline" nativeButton={false} render={<Link href="/panel/remuneraciones" />} className="mt-3 h-9 w-full rounded-lg border-[#E4E1F0] text-[13px] font-semibold">
            Ver en Remuneraciones
            <ChevronRight className="size-4" />
          </Button>
        </section>

        <section className="px-5 py-4">
          {plazo && p.activo ? (
            <div className={`mb-3 flex items-center gap-3 rounded-xl px-3.5 py-2.5 ${plazo.dias <= 30 ? "bg-[#FFF6E8]" : "bg-[#F8F7FC]"}`}>
              <CalendarDays className={`size-4 shrink-0 ${plazo.dias <= 30 ? "text-[#B86400]" : "text-[#6B46F5]"}`} aria-hidden />
              <p className="min-w-0 flex-1 text-[13px]">
                <span className={GRIS}>Contrato termina el</span> <b className="font-semibold">{fechaCL(plazo.termino)}</b>
                <span className={`block text-xs ${plazo.dias <= 30 ? "font-medium text-[#8A4B00]" : GRIS}`}>
                  {plazo.dias < 0 ? "Vencido: si sigue trabajando pasa a indefinido" : plazo.dias === 0 ? "Termina hoy" : `Quedan ${plazo.dias} ${plazo.dias === 1 ? "día" : "días"}`}
                </span>
              </p>
              <Button variant="outline" size="sm" onClick={onRenovar} className="h-8 shrink-0 rounded-lg border-[#E4E1F0] bg-white px-2.5 text-xs font-semibold">
                Renovar
              </Button>
            </div>
          ) : null}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <div>
              <dt className={GRIS}>Contrato</dt>
              <dd className="font-medium">
                {NOMBRE_TIPO[tipo]}
                {tipo !== "honorarios" ? ` · ${p.cesantia ? "indefinido" : p.plazoMeses ? `plazo fijo de ${p.plazoMeses} ${p.plazoMeses === 1 ? "mes" : "meses"}` : "plazo fijo"}` : ""}
              </dd>
            </div>
            <div>
              <dt className={GRIS}>Ingreso</dt>
              <dd className="font-medium">{p.fechaIngreso ? `${fechaCL(p.fechaIngreso)} · ${antiguedad(p.fechaIngreso, hoy)}` : "—"}</dd>
            </div>
            {tipo !== "honorarios" ? (
              <>
                <div>
                  <dt className={GRIS}>Jornada</dt>
                  <dd className="font-medium">
                    {numero(p.jornadaSemanal)} h · {p.diasSemana} días
                  </dd>
                </div>
                <div>
                  <dt className={GRIS}>Previsión</dt>
                  <dd className="font-medium">
                    {p.afp || "Sin AFP"} · {p.saludTasa === 700 ? "Fonasa" : "Isapre"}
                  </dd>
                </div>
              </>
            ) : null}
            <div className="col-span-2">
              <dt className={GRIS}>Acceso a Facilapr</dt>
              <dd className="font-medium">{acceso ? TEXTO_ACCESO[acceso] : "Sin acceso"}</dd>
            </div>
            {p.notas ? (
              <div className="col-span-2">
                <dt className={GRIS}>Notas</dt>
                <dd className="font-medium">{p.notas}</dd>
              </div>
            ) : null}
          </dl>
          {p.telefono || p.email ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {p.telefono ? (
                <a href={`tel:${p.telefono}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#F4F3F9] px-2.5 text-xs font-medium text-[#3F3C55] hover:bg-[#ECEAF4]">
                  <Phone className="size-3.5" aria-hidden />
                  {p.telefono}
                </a>
              ) : null}
              {p.email ? (
                <a href={`mailto:${p.email}`} className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-lg bg-[#F4F3F9] px-2.5 text-xs font-medium text-[#3F3C55] hover:bg-[#ECEAF4]">
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{p.email}</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="grid grid-cols-3 gap-2 px-5 py-4">
          {tiles.map(({ I, t, v, href }) => (
            <Link key={t} href={href} className="rounded-xl bg-[#F8F7FC] px-2 py-3 text-center hover:bg-[#F1EEFD]">
              <I className="mx-auto size-[18px] text-[#6B46F5]" aria-hidden />
              <span className="mt-1.5 block text-[11px] font-semibold">{t}</span>
              <span className={`block truncate text-[11px] ${GRIS}`}>{v}</span>
            </Link>
          ))}
        </section>
      </div>

      <div className="border-t border-[#F0EEF6] p-4">
        <Button
          variant="outline"
          disabled={cambiando}
          onClick={onEstado}
          className={`h-10 w-full rounded-xl border-[#E4E1F0] font-semibold ${p.activo ? "text-[#A32020] hover:bg-[#FDF3F3] hover:text-[#A32020]" : ""}`}
        >
          {p.activo ? (
            <>
              <UserX className="size-4" />
              Dar de baja
            </>
          ) : (
            <>
              <Check className="size-4" />
              Reactivar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/** La ficha de las personas del comité: quién trabaja, cuánto cuesta y cómo se le paga. Sus sueldos se pagan en Remuneraciones. */
export function PersonalVista({
  personas,
  cuentas,
  puedeTesorero,
  extras,
  hoy,
}: {
  personas: TrabajadorFila[];
  cuentas: CuentaPanel[];
  puedeTesorero: boolean;
  extras: Record<string, ExtrasPersona>;
  hoy: string;
}) {
  const [filtro, setFiltro] = useState<"activos" | "inactivos">("activos");
  const [busqueda, setBusqueda] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [movil, setMovil] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<TrabajadorFila | null>(null);
  const [renovando, setRenovando] = useState<TrabajadorFila | null>(null);
  // Una cuenta del panel sin ficha: al crearle la ficha se parte con sus datos.
  const [desdeCuenta, setDesdeCuenta] = useState<CuentaPanel | null>(null);
  const [cambiando, iniciar] = useTransition();
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
    setDesdeCuenta(null);
  }, []);

  // Se liga la ficha con la cuenta por el correo.
  const accesoDe = (p: TrabajadorFila) => cuentas.find((x) => p.email && x.email === p.email.toLowerCase())?.acceso ?? null;
  const correosConFicha = new Set(personas.map((p) => p.email?.toLowerCase()).filter(Boolean));
  // Operadores y tesoreros con acceso que aún no tienen ficha (los administradores no se piden).
  const sinFicha = cuentas.filter((x) => (x.acceso === "OPERADOR" || x.acceso === "TESORERO") && !correosConFicha.has(x.email));

  const activas = personas.filter((p) => p.activo);
  const mensuales = activas.filter((p) => !p.porDia);
  const partes = [
    { t: "Sueldos", v: mensuales.filter((p) => p.contrato === "SUELDO").reduce((s, p) => s + p.sueldo, 0), c: "bg-[#6B46F5]" },
    { t: "Honorarios", v: mensuales.filter((p) => p.contrato === "HONORARIO").reduce((s, p) => s + p.sueldo, 0), c: "bg-[#F0A23C]" },
    { t: "Colación", v: mensuales.reduce((s, p) => s + p.noImponible, 0), c: "bg-[#2FB386]" },
  ].filter((x) => x.v > 0);
  const costo = partes.reduce((s, x) => s + x.v, 0);
  const liquido = mensuales.reduce((s, p) => s + liquidacionEstimada(p, p.sueldo).liquido, 0);
  const porDia = activas.filter((p) => p.porDia).length;
  const conAcceso = activas.filter((p) => {
    const a = accesoDe(p);
    return a !== null && a !== "DESACTIVADO";
  });
  const accesoPor = (a: AccesoPanel) => conAcceso.filter((p) => accesoDe(p) === a).length;
  const detalleAcceso = [
    accesoPor("OPERADOR") > 0 ? `${accesoPor("OPERADOR")} en terreno` : "",
    accesoPor("TESORERO") > 0 ? `${accesoPor("TESORERO")} tesorería` : "",
    accesoPor("ADMIN") > 0 ? `${accesoPor("ADMIN")} en administración` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const lista = useMemo(() => {
    const t = busqueda.trim().toLowerCase().replace(/[.-]/g, "");
    return personas.filter((p) => p.activo === (filtro === "activos") && (!t || `${p.nombre} ${p.cargo} ${p.rut ?? ""}`.toLowerCase().replace(/[.-]/g, "").includes(t)));
  }, [personas, filtro, busqueda]);
  const actual = lista.find((p) => p.id === sel) ?? lista[0] ?? null;

  function cambiarEstado(p: TrabajadorFila) {
    iniciar(async () => {
      const r = await cambiarActivoTrabajador(p.id, !p.activo);
      if (r.ok) {
        toast.success(p.activo ? "Persona dada de baja" : "Persona reactivada");
        setMovil(false);
      } else {
        toast.error(r.error);
      }
    });
  }

  const detalle = (p: TrabajadorFila, onCerrar?: () => void) => (
    <Detalle key={p.id} p={p} acceso={accesoDe(p)} extras={extras[p.id]} hoy={hoy} cambiando={cambiando} onEditar={() => setEditando(p)} onEstado={() => cambiarEstado(p)} onRenovar={() => setRenovando(p)} onCerrar={onCerrar} />
  );

  return (
    <div className="mx-auto w-full max-w-[1376px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[28px]">Personal</h1>
          <p className={`mt-0.5 text-[15px] ${GRIS}`}>Quienes trabajan para el comité. De aquí sale su remuneración, sus ausencias y su asistencia.</p>
        </div>
        <Button data-tour="per-nueva" onClick={() => setCreando(true)} className="h-10 shrink-0 rounded-lg px-4 font-semibold">
          <Plus />
          Nueva persona
        </Button>
      </div>

      <Card data-tour="per-resumen" className={`mt-5 grid grid-cols-2 gap-y-4 rounded-2xl border-0 p-5 sm:p-6 lg:grid-cols-[1.3fr_1fr_1fr] lg:divide-x lg:divide-[#F0EEF6] ${SOMBRA}`}>
        <div className="col-span-2 lg:col-span-1 lg:pr-6">
          <p className={`text-[13px] ${GRIS}`}>Costo mensual del personal</p>
          <p className="mt-1 text-[30px] leading-none font-semibold tabular-nums">{clp(costo)}</p>
          {partes.length > 0 ? (
            <>
              <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                {partes.map((x) => (
                  <span key={x.t} className={x.c} style={{ width: `${(x.v / costo) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {partes.map((x) => (
                  <li key={x.t} className="flex items-center gap-1.5">
                    <span aria-hidden className={`size-2 rounded-full ${x.c}`} />
                    <span className={GRIS}>{x.t}</span>
                    <b className="font-semibold tabular-nums">{clp(x.v)}</b>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        <div className="min-w-0 lg:px-6">
          <p className={`text-[13px] ${GRIS}`}>Personas activas</p>
          <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">{activas.length}</p>
          <p className={`mt-1 truncate text-xs ${GRIS}`}>
            <b className="font-semibold text-[#15132B]">{clp(liquido)}</b> líquido a pagar{porDia > 0 ? ` · ${porDia} por día` : ""}
          </p>
        </div>
        <div className="min-w-0 lg:px-6">
          <p className={`text-[13px] ${GRIS}`}>Con acceso a Facilapr</p>
          <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">{conAcceso.length}</p>
          <p className={`mt-1 truncate text-xs ${GRIS}`}>{detalleAcceso || "Nadie por ahora"}</p>
        </div>
      </Card>

      {sinFicha.length > 0 && (
        <section aria-label="Con acceso y sin ficha" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-[0.9rem] font-medium text-amber-900 dark:text-amber-200">
            {sinFicha.length === 1 ? "Una persona con acceso al panel no tiene ficha" : `${sinFicha.length} personas con acceso al panel no tienen ficha`}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {sinFicha.map((x) => (
              <li key={x.email}>
                <Button variant="outline" className="h-9 rounded-full bg-card px-4 text-[0.85rem]" onClick={() => setDesdeCuenta(x)}>
                  {x.nombre} · {TEXTO_ACCESO[x.acceso]} · Crear ficha
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className={`min-w-0 overflow-hidden rounded-2xl border-0 ${SOMBRA}`}>
          <div className="flex flex-col gap-3 border-b border-[#F0EEF6] p-4 sm:flex-row sm:items-center sm:px-5">
            <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-[#F4F3F9] p-1 sm:w-[260px]">
              {(
                [
                  ["activos", "Activos", activas.length],
                  ["inactivos", "De baja", personas.length - activas.length],
                ] as const
              ).map(([k, t, n]) => (
                <button key={k} role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)} className={`h-8 rounded-md text-[13px] font-semibold ${filtro === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS}`}>
                  {t} <span className={`text-xs font-medium ${filtro === k ? "text-[#6B46F5]" : "text-[#A19FB2]"}`}>{n}</span>
                </button>
              ))}
            </div>
            <div className="relative min-w-0 flex-1 sm:ml-auto sm:max-w-[280px]">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, cargo o RUT" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
            </div>
          </div>

          <div className={`hidden grid-cols-[minmax(0,1fr)_104px_130px_110px_110px_20px] gap-4 border-b border-[#F3F1F8] bg-[#FAFAFD] px-5 py-2.5 text-xs font-medium md:grid ${GRIS}`}>
            <span>Persona</span>
            <span>Contrato</span>
            <span>Acceso</span>
            <span className="text-right">Bruto</span>
            <span className="text-right">Líquido</span>
            <span />
          </div>
          <ul className="divide-y divide-[#F3F1F8]">
            {lista.map((p) => {
              const tipo = tipoDe(p);
              const bruto = brutoMensual(p);
              const liq = bruto === null ? null : liquidacionEstimada(p, bruto).liquido;
              const acceso = accesoDe(p);
              const AccesoIcono = acceso ? iconoAcceso(acceso) : null;
              const activo = actual?.id === p.id;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      setSel(p.id);
                      setMovil(true);
                    }}
                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 text-left md:grid-cols-[minmax(0,1fr)_104px_130px_110px_110px_20px] md:px-5 ${activo ? "bg-[#F5F3FE] shadow-[inset_3px_0_0_#3A0CE3]" : "hover:bg-[#FBFAFF]"}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F1EEFD] text-xs font-bold text-[#2A07A8]">
                        {iniciales(p.nombre)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold">{p.nombre}</span>
                        <span className={`block truncate text-[13px] ${GRIS}`}>
                          {p.cargo}
                          {p.fechaIngreso ? ` · desde ${fechaCL(p.fechaIngreso).slice(3)}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="text-right md:hidden">
                      <span className="block text-[15px] font-semibold tabular-nums">{liq === null ? clp(p.valorDia ?? 0) : clp(liq)}</span>
                      <span className={`block text-xs ${GRIS}`}>{liq === null ? "por día" : "líquido"}</span>
                    </span>
                    <span className="hidden md:block">
                      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${COLOR_TIPO[tipo]}`}>{ETIQUETA_TIPO[tipo]}</span>
                      {(() => {
                        const plazo = p.activo ? plazoDe(p, hoy) : null;
                        return plazo ? <span className={`mt-1 block text-[11px] ${plazo.dias <= 30 ? "font-medium text-[#8A4B00]" : GRIS}`}>vence {fechaCL(plazo.termino).slice(0, 5)}</span> : null;
                      })()}
                    </span>
                    <span className={`hidden items-center gap-1.5 text-[13px] md:flex ${acceso && acceso !== "DESACTIVADO" ? "text-[#3F3C55]" : "text-[#A19FB2]"}`}>
                      {acceso && AccesoIcono ? (
                        <>
                          <AccesoIcono className="size-3.5 shrink-0 text-[#6B46F5]" aria-hidden />
                          <span className="truncate">{TEXTO_ACCESO[acceso]}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="hidden text-right text-sm tabular-nums md:block">
                      <span className="block">{clp(bruto ?? p.valorDia ?? 0)}</span>
                      {bruto === null ? <span className={`block text-[11px] ${GRIS}`}>por día</span> : null}
                    </span>
                    <span className="hidden text-right text-[15px] font-semibold tabular-nums md:block">{liq === null ? <span className={`text-[13px] font-normal ${GRIS}`}>según los días</span> : clp(liq)}</span>
                    <ChevronRight className="hidden size-4 text-[#B4B2C4] md:block" aria-hidden />
                  </button>
                </li>
              );
            })}
            {lista.length === 0 ? (
              <li className="px-6 py-14 text-center">
                <Users className="mx-auto size-8 text-[#B4B2C4]" aria-hidden />
                <p className="mt-2 font-semibold">{busqueda.trim() ? "Nada coincide con la búsqueda" : filtro === "activos" ? "Aún no hay personal" : "Nadie dado de baja"}</p>
                {!busqueda.trim() ? <p className={`mt-1 text-sm ${GRIS}`}>{filtro === "activos" ? "Agrega a quien trabaja para el comité para armar su sueldo." : "Quienes se den de baja quedan aquí con su historial."}</p> : null}
              </li>
            ) : null}
          </ul>
        </Card>

        {actual ? <Card className={`hidden h-[min(700px,calc(100vh-2rem))] overflow-hidden rounded-2xl border-0 lg:sticky lg:top-4 lg:block ${SOMBRA}`}>{detalle(actual)}</Card> : null}
      </div>
      <p className={`mt-4 text-xs ${GRIS}`}>Montos estimados con la ficha de cada persona, sin horas extra ni descuentos del mes.</p>

      {actual && movil ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={actual.nombre}>
          <button aria-label="Cerrar" onClick={() => setMovil(false)} className="absolute inset-0 bg-[#15132B]/40" />
          <div className="absolute inset-x-0 bottom-0 h-[88vh] overflow-hidden rounded-t-2xl bg-white">{detalle(actual, () => setMovil(false))}</div>
        </div>
      ) : null}

      {renovando ? <RenovarContratoDialog key={renovando.id} persona={renovando} hoy={hoy} onCerrar={() => setRenovando(null)} /> : null}

      {(creando || editando || desdeCuenta) && (
        <TrabajadorDialog
          key={editando?.id ?? desdeCuenta?.email ?? "nueva"}
          persona={editando}
          inicial={desdeCuenta ? { nombre: desdeCuenta.nombre, email: desdeCuenta.email, cargo: TEXTO_ACCESO[desdeCuenta.acceso] } : null}
          acceso={editando ? accesoDe(editando) : null}
          puedeTesorero={puedeTesorero}
          onCerrar={cerrar}
        />
      )}
    </div>
  );
}
