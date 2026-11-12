import {
  AlertOctagon,
  CalendarCheck,
  HandCoins,
  PiggyBank,
  Palmtree,
  Stethoscope,
  UsersRound,
  BarChart3,
  ArrowLeftRight,
  Banknote,
  ClipboardList,
  CreditCard,
  Droplets,
  Hammer,
  HardHat,
  Briefcase,
  Building,
  Waypoints,
  Headset,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  MessageCircle,
  Package,
  ReceiptText,
  Scissors,
  Settings,
  ShoppingCart,
  Smartphone,
  UserCheck,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

/**
 * Los módulos del panel: una sola lista que usan el menú lateral y el buscador, para que
 * nunca muestren cosas distintas. Qué ve cada comité depende de su rol y de su plan.
 */

export type Enlace = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

export type GrupoMenu = {
  titulo: string;
  icono: typeof LayoutDashboard;
  enlaces: Enlace[];
};

const gestion: Enlace[] = [
  { href: "/panel", label: "Resumen", icon: LayoutDashboard },
  { href: "/panel/socios", label: "Socios", icon: Users },
  { href: "/panel/boletas", label: "Boletas", icon: ReceiptText },
  { href: "/panel/pagos", label: "Pagos", icon: Wallet },
  { href: "/panel/inventario", label: "Inventario", icon: Package },
  { href: "/panel/lecturas", label: "Lecturas", icon: Droplets },
  { href: "/panel/lecturas/terreno", label: "Modo terreno", icon: Smartphone },
  { href: "/panel/tecnicos", label: "Equipo", icon: HardHat },
];

/** Operación (plan Grande): las fallas del sistema de agua, las labores, los bienes del comité y los arranques de la red. */
const laboresEnlace: Enlace = { href: "/panel/labores", label: "Labores", icon: Hammer };
/** Activos fijos (desde Estándar): en Grande vive en Operación; en Estándar, que no tiene ese grupo, va en Finanzas. */
const activosEnlace: Enlace = { href: "/panel/activos", label: "Activos fijos", icon: Building };
const operacion: Enlace[] = [
  { href: "/panel/incidentes", label: "Incidentes", icon: AlertOctagon },
  laboresEnlace,
  activosEnlace,
  { href: "/panel/arranques", label: "Arranques", icon: Waypoints },
];

/** RR.HH. (plan Grande): las personas que trabajan para el comité. */
const rrhh: Enlace[] = [
  { href: "/panel/personal", label: "Personal", icon: Briefcase },
  { href: "/panel/remuneraciones", label: "Remuneraciones", icon: HandCoins },
  { href: "/panel/prestamos", label: "Préstamos", icon: PiggyBank },
  { href: "/panel/vacaciones", label: "Vacaciones", icon: Palmtree },
  { href: "/panel/licencias", label: "Licencias", icon: Stethoscope },
  { href: "/panel/asistencia", label: "Asistencia", icon: CalendarCheck },
];

/**
 * Finanzas (desde el plan Estándar): la plata del comité en un solo lugar. Pagos se muda aquí desde
 * Gestión; en los demás planes se queda en Gestión, porque registrar pagos es de todos.
 */
const finanzas: Enlace[] = [
  { href: "/panel/pagos", label: "Pagos", icon: Wallet },
  { href: "/panel/caja", label: "Caja", icon: Banknote },
  { href: "/panel/giros", label: "Giros", icon: ArrowLeftRight },
  { href: "/panel/compras", label: "Compras", icon: ShoppingCart },
  { href: "/panel/reportes", label: "Reportes", icon: BarChart3 },
];

const atencion: Enlace[] = [
  { href: "/panel/conversaciones", label: "Conversaciones", icon: MessageCircle },
  { href: "/panel/socios/solicitudes", label: "Solicitudes", icon: UserCheck },
  { href: "/panel/cortes", label: "Cortes", icon: Scissors },
  { href: "/panel/configuracion", label: "Configuración", icon: Settings },
  { href: "/panel/ayuda", label: "Ayuda", icon: LifeBuoy },
];

/** Los roles que entran al panel. */
export type RolMenu = "ADMIN" | "OPERADOR" | "TESORERO";

/** Lo que ve un TESORERO: Finanzas y el inventario que mueven las compras. */
const soloTesorero: Enlace[] = [{ href: "/panel/inventario", label: "Inventario", icon: Package }];

/** Lo único que un OPERADOR puede ver: cargar lecturas, nada más. */
const soloOperador: Enlace[] = [
  { href: "/panel/lecturas", label: "Lecturas", icon: Droplets },
  { href: "/panel/ordenes", label: "Órdenes", icon: ClipboardList },
];

/** Los grupos del menú para un rol y un plan. */
export function gruposDelMenu({
  rol,
  chat,
  conFinanzas,
  conRrhh = false,
  conOperacion = false,
}: {
  rol: RolMenu;
  /** El plan incluye el chat en tiempo real: sin él, Conversaciones no aparece. */
  chat: boolean;
  /** El plan incluye Finanzas (Estándar y Grande): aparece su grupo y Pagos se muda a él. */
  conFinanzas: boolean;
  /** El plan incluye RR.HH. (Grande): aparece su grupo. */
  conRrhh?: boolean;
  /** El plan incluye Operación (Grande): aparece su grupo. Sin él, Labores pasa a Gestión junto al Inventario. */
  conOperacion?: boolean;
}): GrupoMenu[] {
  if (rol === "TESORERO") {
    return [
      { titulo: "Finanzas", icono: Landmark, enlaces: finanzas },
      ...(conFinanzas ? [{ titulo: "Bodega", icono: Package, enlaces: soloTesorero }] : []),
    ];
  }
  if (rol !== "ADMIN") return [{ titulo: "Terreno", icono: Droplets, enlaces: soloOperador }];

  return [
    {
      titulo: "Gestión",
      icono: LayoutGrid,
      // Con Finanzas (Estándar y Grande), Pagos se muda a su grupo; sin Finanzas, Inventario no se ofrece: va con el mismo plan.
      enlaces: [
        ...gestion.filter((e) => (conFinanzas ? e.href !== "/panel/pagos" : e.href !== "/panel/inventario")),
        // Las labores usan el inventario: con Inventario pero sin el grupo Operación, viven en Gestión.
        ...(conFinanzas && !conOperacion ? [laboresEnlace] : []),
      ],
    },
    ...(conFinanzas ? [{ titulo: "Finanzas", icono: Landmark, enlaces: conOperacion ? finanzas : [...finanzas, activosEnlace] }] : []),
    ...(conRrhh ? [{ titulo: "RR.HH.", icono: UsersRound, enlaces: rrhh }] : []),
    ...(conOperacion ? [{ titulo: "Operación", icono: Wrench, enlaces: operacion }] : []),
    {
      titulo: "Atención",
      icono: Headset,
      enlaces: atencion.filter((e) => (chat || e.href !== "/panel/conversaciones")),
    },
  ];
}

/** Destinos que no están en el menú pero se buscan igual: la cuenta y atajos a acciones frecuentes. */
export function destinosExtra({ rol, conFinanzas }: { rol: RolMenu; conFinanzas: boolean }) {
  if (rol === "TESORERO") return [{ href: "/panel/perfil", label: "Mi perfil", icon: UserRound, grupo: "Cuenta" }];
  if (rol !== "ADMIN") return [];
  const cuenta: (Enlace & { grupo: string })[] = [
    { href: "/panel/plan", label: "Mi plan", icon: CreditCard, grupo: "Cuenta" },
    { href: "/panel/perfil", label: "Mi perfil", icon: UserRound, grupo: "Cuenta" },
  ];
  const atajos: (Enlace & { grupo: string })[] = conFinanzas
    ? [{ href: "/panel/compras/nueva", label: "Nueva compra", icon: ShoppingCart, grupo: "Finanzas" }]
    : [];
  return [...atajos, ...cuenta];
}

/** Palabras con las que la gente nombra cada módulo, para que «bodega» encuentre Inventario. */
export const PALABRAS_CLAVE: Record<string, string> = {
  "/panel": "inicio principal tablero",
  "/panel/socios": "vecinos usuarios arranques clientes padron",
  "/panel/boletas": "cobros recibos facturas agua consumo",
  "/panel/pagos": "abonos cobro registrar pago deuda",
  "/panel/inventario": "bodega stock materiales cloro repuestos",
  "/panel/lecturas": "medidor consumo medicion",
  "/panel/lecturas/terreno": "celular tecnico ruta",
  "/panel/tecnicos": "operadores equipo invitar",
  "/panel/personal": "trabajadores empleados ficha operador tesorero recursos humanos rrhh",
  "/panel/remuneraciones": "sueldos liquidaciones honorarios pago bonos descuentos planilla",
  "/panel/vacaciones": "feriado dias libres permisos saldo descanso",
  "/panel/licencias": "licencia medica enfermedad reposo salud",
  "/panel/asistencia": "marcar presente ausente atraso horario llegada",
  "/panel/giros": "banco retiro giro deposito efectivo cuenta cheque traspaso",
  "/panel/prestamos": "anticipo adelanto prestamo cuotas descuento sueldo deuda trabajador",
  "/panel/labores": "trabajos mantencion reparacion materiales insumos descuento stock cambio medidor limpieza cloracion",
  "/panel/incidentes": "fallas fuga rotura corte bomba turbiedad averias reparacion emergencia",
  "/panel/arranques": "conexiones red abastece socios sector ubicacion",
  "/panel/activos": "bienes equipos bomba estanque terreno vehiculo depreciacion patrimonio inventario fijo",
  "/panel/caja": "plata dinero efectivo ingresos egresos saldo gastos",
  "/panel/compras": "proveedores facturas comprar gastos",
  "/panel/reportes": "informe año resumen estadisticas",
  "/panel/conversaciones": "chat mensajes socios ia",
  "/panel/socios/solicitudes": "pedidos acceso clave",
  "/panel/cortes": "morosidad corte suspension reposicion",
  "/panel/configuracion": "tarifas datos comite logo whatsapp ajustes",
  "/panel/ayuda": "guias soporte tutorial como",
  "/panel/plan": "suscripcion pago plan tarjeta",
  "/panel/perfil": "cuenta contraseña usuario",
  "/panel/compras/nueva": "registrar compra proveedor factura",
};
