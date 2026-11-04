import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/apr-session";
import { NOMBRE_PLAN, planMinimoPara, puede, type Plan } from "@/lib/planes";
import { hoyEnChile, listarCategoriasMovimiento, nombreMes, textoCategoria } from "@/lib/finanzas";
import { listarCompras } from "@/lib/compras";
import { estaBajo, formatoCantidad, listarInsumos, unidadCorta } from "@/lib/inventario";
import { resumenAnual } from "@/lib/reportes";
import { GraficoMeses } from "@/components/panel/grafico-meses";
import { DescargarCsvBoton } from "@/components/panel/descargar-csv-boton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Reportes",
};

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");

const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";
const tarjeta = "rounded-xl border border-border bg-card p-5 sm:p-6";
const tituloTarjeta = "text-[0.8rem] font-medium tracking-wide text-muted-foreground uppercase";

/** Una lista de «nombre … monto», para los totales por categoría o por proveedor. */
function ListaTotales({ filas, vacio }: { filas: { clave: string; texto: string; total: number }[]; vacio: string }) {
  if (filas.length === 0) return <p className="mt-3 text-[0.9rem] text-muted-foreground">{vacio}</p>;
  return (
    <ul className="mt-3 flex flex-col divide-y divide-border">
      {filas.map((f) => (
        <li key={f.clave} className="flex items-baseline justify-between gap-4 py-2 text-[0.95rem]">
          <span className="min-w-0 truncate">{f.texto}</span>
          <span className="shrink-0 tabular-nums">{clp.format(f.total)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const { apr } = await requireAdmin();

  if (!puede(apr.plan as Plan, "finanzas")) {
    return (
      <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Reportes</h1>
        <p className="text-[0.9rem] text-muted-foreground">
          Los números de tu comité por año: ingresos, egresos, lo que debes y el estado de tu bodega. Disponible en el plan{" "}
          {NOMBRE_PLAN[planMinimoPara("finanzas")]}.
        </p>
        <Link href="/panel/plan" className={cn(buttonVariants())}>
          Ver planes
        </Link>
      </div>
    );
  }

  const hoy = hoyEnChile();
  const anioActual = Number(hoy.slice(0, 4));
  const pedido = Number((await searchParams).anio);
  const anio = Number.isInteger(pedido) && pedido >= 2000 && pedido <= anioActual + 1 ? pedido : anioActual;

  const [resumen, propias, compras, insumos] = await Promise.all([
    resumenAnual(apr.id, anio),
    listarCategoriasMovimiento(apr.id),
    listarCompras(apr.id),
    listarInsumos(apr.id),
  ]);

  const resultado = resumen.totalIngresos - resumen.totalEgresos;

  // Lo que se debe: las compras por pagar, las que vencen antes primero.
  const porPagar = compras
    .filter((c) => c.estado === "PENDIENTE")
    .sort((a, b) => (a.vencimiento ?? "9999-12-31").localeCompare(b.vencimiento ?? "9999-12-31"));
  const totalPorPagar = porPagar.reduce((s, c) => s + c.total, 0);
  const vencidas = porPagar.filter((c) => c.vencimiento && c.vencimiento < hoy).length;

  // Lo comprado en el año, por proveedor.
  const porProveedor = new Map<string, number>();
  for (const c of compras) {
    if (c.estado === "ANULADA" || !c.fecha.startsWith(String(anio))) continue;
    const clave = c.proveedor ?? "Sin proveedor";
    porProveedor.set(clave, (porProveedor.get(clave) ?? 0) + c.total);
  }
  const comprasPorProveedor = [...porProveedor.entries()]
    .map(([clave, total]) => ({ clave, texto: clave, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const valorInventario = insumos.reduce((s, i) => s + i.stock * i.costo, 0);
  const bajos = insumos.filter(estaBajo);

  const planilla = [
    ["mes", "ingresos", "egresos", "resultado"],
    ...resumen.meses.map((m) => [m.mes, m.ingresos, m.egresos, m.ingresos - m.egresos]),
    ["total", resumen.totalIngresos, resumen.totalEgresos, resultado],
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-tight">Reportes</h1>
          <p className="mt-0.5 text-[0.9rem] text-muted-foreground">Los números de tu comité, por año.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/panel/reportes?anio=${anio - 1}`}
            aria-label="Año anterior"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="flex h-10 min-w-24 items-center justify-center rounded-xl border border-border px-4 text-[0.95rem] font-medium tabular-nums">
            {anio}
          </span>
          {anio < anioActual + 1 ? (
            <Link
              href={`/panel/reportes?anio=${anio + 1}`}
              aria-label="Año siguiente"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-muted"
            >
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground/40">
              <ChevronRight className="size-4" />
            </span>
          )}
        </div>
      </div>

      <section aria-label="Resumen del año" className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className={cn(etiquetaKpi, "text-emerald-700 dark:text-emerald-400")}>Ingresos del año</p>
          <p className="mt-3 text-[2rem] leading-none font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
            {clp.format(resumen.totalIngresos)}
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-500/30 dark:bg-red-500/10">
          <p className={cn(etiquetaKpi, "text-red-600 dark:text-red-400")}>Egresos del año</p>
          <p className="mt-3 text-[2rem] leading-none font-bold text-red-600 tabular-nums dark:text-red-400">
            {clp.format(resumen.totalEgresos)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Resultado del año</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{clp.format(resultado)}</p>
        </div>
      </section>

      <section className={tarjeta}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={tituloTarjeta}>Mes a mes</h2>
          <DescargarCsvBoton nombreArchivo={`reporte-${anio}.csv`} filas={planilla} />
        </div>
        <div className="mt-5">
          <GraficoMeses meses={resumen.meses} />
        </div>
        <div className="scroll-fino mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-136 border-collapse text-[0.95rem]">
            <thead>
              <tr className="border-b border-border bg-card">
                {["Mes", "Ingresos", "Egresos", "Resultado", ""].map((c, i) => (
                  <th key={c || "informe"} className={cn("px-5 py-3 font-medium text-muted-foreground", i === 0 ? "text-left" : "text-right")}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resumen.meses.map((m) => {
                const sinDatos = m.ingresos === 0 && m.egresos === 0;
                return (
                  <tr key={m.mes} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 capitalize">{nombreMes(m.mes)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{sinDatos ? "—" : clp.format(m.ingresos)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{sinDatos ? "—" : clp.format(m.egresos)}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums">{sinDatos ? "—" : clp.format(m.ingresos - m.egresos)}</td>
                    <td className="px-5 py-3 text-right">
                      {!sinDatos && (
                        <Link href={`/informes/caja/${m.mes}`} target="_blank" className="text-[0.85rem] text-primary hover:underline">
                          Informe
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-border bg-card font-semibold">
                <td className="px-5 py-3">Total {anio}</td>
                <td className="px-5 py-3 text-right tabular-nums">{clp.format(resumen.totalIngresos)}</td>
                <td className="px-5 py-3 text-right tabular-nums">{clp.format(resumen.totalEgresos)}</td>
                <td className="px-5 py-3 text-right tabular-nums">{clp.format(resultado)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={tarjeta}>
          <h2 className={tituloTarjeta}>De dónde vino la plata</h2>
          <ListaTotales
            filas={resumen.ingresos.map((c) => ({ clave: c.categoria, texto: textoCategoria(c.categoria, propias), total: c.total }))}
            vacio="Sin ingresos este año."
          />
        </section>
        <section className={tarjeta}>
          <h2 className={tituloTarjeta}>A dónde fue la plata</h2>
          <ListaTotales
            filas={resumen.egresos.map((c) => ({ clave: c.categoria, texto: textoCategoria(c.categoria, propias), total: c.total }))}
            vacio="Sin egresos este año."
          />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={tarjeta}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={tituloTarjeta}>Lo que debes a proveedores</h2>
            <Link href="/panel/compras" className="text-[0.85rem] text-primary hover:underline">
              Ver compras
            </Link>
          </div>
          <p className="mt-3 text-[1.75rem] leading-none font-bold tabular-nums">{clp.format(totalPorPagar)}</p>
          {porPagar.length > 0 && (
            <p className={cn("mt-2 text-[0.85rem]", vencidas > 0 ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>
              {porPagar.length} {porPagar.length === 1 ? "compra" : "compras"} por pagar
              {vencidas > 0 ? ` · ${vencidas} vencida${vencidas === 1 ? "" : "s"}` : ""}
            </p>
          )}
          {porPagar.length === 0 ? (
            <p className="mt-3 text-[0.9rem] text-muted-foreground">No debes nada por ahora.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {porPagar.slice(0, 8).map((c) => {
                const vencida = c.vencimiento !== null && c.vencimiento < hoy;
                return (
                  <li key={c.id} className="flex items-baseline justify-between gap-4 py-2 text-[0.95rem]">
                    <span className="min-w-0 truncate">
                      C-{c.numero} · {c.proveedor ?? "Sin proveedor"}
                      <span className={cn("ml-2 text-[0.8rem]", vencida ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                        {c.vencimiento ? `vence ${fechaCorta(c.vencimiento)}` : "sin vencimiento"}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{clp.format(c.total)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={tarjeta}>
          <h2 className={tituloTarjeta}>Compras por proveedor en {anio}</h2>
          <ListaTotales filas={comprasPorProveedor} vacio="Sin compras este año." />
        </section>
      </div>

      <section className={tarjeta}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={tituloTarjeta}>Inventario</h2>
          <Link href="/panel/inventario" className="text-[0.85rem] text-primary hover:underline">
            Ver inventario
          </Link>
        </div>
        <div className="mt-3 grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-[0.85rem] text-muted-foreground">Materiales</p>
            <p className="text-[1.5rem] font-bold tabular-nums">{insumos.length}</p>
          </div>
          <div>
            <p className="text-[0.85rem] text-muted-foreground">Valor guardado en bodega</p>
            <p className="text-[1.5rem] font-bold tabular-nums">{clp.format(valorInventario)}</p>
          </div>
          <div>
            <p className="text-[0.85rem] text-muted-foreground">Con stock bajo</p>
            <p className={cn("text-[1.5rem] font-bold tabular-nums", bajos.length > 0 && "text-red-600 dark:text-red-400")}>{bajos.length}</p>
          </div>
        </div>
        {bajos.length > 0 && (
          <ul className="mt-4 flex flex-col divide-y divide-border border-t border-border">
            {bajos.slice(0, 8).map((i) => (
              <li key={i.id} className="flex items-baseline justify-between gap-4 py-2 text-[0.95rem]">
                <span className="min-w-0 truncate">{i.nombre}</span>
                <span className="shrink-0 text-red-600 tabular-nums dark:text-red-400">
                  quedan {formatoCantidad(i.stock)} {unidadCorta(i.unidad)} · avisar en {formatoCantidad(i.stockMinimo)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
