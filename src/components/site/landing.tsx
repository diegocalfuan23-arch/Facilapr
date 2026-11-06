"use client"

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowRight, Check, ChevronDown, Menu, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { enviarConsulta, type ResultadoConsulta } from "@/app/actions-contacto"
import { PREGUNTAS } from "@/lib/faq"

/** Actualizar cada mes o traer desde una API. Valor aproximado de noviembre de 2026. */
const VALOR_UF = 41250
const RAZON_SOCIAL = "DESARROLLO DE SOFTWARES A MEDIDAS SpA"
const LECTURA_ANTERIOR = 1236

const MONO = "font-[family-name:var(--font-geist-mono)]"
const GRIS = "text-[#5B5970]"
const TITULO = "font-semibold tracking-[-0.035em] [text-wrap:balance]"
const SOMBRA = "shadow-[0_1px_2px_rgba(21,19,43,0.04),0_16px_40px_rgba(58,12,227,0.08)]"

const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL")
const aproxUF = (uf: number) => "$" + (Math.round((uf * VALOR_UF) / 100) * 100).toLocaleString("es-CL")

function Boton({ href, children, claro = false }: { href: string; children: ReactNode; claro?: boolean }) {
  return (
    <a
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-all hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9D85FF] focus-visible:ring-offset-2 ${
        claro ? "bg-white text-[#15132B] hover:bg-[#ECE8FD]" : "bg-[#3A0CE3] text-white hover:bg-[#2A07A8]"
      }`}
    >
      {children}
      <ArrowRight className="size-4" aria-hidden />
    </a>
  )
}

function Fila({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className={`text-sm ${GRIS}`}>{etiqueta}</dt>
      <dd className={`${MONO} text-sm tabular-nums ${fuerte ? "font-semibold" : ""}`}>{valor}</dd>
    </div>
  )
}

function Boleta() {
  const [cargo, setCargo] = useState(2100)
  const [m3, setM3] = useState(450)
  const [consumo, setConsumo] = useState(14)
  const campo = `${MONO} mt-1 h-11 rounded-xl border-[#E4E1F0] bg-[#F7F6FC] shadow-none`
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-6 rounded-[40px] bg-[#5B7CFF]/30 blur-3xl" />
      <div className="relative rounded-[28px] bg-white p-6 text-[#15132B] shadow-[0_30px_80px_rgba(4,3,20,0.55)]">
        <span className="absolute -right-3 -top-3 hidden items-center gap-1.5 rounded-full bg-[#0A8259] px-3 py-1.5 text-xs font-semibold text-white shadow-lg sm:inline-flex">
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
          Cálculo automático
        </span>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[17px] font-semibold tracking-tight">Boleta de agua</p>
            <p className={`text-[13px] ${GRIS}`}>Comité de ejemplo · Noviembre 2026</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#ECE8FD] px-2.5 py-1 text-xs font-semibold text-[#2A07A8] sm:mr-16 sm:hidden">Pruébala</span>
        </div>

        <dl className="mt-4 rounded-2xl bg-[#F7F6FC] px-4 py-2">
          <Fila etiqueta="Lectura anterior" valor={`${LECTURA_ANTERIOR.toLocaleString("es-CL")} m³`} />
          <Fila etiqueta="Lectura actual" valor={`${(LECTURA_ANTERIOR + consumo).toLocaleString("es-CL")} m³`} />
          <Fila etiqueta="Consumo" valor={`${consumo} m³`} fuerte />
        </dl>

        <label htmlFor="b-consumo" className="mt-4 block text-[13px] font-medium">Mueve el consumo</label>
        <input id="b-consumo" type="range" min="0" max="60" value={consumo} onChange={(e) => setConsumo(Number(e.target.value))} className="mt-1 h-6 w-full accent-[#3A0CE3]" />

        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="b-cargo" className="text-[13px] font-medium">Cargo fijo</label>
            <Input id="b-cargo" type="number" min="0" value={cargo} onChange={(e) => setCargo(Number(e.target.value))} className={campo} />
          </div>
          <div>
            <label htmlFor="b-m3" className="text-[13px] font-medium">Valor del m³</label>
            <Input id="b-m3" type="number" min="0" value={m3} onChange={(e) => setM3(Number(e.target.value))} className={campo} />
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4">
          <p className={`text-sm ${GRIS}`}>Total a pagar</p>
          <p className="text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[#3A0CE3]">{clp(consumo * m3 + cargo)}</p>
        </div>
      </div>
    </div>
  )
}

function Paisaje() {
  const alamos = [860, 892, 926, 958, 1296, 1330, 1362, 1396]
  const postes = [120, 300, 480, 660]
  return (
    <svg viewBox="0 0 1440 340" preserveAspectRatio="xMaxYMax slice" role="img" aria-label="Estanque de agua elevado en un campo del sur de Chile, con un volcán de fondo" className="relative mt-6 block h-[190px] w-full md:mt-2 md:h-[320px]">
      <path d="M180 250 L420 62 Q440 48 460 62 L720 250 Z" fill="#232A78" />
      <path d="M392 84 L420 62 Q440 48 460 62 L492 86 L470 100 L450 88 L432 104 L414 90 Z" fill="#AEB8FF" />
      <path d="M0 240 C200 170 380 215 560 200 C780 182 960 150 1180 186 C1290 204 1380 200 1440 188 V340 H0 Z" fill="#2B348F" />
      <path d="M0 278 C260 226 520 268 760 246 C980 226 1200 214 1440 246 V340 H0 Z" fill="#3B46B5" />
      {alamos.map((x, i) => (
        <g key={x}>
          <rect x={x - 1.500} y="205" width="3" height="30" fill="#141750" />
          <ellipse cx={x} cy={178 + (i % 2) * 5} rx="13" ry={44 - (i % 2) * 5} fill="#1A1F66" />
        </g>
      ))}
      <g fill="none" stroke="#141750" strokeLinecap="round">
        <path d="M1098 262 L1110 118 M1182 262 L1170 118" strokeWidth="6" />
        <path d="M1105 172 L1175 172 M1101 222 L1179 222" strokeWidth="4" />
        <path d="M1110 122 L1177 222 M1170 122 L1103 222 M1104 172 L1179 262 M1176 172 L1101 262" strokeWidth="2.500" />
        <path d="M1140 104 V262 H1060" stroke="#AEB8FF" strokeWidth="3.500" />
      </g>
      <rect x="1090" y="52" width="100" height="70" rx="9" fill="#141750" />
      <path d="M1084 56 Q1140 18 1196 56 Z" fill="#20267A" />
      <rect x="1104" y="66" width="7" height="42" rx="3.500" fill="#5B7CFF" />
      <rect x="1076" y="120" width="128" height="6" rx="3" fill="#141750" />
      <rect x="985" y="226" width="72" height="42" fill="#141750" />
      <path d="M977 228 L1021 204 L1065 228 Z" fill="#20267A" />
      <rect x="1014" y="240" width="15" height="28" fill="#AEB8FF" />
      {postes.map((x) => (
        <rect key={x} x={x} y="232" width="4" height="46" fill="#232A78" />
      ))}
      <path d="M122 236 Q212 252 302 236 Q392 252 482 236 Q572 252 662 236" fill="none" stroke="#232A78" strokeWidth="1.500" />
      <path d="M0 310 C240 264 560 294 860 280 C1110 268 1300 256 1440 276 V340 H0 Z" fill="#F6F6FB" />
    </svg>
  )
}

function Red() {
  const casas = [
    { x: 560, y: 262 },
    { x: 780, y: 248 },
    { x: 1000, y: 262 },
    { x: 1220, y: 244 },
  ]
  return (
    <svg viewBox="0 0 1440 420" role="img" aria-label="Cañería que lleva agua desde un estanque hasta varias casas rurales, cada una con su medidor" className="block h-auto w-full">
      <defs>
        <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C4CAFF" />
          <stop offset="1" stopColor="#F0F1FF" />
        </linearGradient>
      </defs>
      <rect width="1440" height="420" fill="url(#cielo)" />
      <circle cx="1240" cy="86" r="46" fill="#FFFFFF" opacity="0.85" />
      <path d="M0 250 C240 170 420 230 640 208 C900 182 1160 150 1440 214 V420 H0 Z" fill="#A9B3F6" />
      <path d="M0 300 C300 258 620 306 900 286 C1120 270 1300 262 1440 282 V420 H0 Z" fill="#7C89EE" />
      <g fill="none" stroke="#2A2F8F" strokeLinecap="round">
        <path d="M118 306 L130 160 M202 306 L190 160" strokeWidth="6" />
        <path d="M125 214 L195 214 M121 262 L199 262" strokeWidth="4" />
        <path d="M130 164 L197 262 M190 164 L123 262" strokeWidth="2.500" />
      </g>
      <rect x="110" y="92" width="100" height="70" rx="9" fill="#2A2F8F" />
      <path d="M104 96 Q160 58 216 96 Z" fill="#3A0CE3" />
      <rect x="124" y="106" width="7" height="42" rx="3.500" fill="#AEB8FF" />
      <path d="M160 150 V348 H1262" fill="none" stroke="#3A0CE3" strokeWidth="6" strokeLinejoin="round" />
      {casas.map((c) => (
        <g key={c.x}>
          <path d={`M${c.x + 40} 348 V${c.y + 52}`} stroke="#3A0CE3" strokeWidth="4" />
          <rect x={c.x} y={c.y} width="82" height="54" fill="#FFFFFF" />
          <path d={`M${c.x - 10} ${c.y + 2} L${c.x + 41} ${c.y - 32} L${c.x + 92} ${c.y + 2} Z`} fill="#2A2F8F" />
          <rect x={c.x + 14} y={c.y + 18} width="17" height="36" fill="#7C89EE" />
          <rect x={c.x + 46} y={c.y + 16} width="20" height="16" fill="#C4CAFF" />
          <circle cx={c.x + 40} cy="348" r="13" fill="#FFFFFF" stroke="#3A0CE3" strokeWidth="4" />
          <path d={`M${c.x + 40} 348 L${c.x + 47} 342`} stroke="#3A0CE3" strokeWidth="3" strokeLinecap="round" />
        </g>
      ))}
      <path d="M0 392 C300 372 700 398 1040 382 C1220 374 1340 372 1440 382 V420 H0 Z" fill="#FFFFFF" />
    </svg>
  )
}

function Medidor() {
  const marcas = Array.from({ length: 24 }, (_, i) => (i * 360) / 24)
  return (
    <svg viewBox="0 0 360 360" role="img" aria-label="Medidor de agua con su dial y contador en metros cúbicos" className="mx-auto mt-8 hidden w-full max-w-[300px] lg:mx-0 lg:block">
      <rect x="0" y="152" width="44" height="56" rx="8" fill="#AEB8FF" />
      <rect x="316" y="152" width="44" height="56" rx="8" fill="#AEB8FF" />
      <circle cx="180" cy="180" r="150" fill="#3A0CE3" />
      <circle cx="180" cy="180" r="126" fill="#FFFFFF" />
      {marcas.map((a) => (
        <rect key={a} x="178" y="66" width="4" height="14" rx="2" fill="#C4CAFF" transform={`rotate(${a} 180 180)`} />
      ))}
      <rect x="112" y="122" width="136" height="44" rx="10" fill="#15132B" />
      <text x="180" y="153" textAnchor="middle" fontSize="28" fontFamily="var(--font-geist-mono), monospace" fontWeight="600" letterSpacing="4" fill="#FFFFFF">01250</text>
      <text x="180" y="190" textAnchor="middle" fontSize="16" fontFamily="var(--font-geist-sans), sans-serif" fill="#5B5970">m³</text>
      <circle cx="180" cy="248" r="30" fill="#F1EEFD" />
      <path d="M180 248 L198 232" stroke="#3A0CE3" strokeWidth="5" strokeLinecap="round" />
      <circle cx="180" cy="248" r="6" fill="#3A0CE3" />
    </svg>
  )
}

function Tile({ titulo, texto, clase = "", children, id }: { titulo: string; texto: string; clase?: string; children: ReactNode; id?: string }) {
  return (
    <article id={id} className={`scroll-mt-24 group flex flex-col overflow-hidden rounded-[28px] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(21,19,43,0.04),0_24px_50px_rgba(58,12,227,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${SOMBRA} ${clase}`}>
      <div className="p-6 pb-4">
        <h3 className="text-xl font-semibold tracking-tight">{titulo}</h3>
        <p className={`mt-1 text-[15px] leading-relaxed ${GRIS}`}>{texto}</p>
      </div>
      <div className="flex flex-1 flex-col justify-end px-6 pb-6">{children}</div>
    </article>
  )
}

function DemoCaja() {
  return (
    <div className="rounded-2xl bg-[#F7F6FC] p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          ["Ingresos", "$186.400", "text-[#066A47]"],
          ["Egresos", "$153.300", "text-[#A32020]"],
          ["Disponible", "$1.276.050", "text-[#3A0CE3]"],
        ].map(([l, v, c]) => (
          <div key={l} className={`min-w-0 rounded-xl bg-white p-2.5 ${l === "Disponible" ? "col-span-2 sm:col-span-1" : ""}`}>
            <p className={`text-[11px] font-medium ${GRIS}`}>{l}</p>
            <p className={`truncate text-[15px] font-semibold tabular-nums tracking-tight sm:text-[17px] ${c}`}>{v}</p>
          </div>
        ))}
      </div>
      {[
        ["Compra de cloro", "-$83.300"],
        ["Reparación de bomba", "-$70.000"],
      ].map(([d, m]) => (
        <div key={d} className="mt-2 flex justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-sm">
          <span className="truncate font-medium">{d}</span>
          <span className="shrink-0 font-semibold tabular-nums text-[#A32020]">{m}</span>
        </div>
      ))}
    </div>
  )
}

