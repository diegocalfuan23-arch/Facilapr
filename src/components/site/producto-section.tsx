import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Red } from "@/components/site/ilustraciones";

const TITULO = "font-semibold tracking-[-0.035em] [text-wrap:balance]";
const GRIS = "text-[#5B5970]";
const SOMBRA = "shadow-[0_1px_2px_rgba(21,19,43,0.04),0_16px_40px_rgba(58,12,227,0.08)]";

const MODULOS = [
  "Socios",
  "Boletas",
  "Tarifas residenciales y comerciales",
  "Morosidad y cortes",
  "Compras y proveedores",
  "Inventario",
  "Reportes",
  "Informe para la asamblea",
  "RR.HH. y sueldos",
  "Incidentes",
];

function Tile({ titulo, texto, clase = "", children, id }: { titulo: string; texto: string; clase?: string; children: ReactNode; id?: string }) {
  return (
    <article
      id={id}
      className={`group flex scroll-mt-24 flex-col overflow-hidden rounded-[28px] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(21,19,43,0.04),0_24px_50px_rgba(58,12,227,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${SOMBRA} ${clase}`}
    >
      <div className="p-6 pb-4">
        <h3 className="text-xl font-semibold tracking-tight">{titulo}</h3>
        <p className={`mt-1 text-[15px] leading-relaxed ${GRIS}`}>{texto}</p>
      </div>
      <div className="flex flex-1 flex-col justify-end px-6 pb-6">{children}</div>
    </article>
  );
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
          <div key={l} className={`min-w-0 rounded-xl bg-white p-3 ${l === "Disponible" ? "col-span-2 sm:col-span-1" : ""}`}>
            <p className={`text-[11px] font-medium ${GRIS}`}>{l}</p>
            <p className={`truncate text-[15px] font-semibold tracking-tight tabular-nums sm:text-[17px] ${c}`}>{v}</p>
          </div>
        ))}
      </div>
      {[
        ["Compra de cloro", "-$83.300"],
        ["Reparación de bomba", "-$70.000"],
      ].map(([d, m]) => (
        <div key={d} className="mt-2 flex justify-between gap-4 rounded-xl bg-white px-3 py-3 text-sm">
          <span className="truncate font-medium">{d}</span>
          <span className="shrink-0 font-semibold text-[#A32020] tabular-nums">{m}</span>
        </div>
      ))}
    </div>
  );
}

function DemoLectura() {
  return (
    <div className="flex flex-1 flex-col justify-center rounded-2xl bg-slate-900 p-6 text-center text-white">
      <p className="text-xs text-white/80">Lectura del medidor · Socio N.° 148</p>
      <p className="mt-1 text-5xl font-semibold tracking-[0.06em] tabular-nums">1250</p>
      <p className="mt-2 text-sm font-medium text-[#8DF0C4]">Consumo 14 m³</p>
    </div>
  );
}

function DemoChat() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-[#F1F0F7] px-4 py-2">¿Cuánto debo este mes?</p>
      <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[#3A0CE3] px-4 py-2 text-white">Tienes 1 boleta pendiente por $8.400. Vence el día 10.</p>
      <p className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-[#F1F0F7] px-4 py-2">¿Y si tengo una filtración?</p>
      <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[#ECE8FD] px-4 py-2">Te paso con la directiva.</p>
    </div>
  );
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
          <div className="flex flex-1 flex-col justify-between gap-4 p-3 pb-4">
            <p className="text-[17px] leading-snug font-semibold tracking-tight">{t}</p>
            <p className={`text-[13px] leading-snug ${GRIS}`}>{d}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DemoActivos() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      {[
        ["Camioneta 4x4", "$5.450.000", 91],
        ["Estanque", "$2.600.000", 65],
      ].map(([n, v, p]) => (
        <div key={n as string}>
          <div className="flex justify-between gap-4 text-sm">
            <span className="font-medium">{n as string}</span>
            <span className="font-semibold tabular-nums">{v as string}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ECE9F5]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#077A53] to-[#14A873]" style={{ width: `${p}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** El panel de la directiva, mostrado con pantallas de ejemplo, y la ilustración de la red hasta cada casa. */
export function ProductoSection() {
  return (
    <>
      <section id="panel" className="scroll-mt-20 px-4 pb-16 sm:px-8 md:pb-24">
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
            <Tile clase="lg:col-span-7" id="pagos-en-linea" titulo="Pagos con Mercado Pago" texto="El socio paga desde su cuenta, la boleta se marca sola y el dinero llega a tu comité. Facilapr no cobra comisión por esto.">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#F7F6FC] px-4 py-3">
                <p className="text-sm font-medium">¿Eres socio? Busca tu comité y paga tu boleta.</p>
                <Link href="/socios" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#3A0CE3]">
                  Encontrar mi comité <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
              <p className={`mt-3 text-[13px] ${GRIS}`}>En beta. Se aplican las comisiones normales de Mercado Pago.</p>
            </Tile>
            <Tile clase="lg:col-span-5" titulo="Activos fijos" texto="Qué tiene el comité, cuánto costó y cuánto vale hoy.">
              <DemoActivos />
            </Tile>
          </div>
          <ul aria-label="También incluye" className="mt-6 flex flex-wrap gap-2">
            {MODULOS.map((m) => (
              <li key={m} className={`rounded-full bg-white px-4 py-2 text-sm font-medium ${SOMBRA}`}>
                {m}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Del estanque a cada casa" className="px-4 pb-16 sm:px-8 md:pb-24">
        <div className={`mx-auto max-w-[1180px] overflow-hidden rounded-[32px] bg-white ${SOMBRA}`}>
          <div className="px-6 pt-8 pb-4 md:px-10 md:pt-10">
            <h2 className={`${TITULO} text-3xl leading-[1.1] md:text-[44px]`}>Del estanque a cada casa</h2>
            <p className={`mt-2 max-w-[560px] text-lg ${GRIS}`}>Cada arranque con su lectura, su boleta y su pago, en el mismo sistema.</p>
          </div>
          <Red />
        </div>
      </section>
    </>
  );
}
