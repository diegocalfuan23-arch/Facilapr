import Link from "next/link";
import { saldo, formatearPeriodo } from "@/lib/boletas";
import { textoMedioPago } from "@/lib/pagos";
import type { PagoPortal } from "@/lib/portal-socio-datos";
import { BotonPagarMp } from "@/components/socio/boton-pagar-mp";

/** Piezas que comparten las pantallas del portal del socio (resumen, boletas, pagos). */

export const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export const fecha = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "long",
});

const fechaConAnio = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const ESTADO_ESTILO = {
  PENDIENTE: "bg-tertiary/15 text-tertiary-foreground",
  PAGADA: "bg-forest/15 text-forest",
  VENCIDA: "bg-destructive/15 text-destructive",
  ANULADA: "bg-muted text-muted-foreground",
} as const;

const ESTADO_TEXTO = {
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  VENCIDA: "Vencida",
  ANULADA: "Anulada",
} as const;

export type BoletaPortal = {
  id: string;
  periodo: string;
  montoTotal: number;
  montoPagado: number;
  estado: keyof typeof ESTADO_TEXTO;
  fechaVencimiento: Date;
  consumoM3: number | null;
  socio: { nombre: string };
};

export const estaPorPagar = (b: BoletaPortal) =>
  b.estado === "PENDIENTE" || b.estado === "VENCIDA";

export function TituloPantalla({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-[1.5rem] font-semibold tracking-tight">{titulo}</h1>
      {descripcion && (
        <p className="mt-1 text-[0.9rem] text-muted-foreground">{descripcion}</p>
      )}
    </div>
  );
}

export function SinDatos({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[0.9rem] text-muted-foreground">
      {children}
    </p>
  );
}

export function ListaBoletas({
  boletas,
  base,
  variasCuentas,
  pagoEnLinea,
}: {
  boletas: BoletaPortal[];
  base: string;
  variasCuentas: boolean;
  /** Si el comité cobra con Mercado Pago: cada boleta por pagar trae su botón. */
  pagoEnLinea?: { slug: string };
}) {
  return (
    <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
      {boletas.map((b) => (
        <div key={b.id} className="flex items-center justify-between gap-3 p-4">
          <div>
            <div className="font-medium">
              {formatearPeriodo(b.periodo)}
              {variasCuentas && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {b.socio.nombre}
                </span>
              )}
            </div>
            <div className="text-[0.82rem] text-muted-foreground">
              Vence el {fecha.format(b.fechaVencimiento)}
              {b.consumoM3 !== null && ` · ${b.consumoM3} m³`}
            </div>
            {b.estado !== "ANULADA" &&
              b.montoPagado > 0 &&
              b.montoPagado < b.montoTotal && (
                <div className="text-[0.82rem] text-forest">
                  Abonaste {clp.format(b.montoPagado)} · te quedan{" "}
                  {clp.format(saldo(b.montoTotal, b.montoPagado))}
                </div>
              )}
            {b.estado !== "ANULADA" && (
              <Link
                href={`${base}/recibo/${b.id}`}
                className="text-[0.82rem] font-medium text-primary hover:underline"
              >
                Ver recibo
              </Link>
            )}
            {pagoEnLinea && estaPorPagar(b) && saldo(b.montoTotal, b.montoPagado) > 0 && (
              <BotonPagarMp slug={pagoEnLinea.slug} boletaId={b.id} />
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.95rem] font-semibold tabular-nums">
              {clp.format(b.montoTotal)}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${ESTADO_ESTILO[b.estado]}`}
            >
              {ESTADO_TEXTO[b.estado]}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListaPagos({
  pagos,
  variasCuentas,
}: {
  pagos: PagoPortal[];
  variasCuentas: boolean;
}) {
  return (
    <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
      {pagos.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="font-medium">
              Pago de {formatearPeriodo(p.periodo)}
              {variasCuentas && (
                <span className="font-normal text-muted-foreground"> · {p.socioNombre}</span>
              )}
            </div>
            <div className="text-[0.82rem] text-muted-foreground">
              {fechaConAnio.format(p.fecha)} · {textoMedioPago(p.medio)}
              {p.pagadoPor ? ` · pagó ${p.pagadoPor}` : ""}
              {p.referencia ? ` · ${p.referencia}` : ""}
            </div>
            <a
              href={p.comprobanteUrl}
              target="_blank"
              rel="noopener"
              className="text-[0.82rem] font-medium text-primary hover:underline"
            >
              Ver comprobante
            </a>
          </div>
          <span className="font-mono text-[0.95rem] font-semibold text-forest tabular-nums">
            {clp.format(p.monto)}
          </span>
        </div>
      ))}
    </div>
  );
}
