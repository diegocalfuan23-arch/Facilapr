import { AlertOctagon, BarChart3, Banknote, Briefcase, FileText, Package, ShoppingCart, Wallet } from "lucide-react";

const modulos = [
  {
    icon: Banknote,
    titulo: "Caja",
    detalle:
      "Ingresos y egresos del día y del mes, con saldo inicial, disponible y cierre de caja. Los pagos de socios entran solos.",
  },
  {
    icon: ShoppingCart,
    titulo: "Compras y proveedores",
    detalle:
      "Registra lo que compra el comité, quién te lo vendió y si ya está pagado. Lo pagado baja a Caja como egreso.",
  },
  {
    icon: Package,
    titulo: "Inventario",
    detalle:
      "Cloro, repuestos y materiales con su stock, categorías e historial de entradas y salidas. Lo que compras suma al stock.",
  },
  {
    icon: BarChart3,
    titulo: "Reportes",
    detalle: "El año completo, mes a mes: cuánto entró, cuánto salió, en qué se gastó y cuánto se debe a proveedores.",
  },
  {
    icon: FileText,
    titulo: "Informe para la asamblea",
    detalle: "Un resumen del mes listo para imprimir o descargar, para rendir cuentas a los socios sin armar planillas.",
  },
  {
    icon: Briefcase,
    titulo: "Personal",
    detalle: "Quienes trabajan para el comité, con su sueldo u honorario. Cada pago que registras baja a la Caja como egreso.",
  },
  {
    icon: AlertOctagon,
    titulo: "Incidentes",
    detalle: "Fugas, fallas de bomba o cortes: su historial, quién los atendió y cuánto costó repararlos.",
  },
  {
    icon: Wallet,
    titulo: "Pagos de socios",
    detalle: "Cada abono queda registrado contra su boleta y se suma a los ingresos de la Caja automáticamente.",
  },
];

export function GestionSection() {
  return (
    <section id="gestion-completa" className="py-24">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-12 max-w-[700px]">
          <h2 className="text-[clamp(1.7rem,2.8vw,2.2rem)] font-semibold text-balance">
            No solo cobras el agua: llevas toda la plata del comité.
          </h2>
          <p className="mt-4 text-[0.97rem] text-muted-foreground">
            Ingresos, egresos, compras, inventario, personal e incidentes en el mismo lugar donde ya haces las boletas. Disponible desde el
            plan Estándar.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {modulos.map(({ icon: Icon, titulo, detalle }) => (
            <div key={titulo} className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-[10px] bg-muted text-foreground">
                <Icon className="size-5" />
              </div>
              <h3 className="mb-2 text-[1.05rem] font-semibold">{titulo}</h3>
              <p className="text-[0.91rem] leading-relaxed text-muted-foreground">{detalle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
