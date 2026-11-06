import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { bolsillosAl, diaVecino, hoyEnChile, listarCategoriasMovimiento, netoEntre, nombreMes, saldoInicialDe, textoCategoria } from "@/lib/finanzas";
import { listarCompras } from "@/lib/compras";
import { resumenAnual } from "@/lib/reportes";
import { ReportesVista, type CuadreReporte } from "@/components/panel/reportes-vista";
import { DescargarCsvBoton } from "@/components/panel/descargar-csv-boton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Reportes",
};

/**
 * Reportes de Finanzas: solo plata. Lo que entró y salió en el año, de dónde vino y a dónde fue,
 * si la plata cuadra con la Caja y lo que se debe a proveedores. El inventario tiene su propia pantalla.
 */
export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const { apr } = await requireFinanzas();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "finanzas")) redirect("/panel");

  const hoy = hoyEnChile();
  const anioActual = Number(hoy.slice(0, 4));
  const pedido = Number((await searchParams).anio);
  const anio = Number.isInteger(pedido) && pedido >= 2000 && pedido <= anioActual + 1 ? pedido : anioActual;

  // El cuadre se mira al cierre de hoy: lo que debería haber (saldo inicial más lo que entró y salió) contra lo que hay (efectivo y banco).
  const manana = diaVecino(hoy, 1);
  const [resumen, propias, compras, base] = await Promise.all([
    resumenAnual(apr.id, anio),
    listarCategoriasMovimiento(apr.id),
    listarCompras(apr.id),
    saldoInicialDe(apr.id),
  ]);

  let cuadre: CuadreReporte | null = null;
  if (base && base.fecha <= hoy) {
    const [neto, bolsillos] = await Promise.all([netoEntre(apr.id, base.fecha, manana), bolsillosAl(apr.id, manana).catch(() => null)]);
    if (bolsillos) {
      cuadre = {
        saldoInicial: base.monto,
        ingresos: neto.ingresos,
        egresos: neto.egresos,
        real: bolsillos.efectivo + bolsillos.banco,
        efectivo: bolsillos.efectivo,
        banco: bolsillos.banco,
        desde: base.fecha,
      };
    }
  }

  const resultado = resumen.totalIngresos - resumen.totalEgresos;

  // Lo que se debe: las compras por pagar, las que vencen antes primero.
  const porPagar = compras
    .filter((c) => c.estado === "PENDIENTE")
    .sort((a, b) => (a.vencimiento ?? "9999-12-31").localeCompare(b.vencimiento ?? "9999-12-31"));
  const totalPorPagar = porPagar.reduce((s, c) => s + c.total, 0);
  const vencidas = porPagar.filter((c) => c.vencimiento && c.vencimiento < hoy).length;

  // Lo comprado en el año, por proveedor.
  const porProveedor = new Map<string, number>();
  let comprasAnio = 0;
  let sinProveedor = 0;
  for (const c of compras) {
    if (c.estado === "ANULADA" || !c.fecha.startsWith(String(anio))) continue;
    const clave = c.proveedor ?? "Sin proveedor";
    porProveedor.set(clave, (porProveedor.get(clave) ?? 0) + c.total);
    comprasAnio += c.total;
    if (!c.proveedor) sinProveedor += c.total;
  }
  const comprasPorProveedor = [...porProveedor.entries()]
    .map(([clave, monto]) => ({ clave, nombre: clave, monto }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 8);

  const planilla = [
    ["mes", "ingresos", "egresos", "resultado"],
    ...resumen.meses.map((m) => [m.mes, m.ingresos, m.egresos, m.ingresos - m.egresos]),
    ["total", resumen.totalIngresos, resumen.totalEgresos, resultado],
  ];

  const botonAnio = "flex size-9 items-center justify-center rounded-full hover:bg-muted";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-tight">Reportes</h1>
          <p className="mt-0.5 text-[0.9rem] text-muted-foreground">Cuánto entró, cuánto salió y si la plata cuadra.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-border bg-card p-1">
            <Link href={`/panel/reportes?anio=${anio - 1}`} aria-label="Año anterior" className={botonAnio}>
              <ChevronLeft className="size-4" />
            </Link>
            <span className="px-2 text-[0.95rem] font-bold tabular-nums">{anio}</span>
            {anio < anioActual + 1 ? (
              <Link href={`/panel/reportes?anio=${anio + 1}`} aria-label="Año siguiente" className={botonAnio}>
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span className={cn(botonAnio, "text-muted-foreground/40 hover:bg-transparent")}>
                <ChevronRight className="size-4" />
              </span>
            )}
          </div>
          <DescargarCsvBoton nombreArchivo={`reporte-${anio}.csv`} filas={planilla} />
        </div>
      </div>

      <ReportesVista
        key={anio}
        anio={anio}
        meses={resumen.meses.map((m) => ({
          mes: m.mes,
          nombre: nombreMes(m.mes).replace(/\s+\d{4}$/, ""),
          corto: nombreMes(m.mes).slice(0, 3).toLowerCase(),
          ingresos: m.ingresos,
          egresos: m.egresos,
        }))}
        origen={resumen.ingresos.map((c) => ({ clave: c.categoria, nombre: textoCategoria(c.categoria, propias), monto: c.total }))}
        destino={resumen.egresos.map((c) => ({ clave: c.categoria, nombre: textoCategoria(c.categoria, propias), monto: c.total }))}
        cuadre={cuadre}
        proveedores={{
          totalPorPagar,
          nPorPagar: porPagar.length,
          vencidas,
          comprasAnio,
          sinProveedor,
          lista: porPagar.slice(0, 4).map((c) => ({
            id: c.id,
            numero: c.numero,
            proveedor: c.proveedor ?? "Sin proveedor",
            vence: c.vencimiento,
            vencida: c.vencimiento !== null && c.vencimiento < hoy,
            total: c.total,
          })),
        }}
        comprasPorProveedor={comprasPorProveedor}
      />
    </div>
  );
}
