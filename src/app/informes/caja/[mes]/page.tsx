import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { formatearRut } from "@/lib/formato";
import {
  libroDelMes,
  listarCategoriasMovimiento,
  mesVecino,
  nombreMes,
  resumenPeriodo,
  resumir,
  textoMedioLinea,
  type LineaLibro,
} from "@/lib/finanzas";
import { ImprimirBoton } from "@/components/recibos/imprimir-boton";

type Props = { params: Promise<{ mes: string }> };

export const metadata: Metadata = {
  title: "Informe de caja",
  robots: { index: false, follow: false },
};

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const fechaLarga = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago" });

const th = "px-2 py-1.5 text-left text-[0.72rem] font-semibold tracking-wide text-neutral-600 uppercase";
const td = "px-2 py-1.5 align-top";

/** Una tabla corta con un título y el total abajo. */
function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-2 text-[0.8rem] font-semibold tracking-wide text-neutral-700 uppercase">{titulo}</h2>
      {children}
    </section>
  );
}

/** Detalle línea por línea, de la fecha más antigua a la más nueva. */
function Detalle({ lineas, contraparte }: { lineas: LineaLibro[]; contraparte: string }) {
  const orden = [...lineas].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const total = orden.reduce((s, l) => s + l.monto, 0);
  return (
    <table className="w-full border-collapse text-[0.82rem]">
      <thead>
        <tr className="border-b border-neutral-400">
          <th className={th}>Fecha</th>
          <th className={th}>Descripción</th>
          <th className={th}>{contraparte}</th>
          <th className={th}>N.° doc.</th>
          <th className={`${th} text-right`}>Monto</th>
        </tr>
      </thead>
      <tbody>
        {orden.map((l) => (
          <tr key={l.id} className="border-b border-neutral-200">
            <td className={`${td} whitespace-nowrap tabular-nums`}>{fechaCorta(l.fecha).slice(0, 5)}</td>
            <td className={td}>
              {l.concepto}
              <span className="text-neutral-500"> · {textoMedioLinea(l.medio)}</span>
            </td>
            <td className={td}>{l.contraparte ?? "—"}</td>
            <td className={td}>{l.referencia ?? "—"}</td>
            <td className={`${td} text-right whitespace-nowrap tabular-nums`}>{clp.format(l.monto)}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={4} className={`${td} text-right font-semibold`}>
            Total
          </td>
          <td className={`${td} text-right font-semibold whitespace-nowrap tabular-nums`}>{clp.format(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * Informe de caja de un mes para presentar en la asamblea: con cuánta plata se empezó,
 * de dónde vino y a dónde fue, el detalle de lo gastado y el espacio para las firmas.
 * Sale en blanco y negro a propósito, como los recibos. Es un registro de ingresos y
 * egresos del comité; no reemplaza la contabilidad ni es un documento del SII.
 */
export default async function InformeCajaPage({ params }: Props) {
  const { mes } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) notFound();

  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) redirect("/panel/caja");

  const lineas = await libroDelMes(apr.id, mes);
  const resumen = await resumenPeriodo(apr.id, `${mes}-01`, `${mesVecino(mes, 1)}-01`, lineas);
  const { porCategoria } = resumir(lineas, await listarCategoriasMovimiento(apr.id));

  const ingresos = porCategoria.filter((c) => c.tipo === "INGRESO");
  const egresos = porCategoria.filter((c) => c.tipo === "EGRESO");
  const egresosDetalle = lineas.filter((l) => l.tipo === "EGRESO");
  const ingresosManuales = lineas.filter((l) => l.tipo === "INGRESO" && !l.automatico);
  const cuantos = (cat: string) => lineas.filter((l) => l.tipo === "INGRESO" && l.categoria === cat).length;

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-8 print:max-w-none print:p-0">
      <style>{`@page { size: A4; margin: 14mm; }`}</style>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href={`/panel/caja?vista=mes&mes=${mes}`} className="text-[0.9rem] text-muted-foreground hover:underline">
            ← Volver a Caja
          </Link>
          <div className="mt-2 flex items-center gap-2 text-[0.9rem]">
            <Link href={`/informes/caja/${mesVecino(mes, -1)}`} className="rounded-lg border border-border px-3 py-1 hover:bg-muted">
              ← Mes anterior
            </Link>
            <Link href={`/informes/caja/${mesVecino(mes, 1)}`} className="rounded-lg border border-border px-3 py-1 hover:bg-muted">
              Mes siguiente →
            </Link>
          </div>
        </div>
        <ImprimirBoton etiqueta="Imprimir o guardar PDF" />
      </div>

      <article className="flex flex-col gap-6 rounded-md border border-neutral-400 bg-white p-8 text-[0.9rem] leading-snug text-neutral-900 print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6 border-b border-neutral-400 pb-4">
          <div className="flex items-start gap-4">
            {apr.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={apr.logoUrl} alt="" className="size-16 shrink-0 object-contain object-left-top" />
            )}
            <div>
              <div className="text-[1.15rem] leading-tight font-bold">{apr.nombre}</div>
              {apr.razonSocial && <div className="text-neutral-600">{apr.razonSocial}</div>}
              <div className="text-neutral-600">
                {[apr.rut ? `RUT ${formatearRut(apr.rut)}` : null, apr.comuna].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[0.72rem] font-semibold tracking-widest text-neutral-600 uppercase">Informe de caja</div>
            <div className="text-[1.15rem] font-bold capitalize">{nombreMes(mes)}</div>
            <div className="text-neutral-600">Emitido el {fechaLarga.format(new Date())}</div>
          </div>
        </header>

        <Bloque titulo="Resumen del mes">
          <table className="w-full max-w-md border-collapse text-[0.92rem]">
            <tbody>
              {resumen.disponibleAnterior !== null && (
                <tr className="border-b border-neutral-200">
                  <td className="py-1.5">Saldo al inicio del mes</td>
                  <td className="py-1.5 text-right tabular-nums">{clp.format(resumen.disponibleAnterior)}</td>
                </tr>
              )}
              <tr className="border-b border-neutral-200">
                <td className="py-1.5">Ingresos</td>
                <td className="py-1.5 text-right tabular-nums">+ {clp.format(resumen.ingresos)}</td>
              </tr>
              <tr className="border-b border-neutral-200">
                <td className="py-1.5">Egresos</td>
                <td className="py-1.5 text-right tabular-nums">− {clp.format(resumen.egresos)}</td>
              </tr>
              {resumen.disponible !== null ? (
                <tr className="border-t border-neutral-500 text-[1rem] font-bold">
                  <td className="pt-2">Saldo al cierre del mes</td>
                  <td className="pt-2 text-right tabular-nums">{clp.format(resumen.disponible)}</td>
                </tr>
              ) : (
                <tr className="border-t border-neutral-500 font-bold">
                  <td className="pt-2">Resultado del mes (ingresos − egresos)</td>
                  <td className="pt-2 text-right tabular-nums">{clp.format(resumen.ingresos - resumen.egresos)}</td>
                </tr>
              )}
            </tbody>
          </table>
          {resumen.disponible === null && (
            <p className="mt-2 text-[0.78rem] text-neutral-500">
              No hay saldo inicial definido para este período, por eso no se muestra el saldo.
            </p>
          )}
        </Bloque>

        <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          <Bloque titulo="De dónde vino la plata">
            {ingresos.length === 0 ? (
              <p className="text-neutral-500">Sin ingresos este mes.</p>
            ) : (
              <table className="w-full border-collapse text-[0.85rem]">
                <tbody>
                  {ingresos.map((c) => (
                    <tr key={c.categoria} className="border-b border-neutral-200">
                      <td className="py-1.5">
                        {c.texto}
                        {(c.categoria === "BOLETAS" || c.categoria === "COBROS") && (
                          <span className="text-neutral-500"> ({cuantos(c.categoria)} pagos)</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{clp.format(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Bloque>

          <Bloque titulo="A dónde fue la plata">
            {egresos.length === 0 ? (
              <p className="text-neutral-500">Sin egresos este mes.</p>
            ) : (
              <table className="w-full border-collapse text-[0.85rem]">
                <tbody>
                  {egresos.map((c) => (
                    <tr key={c.categoria} className="border-b border-neutral-200">
                      <td className="py-1.5">{c.texto}</td>
                      <td className="py-1.5 text-right tabular-nums">{clp.format(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Bloque>
        </div>

        {egresosDetalle.length > 0 && (
          <Bloque titulo="Detalle de egresos">
            <Detalle lineas={egresosDetalle} contraparte="Proveedor" />
          </Bloque>
        )}

        {ingresosManuales.length > 0 && (
          <Bloque titulo="Otros ingresos (subsidios, aportes y otros)">
            <Detalle lineas={ingresosManuales} contraparte="De quién" />
          </Bloque>
        )}

        <div className="mt-8 grid grid-cols-2 gap-16 break-inside-avoid pt-10">
          {["Presidente(a)", "Tesorero(a)"].map((cargo) => (
            <div key={cargo} className="border-t border-neutral-500 pt-2 text-center text-[0.82rem] text-neutral-600">
              {cargo}
            </div>
          ))}
        </div>

        <footer className="border-t border-neutral-300 pt-3 text-[0.75rem] text-neutral-500">
          Registro de ingresos y egresos del comité, generado con Facilapr. No reemplaza la contabilidad ni es un documento
          tributario del SII.
        </footer>
      </article>
    </div>
  );
}