function DemoLectura() {
  return (
    <div className="flex flex-1 flex-col justify-center rounded-2xl bg-[#443D86] p-5 text-center text-white">
      <p className="text-xs text-white/80">Lectura del medidor · Socio N.° 148</p>
      <p className="mt-1 text-5xl font-semibold tracking-[0.06em] tabular-nums">1250</p>
      <p className="mt-2 text-sm font-medium text-[#8DF0C4]">Consumo 14 m³</p>
    </div>
  )
}

function DemoChat() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-[#F1F0F7] px-3.5 py-2">¿Cuánto debo este mes?</p>
      <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[#3A0CE3] px-3.5 py-2 text-white">Tienes 1 boleta pendiente por $8.400. Vence el día 10.</p>
      <p className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-[#F1F0F7] px-3.5 py-2">¿Y si tengo una filtración?</p>
      <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[#ECE8FD] px-3.5 py-2">Te paso con la directiva.</p>
    </div>
  )
}

function DemoLabores() {
  return (
    <div className="grid flex-1 gap-2 sm:grid-cols-3">
      {[
        ["Programada", "Limpieza de estanque", "12-11 · Estanque principal", "from-[#0A6FB0] to-[#1E9BE0]"],
        ["En curso", "Reparar fuga en matriz", "Desde 04-11 · Sector norte", "from-[#B85A00] to-[#E58A1F]"],
        ["Finalizada", "Cloración mensual", "20 L descontados del inventario", "from-[#077A53] to-[#14A873]"],
      ].map(([e, t, d, c]) => (
        <div key={e} className="flex flex-col overflow-hidden rounded-2xl bg-[#F7F6FC]">
          <p className={`bg-gradient-to-r px-3 py-2 text-xs font-semibold text-white ${c}`}>{e}</p>
          <div className="flex flex-1 flex-col justify-between gap-3 p-3 pb-4">
            <p className="text-[17px] font-semibold leading-snug tracking-tight">{t}</p>
            <p className={`text-[13px] leading-snug ${GRIS}`}>{d}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function DemoActivos() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      {[
        ["Camioneta 4x4", "$5.450.000", 91],
        ["Estanque", "$2.600.000", 65],
      ].map(([n, v, p]) => (
        <div key={n as string}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="font-medium">{n as string}</span>
            <span className="font-semibold tabular-nums">{v as string}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#ECE9F5]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#077A53] to-[#14A873]" style={{ width: `${p}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const COMPARA: [string, string][] = [
  ["Socios que van a la oficina a preguntar cuánto deben", "Cada socio lo ve en su celular"],
  ["Deudas en un Excel que solo entiende el tesorero", "Boletas y morosidad para toda la directiva"],
  ["Lecturas en papel, traspasadas a mano", "El operador las sube en terreno"],
  ["Socios que se enteran justo antes del corte", "Revisan su cuenta y pagan en línea"],
]

const MODULOS = ["Socios", "Boletas", "Tarifas residenciales y comerciales", "Morosidad y cortes", "Compras y proveedores", "Inventario", "Reportes", "Informe para la asamblea", "RR.HH. y sueldos", "Incidentes"]

const PLANES: { nombre: string; para: string; precio: string; uf: number; previo?: string; items: string[]; destacado?: boolean; cta: string }[] = [
  {
    nombre: "Pequeño",
    para: "Hasta 200 socios",
    precio: "0,7 UF",
    uf: 0.7,
    items: ["Boletas y recibos en PDF", "Portal para cada socio", "1 operador en terreno", "Soporte por correo"],
    cta: "Pedir una demo",
  },
  {
    nombre: "Estándar",
    para: "Hasta 800 socios",
    precio: "1,5 UF",
    uf: 1.5,
    previo: "Todo lo del Pequeño, más:",
    items: ["Asistente con IA: unas 1.500 respuestas al mes", "Chat en tiempo real con tus socios", "Caja, compras, reportes e informes", "Inventario, RR.HH. y activos fijos", "3 operadores en terreno", "Te cargamos tu padrón"],
    destacado: true,
    cta: "Pedir una demo",
  },
  {
    nombre: "Grande",
    para: "Más de 800 socios o varias sedes",
    precio: "Desde 6 UF",
    uf: 6,
    previo: "Todo lo del Estándar, más:",
    items: ["Socios y operadores sin tope", "Asistente: unas 5.000 respuestas al mes", "Varias sedes o comités", "Administradores con roles", "Soporte prioritario"],
    cta: "Conversemos",
  },
]


function Formulario() {
  const [estado, accion, pendiente] = useActionState<ResultadoConsulta | null, FormData>(enviarConsulta, null)
  const origen = useRef<HTMLInputElement>(null)
  // De dónde vino la visita: solo se sabe en el navegador y en la carga inicial.
  useEffect(() => {
    if (origen.current) origen.current.value = document.referrer
  }, [])

  if (estado?.ok) {
    return <p role="status" className="py-14 text-center text-xl font-semibold tracking-tight">Recibido. Te contactamos dentro de 1 día hábil.</p>
  }
  const campo = "mt-1.5 h-12 rounded-xl border-[#E4E1F0] bg-[#F7F6FC] text-[15px] shadow-none dark:bg-[#F7F6FC]"
  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="c-nombre" className="text-sm font-medium">Nombre</label>
        <Input id="c-nombre" name="nombre" required className={campo} />
      </div>
      <div>
        <label htmlFor="c-apr" className="text-sm font-medium">APR o SSR</label>
        <Input id="c-apr" name="apr" required className={campo} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="c-contacto" className="text-sm font-medium">Email o teléfono</label>
        <Input id="c-contacto" name="contacto" required className={campo} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="c-mensaje" className="text-sm font-medium">¿Cuántos socios tienen?</label>
        <Textarea id="c-mensaje" name="mensaje" rows={3} maxLength={2000} className="mt-1.5 rounded-xl border-[#E4E1F0] bg-[#F7F6FC] text-[15px] shadow-none dark:bg-[#F7F6FC]" />
      </div>
      <input ref={origen} type="hidden" name="origenCliente" />
      {/* Trampa para bots: fuera de la vista y del foco; si viene con algo, la consulta se descarta. */}
      <div aria-hidden className="hidden">
        <label htmlFor="sitioWeb">No completar</label>
        <input id="sitioWeb" name="sitioWeb" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {estado && !estado.ok && (
        <p role="alert" className="rounded-xl bg-[#FDECEC] px-3 py-2 text-[13px] font-medium text-[#A32020] sm:col-span-2">{estado.error}</p>
      )}
      <button type="submit" disabled={pendiente} className="min-h-12 rounded-full bg-[#3A0CE3] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#2A07A8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3A0CE3] focus-visible:ring-offset-2 disabled:opacity-60 sm:col-span-2">
        {pendiente ? "Enviando…" : "Pedir una demo"}
      </button>
    </form>
  )
}

export function Landing() {
  const [menu, setMenu] = useState(false)
  const nav = [
    ["Producto", "#producto"],
    ["Precios", "#precios"],
    ["Preguntas", "#preguntas"],
  ]

  return (
    <div className="min-h-screen bg-[#F6F6FB] text-base leading-relaxed text-[#15132B] antialiased">
      <div id="inicio" className="relative overflow-hidden bg-[#0B0A1F] text-white">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_78%_35%,rgba(70,90,255,0.55),transparent_70%),radial-gradient(ellipse_50%_50%_at_10%_90%,rgba(58,12,227,0.35),transparent_70%)]" />

        <header className="fixed inset-x-0 top-3 z-50 px-4 sm:px-8">
          <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-6 rounded-full border border-white/10 bg-[#0B0A1F]/75 pl-5 pr-2 shadow-[0_8px_30px_rgba(11,10,31,0.25)] backdrop-blur-xl">
            <a href="#inicio" className="text-lg font-semibold tracking-tight">facilapr</a>
            <nav aria-label="Principal" className="hidden items-center gap-7 md:flex">
              {nav.map(([n, h]) => (
                <a key={h} href={h} className="text-sm text-white/80 transition-colors hover:text-white">{n}</a>
              ))}
              <a href="/socios" className="text-sm text-white/80 transition-colors hover:text-white">Soy socio</a>
              <a href="/login" className="text-sm text-white/80 transition-colors hover:text-white">Entrar</a>
            </nav>
            <a href="#contacto" className="hidden min-h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#15132B] transition-colors hover:bg-[#ECE8FD] md:inline-flex">Pedir una demo</a>
            <button aria-label={menu ? "Cerrar menú" : "Abrir menú"} aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="flex size-10 items-center justify-center rounded-full md:hidden">
              {menu ? <X /> : <Menu />}
            </button>
          </div>
          {menu ? (
            <nav aria-label="Móvil" className="mx-auto mt-2 flex flex-col rounded-3xl border border-white/10 bg-[#17153A] p-3 md:hidden">
              {[...nav, ["Soy socio", "/socios"], ["Entrar", "/login"], ["Pedir una demo", "#contacto"]].map(([n, h]) => (
                <a key={h} href={h} onClick={() => setMenu(false)} className="flex min-h-11 items-center px-2 font-medium">{n}</a>
              ))}
            </nav>
          ) : null}
        </header>

        <div className="relative px-4 pt-28 sm:px-8 md:pt-36"><div className="mx-auto grid max-w-[1180px] items-center gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <h1 className={`${TITULO} text-[46px] leading-[1.02] md:text-[76px]`}>Cobra el agua de tu comité sin planillas</h1>
            <p className="mt-5 max-w-[520px] text-lg leading-relaxed text-white/80 md:text-xl">
              Socios, lecturas, boletas, pagos y caja de tu APR o SSR en un solo lugar. Cada socio ve lo que debe desde su celular.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Boton href="#contacto" claro>Pedir una demo</Boton>
              <p className="text-[15px] text-white/75">Desde 0,7 UF al mes + IVA</p>
            </div>
          </div>
          <Boleta />
        </div></div>
        <Paisaje />
      </div>

      <main>
        <section className="px-4 pb-16 pt-10 sm:px-8 md:pb-24 md:pt-12">
          <div className="mx-auto max-w-[1180px]">
            <h2 className={`${TITULO} max-w-[760px] text-4xl leading-[1.08] md:text-[52px]`}>Lo que cambia en la oficina</h2>
            <div className={`mt-10 overflow-hidden rounded-[28px] bg-white ${SOMBRA}`}>
              <div className="hidden grid-cols-2 md:grid">
                <p className={`px-8 pb-2 pt-6 text-sm font-semibold ${GRIS}`}>Hoy</p>
                <p className="bg-gradient-to-r from-[#3A0CE3] to-[#4D3BEF] px-8 pb-2 pt-6 text-sm font-semibold text-white/85">Con Facilapr</p>
              </div>
              {COMPARA.map(([a, b], i) => (
                <div key={a} className="grid md:grid-cols-2">
                  <p className={`px-6 py-4 text-[17px] leading-snug md:px-8 ${GRIS} ${i > 0 ? "md:border-t md:border-[#F0EEF6]" : ""}`}>{a}</p>
                  <p className={`flex gap-2.5 bg-gradient-to-r from-[#3A0CE3] to-[#4D3BEF] px-6 py-4 text-[17px] font-medium leading-snug text-white md:px-8 ${i > 0 ? "md:border-t md:border-white/10" : ""}`}>
                    <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
                    {b}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="producto" className="scroll-mt-20 px-4 pb-16 sm:px-8 md:pb-24">
          <div className="mx-auto max-w-[1180px]">
            <h2 className={`${TITULO} max-w-[760px] text-4xl leading-[1.08] md:text-[52px]`}>Todo el comité en un panel</h2>
            <p className={`mt-3 text-lg ${GRIS}`}>Pantallas con datos de ejemplo.</p>
            <div className="mt-10 grid gap-4 lg:grid-cols-12">
              <Tile clase="lg:col-span-7" titulo="Caja" texto="Lo que entra, lo que sale y cuánto queda. Los pagos de socios entran solos.">
                <DemoCaja />
              </Tile>
              <Tile clase="lg:col-span-5" titulo="Lecturas en terreno" texto="El operador recorre la ruta con su celular y la directiva aprueba.">
                <DemoLectura />
              </Tile>
              <Tile id="asistente" clase="lg:col-span-5" titulo="Asistente con IA" texto="Responde con los datos reales de cada socio, a cualquier hora. Planes Estándar y Grande.">
                <DemoChat />
              </Tile>
              <Tile clase="lg:col-span-7" titulo="Labores" texto="Los trabajos del comité y sus materiales. Al finalizar, se descuentan del inventario.">
                <DemoLabores />
              </Tile>
              <Tile clase="lg:col-span-7" id="pagos" titulo="Pagos con Mercado Pago" texto="El socio paga desde su cuenta, la boleta se marca sola y el dinero llega a tu comité. Facilapr no cobra comisión por esto.">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F7F6FC] px-4 py-3">
                  <p className="text-sm font-medium">¿Eres socio? Busca tu comité y paga tu boleta.</p>
                  <a href="/socios" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#3A0CE3]">Encontrar mi comité <ArrowRight className="size-4" aria-hidden /></a>
                </div>
                <p className={`mt-3 text-[13px] ${GRIS}`}>En beta. Se aplican las comisiones normales de Mercado Pago.</p>
              </Tile>
              <Tile clase="lg:col-span-5" titulo="Activos fijos" texto="Qué tiene el comité, cuánto costó y cuánto vale hoy.">
                <DemoActivos />
              </Tile>
            </div>
            <ul aria-label="También incluye" className="mt-6 flex flex-wrap gap-2">
              {MODULOS.map((m) => (
                <li key={m} className={`rounded-full bg-white px-4 py-2 text-sm font-medium ${SOMBRA}`}>{m}</li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-label="Del estanque a cada casa" className="px-4 pb-16 sm:px-8 md:pb-24">
          <div className={`mx-auto max-w-[1180px] overflow-hidden rounded-[32px] bg-white ${SOMBRA}`}>
            <div className="px-6 pb-4 pt-8 md:px-10 md:pt-10">
              <h2 className={`${TITULO} text-3xl leading-[1.1] md:text-[44px]`}>Del estanque a cada casa</h2>
              <p className={`mt-2 max-w-[560px] text-lg ${GRIS}`}>Cada arranque con su lectura, su boleta y su pago, en el mismo sistema.</p>
            </div>
            <Red />
          </div>
        </section>

        <section id="precios" className="scroll-mt-20 px-4 pb-16 sm:px-8 md:pb-24">
          <div className="mx-auto max-w-[1180px]">
            <h2 className={`${TITULO} text-4xl leading-[1.08] md:text-[52px]`}>Precios según tus socios</h2>
            <p className={`mt-3 text-lg ${GRIS}`}>Sin permanencia pagando por mes. Plan anual: 1 mes gratis.</p>
            <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-3">
              {PLANES.map((p) => (
                <article
                  key={p.nombre}
                  className={`relative flex flex-col overflow-hidden rounded-[28px] p-7 transition-transform duration-200 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                    p.destacado ? "bg-[#0B0A1F] text-white shadow-[0_24px_60px_rgba(58,12,227,0.35)]" : `bg-white ${SOMBRA}`
                  }`}
                >
                  {p.destacado ? <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_80%_0%,rgba(70,90,255,0.55),transparent_70%)]" /> : null}
                  <div className="relative flex flex-1 flex-col">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-semibold tracking-tight">{p.nombre}</h3>
                      {p.destacado ? <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">Más elegido</span> : null}
                    </div>
                    <p className={`text-[15px] ${p.destacado ? "text-white/80" : GRIS}`}>{p.para}</p>
                    <p className="mt-6 text-[44px] font-semibold leading-none tracking-[-0.04em]">
                      {p.precio}
                      <span className={`ml-1.5 text-base font-normal tracking-normal ${p.destacado ? "text-white/80" : GRIS}`}>/mes</span>
                    </p>
                    <p className={`mt-2 text-sm ${p.destacado ? "text-white/80" : GRIS}`}>Unos {aproxUF(p.uf)} + IVA</p>
                    <a
                      href="#contacto"
                      className={`mt-6 inline-flex min-h-12 items-center justify-center rounded-full text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9D85FF] focus-visible:ring-offset-2 ${
                        p.destacado ? "bg-white text-[#15132B] hover:bg-[#ECE8FD]" : "bg-[#F1EEFD] text-[#2A07A8] hover:bg-[#E4DFFC]"
                      }`}
                    >
                      {p.cta}
                    </a>
                    <div className={`mt-6 border-t pt-5 ${p.destacado ? "border-white/15" : "border-[#ECE9F5]"}`}>
                      {p.previo ? <p className="mb-3 text-sm font-semibold">{p.previo}</p> : null}
                      <ul className="flex flex-col gap-2.5">
                        {p.items.map((i) => (
                          <li key={i} className={`flex gap-2.5 text-[15px] leading-snug ${p.destacado ? "text-white/90" : "text-[#3B394F]"}`}>
                            <Check className={`mt-0.5 size-[18px] shrink-0 ${p.destacado ? "text-[#8DF0C4]" : "text-[#3A0CE3]"}`} aria-hidden />
                            {i}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <p className={`mt-4 text-sm ${GRIS}`}>Pesos aproximados, según la UF del mes.</p>
          </div>
        </section>

        <section id="preguntas" className="scroll-mt-20 px-4 pb-16 sm:px-8 md:pb-24">
          <div className="mx-auto grid max-w-[1180px] gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div>
              <h2 className={`${TITULO} text-4xl leading-[1.08] md:text-[52px]`}>Preguntas frecuentes</h2>
              <Medidor />
            </div>
            <div className="flex flex-col gap-2">
              {PREGUNTAS.map(({ pregunta: p, respuesta: r }, i) => (
                <details key={p} open={i === 0} className={`group rounded-2xl bg-white px-5 ${SOMBRA}`}>
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                    {p}
                    <ChevronDown className="size-5 shrink-0 text-[#3A0CE3] transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className={`pb-4 text-[15px] ${GRIS}`}>{r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contacto" className="scroll-mt-20 px-4 pb-16 sm:px-8 md:pb-24">
          <div className="relative mx-auto grid max-w-[1180px] items-center gap-10 overflow-hidden rounded-[36px] bg-[#0B0A1F] p-6 text-white md:p-12 lg:grid-cols-2">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_15%_20%,rgba(70,90,255,0.5),transparent_70%)]" />
            <div className="relative">
              <h2 className={`${TITULO} text-4xl leading-[1.08] md:text-[52px]`}>Veamos tu comité</h2>
              <p className="mt-3 text-lg text-white/80">Te respondemos dentro de 1 día hábil.</p>
              <div className="mt-6 flex flex-col gap-2">
                <a href="https://wa.me/56942506724" target="_blank" rel="noopener noreferrer" className="w-fit rounded-full bg-white/10 px-4 py-2 text-[15px] font-medium transition-colors hover:bg-white/20">WhatsApp +56 9 4250 6724</a>
              </div>
            </div>
            <div className="relative rounded-[24px] bg-white p-5 text-[#15132B] md:p-6">
              <Formulario />
            </div>
          </div>
        </section>
      </main>

      <footer className="px-4 pb-8 sm:px-8">
        <div className="mx-auto max-w-[1180px]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-lg font-semibold tracking-tight">facilapr</p>
            <nav aria-label="Pie de página" className={`flex flex-wrap gap-x-5 gap-y-1 text-sm ${GRIS}`}>
              {[
                ["Centro de ayuda", "/ayuda"],
                ["Cómo calcular la tarifa", "/ayuda/como-calcular-tarifa-agua-apr"],
                ["Cortes por morosidad", "/ayuda/cortes-por-morosidad-apr"],
                ["Soy socio: paga tu boleta", "/socios"],
                ["Planilla gratis en Excel", "/planilla-cobro-agua-potable-rural"],
                ["Términos de uso", "/terminos"],
                ["Privacidad", "/privacidad"],
              ].map(([n, h]) => (
                <a key={h} href={h} className="hover:text-[#3A0CE3]">{n}</a>
              ))}
            </nav>
          </div>
          <p className={`mt-4 text-[13px] ${GRIS}`}>© 2026 Facilapr. {RAZON_SOCIAL}, RUT 78.324.975-8. Padre Las Casas, Región de La Araucanía, Chile.</p>
        </div>
      </footer>
    </div>
  )
}
