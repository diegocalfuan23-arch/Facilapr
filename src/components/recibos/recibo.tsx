import { formatearPeriodo, saldo } from "@/lib/boletas";
import { formatearRut } from "@/lib/formato";
import type { ReciboDatos } from "@/lib/recibo";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const fecha = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const ESTADO_TEXTO = {
  PENDIENTE: "Pendiente de pago",
  PAGADA: "Pagada",
  VENCIDA: "Vencida",
  ANULADA: "Anulada",
} as const;

/**
 * Recibo de agua: el comprobante de cobro del comité, pensado para imprimir
 * (varios por hoja) o guardar como PDF. Es blanco y negro a propósito: sale
 * bien en cualquier impresora y no gasta tinta.
 */
export function Recibo({ r }: { r: ReciboDatos }) {
  const conLecturas = r.lecturaAnterior !== null && r.lecturaActual !== null;
  const conDesglose =
    conLecturas &&
    r.consumoM3 !== null &&
    r.cargoFijo !== null &&
    r.valorM3 !== null;
  const porPagar = saldo(r.montoTotal, r.montoPagado);

  return (
    <article className="break-inside-avoid rounded-md border border-neutral-400 bg-white p-5 text-[0.82rem] leading-snug text-neutral-900 print:rounded-none print:border-neutral-700">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-300 pb-3">
        <div className="min-w-0">
          <div className="text-[1rem] leading-tight font-bold">
            {r.comite.nombre}
          </div>
          {r.comite.razonSocial && (
            <div className="text-neutral-600">{r.comite.razonSocial}</div>
          )}
          <div className="text-neutral-600">
            {[
              r.comite.rut ? `RUT ${formatearRut(r.comite.rut)}` : null,
              r.comite.telefono,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div className="text-neutral-600">
            {[r.comite.direccion, r.comite.comuna].filter(Boolean).join(", ")}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[0.7rem] font-semibold tracking-widest text-neutral-600 uppercase">
            Recibo de agua
          </div>
          <div className="text-[1rem] font-bold">{formatearPeriodo(r.periodo)}</div>
          <div className="text-neutral-600">Emitido {fecha.format(r.fechaEmision)}</div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-x-4 gap-y-0.5 border-b border-neutral-300 py-3">
        <div>
          <span className="text-neutral-600">Socio: </span>
          <strong>{r.socio.nombre}</strong>
        </div>
        {r.socio.rut && (
          <div>
            <span className="text-neutral-600">RUT: </span>
            {formatearRut(r.socio.rut)}
          </div>
        )}
        {r.socio.numeroCliente && (
          <div>
            <span className="text-neutral-600">N.º cliente: </span>
            {r.socio.numeroCliente}
          </div>
        )}
        {r.socio.direccion && (
          <div>
            <span className="text-neutral-600">Dirección: </span>
            {r.socio.direccion}
          </div>
        )}
      </section>

      <section className="py-3">
        {conLecturas && (
          <div className="mb-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded border border-neutral-300 py-1.5">
              <div className="text-[0.7rem] text-neutral-600">Lectura anterior</div>
              <div className="font-semibold tabular-nums">{r.lecturaAnterior}</div>
            </div>
            <div className="rounded border border-neutral-300 py-1.5">
              <div className="text-[0.7rem] text-neutral-600">Lectura actual</div>
              <div className="font-semibold tabular-nums">{r.lecturaActual}</div>
            </div>
            <div className="rounded border border-neutral-300 py-1.5">
              <div className="text-[0.7rem] text-neutral-600">Consumo</div>
              <div className="font-semibold tabular-nums">{r.consumoM3} m³</div>
            </div>
          </div>
        )}

        <table className="w-full tabular-nums">
          <tbody>
            {conDesglose && (
              <>
                <tr>
                  <td className="py-0.5">Cargo fijo</td>
                  <td className="py-0.5 text-right">{clp.format(r.cargoFijo!)}</td>
                </tr>
                <tr>
                  <td className="py-0.5">
                    Consumo {r.consumoM3} m³ × {clp.format(r.valorM3!)}
                  </td>
                  <td className="py-0.5 text-right">
                    {clp.format(r.consumoM3! * r.valorM3!)}
                  </td>
                </tr>
              </>
            )}
            <tr className="border-t border-neutral-400 text-[0.95rem] font-bold">
              <td className="pt-1.5">Total</td>
              <td className="pt-1.5 text-right">{clp.format(r.montoTotal)}</td>
            </tr>
            {r.montoPagado > 0 && (
              <tr>
                <td className="py-0.5">Pagado</td>
                <td className="py-0.5 text-right">{clp.format(r.montoPagado)}</td>
              </tr>
            )}
            {r.montoPagado > 0 && porPagar > 0 && (
              <tr className="font-semibold">
                <td className="py-0.5">Saldo por pagar</td>
                <td className="py-0.5 text-right">{clp.format(porPagar)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <footer className="flex items-end justify-between gap-4 border-t border-neutral-300 pt-3">
        <div className="min-w-0 text-neutral-700">
          <div>
            Vence el <strong>{fecha.format(r.fechaVencimiento)}</strong>
          </div>
          {r.comite.infoPago && <div className="mt-0.5">{r.comite.infoPago}</div>}
        </div>
        <div className="shrink-0 rounded border border-neutral-700 px-2.5 py-1 text-[0.75rem] font-bold tracking-wide uppercase">
          {ESTADO_TEXTO[r.estado]}
        </div>
      </footer>

      {r.portal && (
        <div className="mt-3 flex items-center gap-3 border-t border-neutral-300 pt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.portal.qr} alt="Código QR a tu cuenta en línea" className="size-16 shrink-0" />
          <div className="text-neutral-700">
            <div className="font-semibold">Tu cuenta en línea</div>
            <div>Escanea el código para ver tus boletas y escribirle al comité.</div>
            <div className="text-[0.72rem] text-neutral-500">{r.portal.corta}</div>
          </div>
        </div>
      )}
    </article>
  );
}
