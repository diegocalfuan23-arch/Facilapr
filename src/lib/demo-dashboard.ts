import type { DatosResumen } from "@/lib/resumen-comun";

/**
 * Datos ficticios para ver el Resumen poblado, con la forma que tendría un comité mediano en marcha.
 *
 * Solo se usan con ?demo=1 en la URL y con un aviso visible en pantalla: nunca deben aparecer por defecto.
 * Un panel que muestra cifras inventadas sin decirlo es peor que uno vacío: un dirigente podría creer que son suyas.
 */

const MESES = [
  { corto: "Abr", largo: "Abr 2026" },
  { corto: "May", largo: "May 2026" },
  { corto: "Jun", largo: "Jun 2026" },
  { corto: "Jul", largo: "Jul 2026" },
  { corto: "Ago", largo: "Ago 2026" },
  { corto: "Sep", largo: "Sep 2026" },
  { corto: "Oct", largo: "Oct 2026" },
  { corto: "Nov", largo: "Nov 2026" },
];

export const DEMO: DatosResumen = {
  saludo: "Buenos días, Admin",
  fecha: "Viernes 13 de noviembre",
  demo: true,
  periodo: {
    valor: "2026-11",
    opciones: [
      { valor: "2026-11", texto: "Noviembre 2026" },
      { valor: "2026-10", texto: "Octubre 2026" },
      { valor: "2026-09", texto: "Septiembre 2026" },
      { valor: "2026", texto: "Todo 2026" },
    ],
  },
  hero: { titulo: "Recaudado en noviembre", recaudado: 1_240_800, facturado: 1_986_500, pct: 62, vencenEn: 11, variacion: { pct: 8, contra: "octubre" }, pagadas: 148, pendientes: 79, vencidas: 21 },
  caja: {
    disponible: 4_820_300,
    ingresos: 1_320_000,
    egresos: 612_400,
    etiquetaNeto: "este mes",
    serie: [4_100_000, 4_160_000, 4_150_000, 4_320_000, 4_480_000, 4_610_000, 4_820_300],
  },
  kpis: {
    socios: { total: 248, nuevos: 3, textoNuevos: "nuevos este mes" },
    morosos: { n: 21, pct: 8 },
    consumo: { titulo: "Consumo del mes", m3: 2_710, porSocio: 10.9 },
    lecturas: { hechas: 214, total: 248 },
  },
  recaudacion: {
    meses: MESES,
    valores: [1_910_000, 1_760_000, 1_690_000, 1_650_400, 1_720_000, 1_580_000, 1_150_000, 1_240_800],
    actual: 7,
  },
  consumo: {
    meses: MESES,
    valores: [3_210, 2_870, 2_640, 2_710, 2_980, 3_120, 2_860, 2_710],
    actual: 7,
    raro: null,
    avisoRaro: null,
    residencial: 21_800,
    comercial: 3_900,
  },
  atencion: [
    { clave: "lecturas", titulo: "Lecturas por aprobar", detalle: "Revisa antes de emitir boletas", n: 12, tono: "info", href: "/panel/lecturas" },
    { clave: "sin-lectura", titulo: "Socios sin lectura", detalle: "Se les cobrará solo cargo fijo", n: 34, tono: "alerta", href: "/panel/lecturas" },
    { clave: "solicitudes", titulo: "Solicitudes de acceso", detalle: "Socios pidiendo entrar a su panel", n: 2, tono: "info", href: "/panel/socios/solicitudes" },
    { clave: "stock", titulo: "Materiales con stock bajo", detalle: "Inventario", n: 0, tono: "alerta", href: "/panel/inventario" },
  ],
  comunicados: [],
  morosidad: { tasa: 8.47, socios: 21, total: 248, serie: [12, 9, 14, 11, 16, 19, 24, 21] },
  mejorMes: {
    texto: "Abril 2026",
    pagadores: [
      { id: "m1", nombre: "Luis Painemal", pagado: 39_450, boletas: 3 },
      { id: "m2", nombre: "María Huenchuñir", pagado: 27_750, boletas: 3 },
      { id: "m3", nombre: "Elena Quilaqueo", pagado: 22_100, boletas: 2 },
      { id: "m4", nombre: "Rosa Millán", pagado: 14_800, boletas: 2 },
      { id: "m5", nombre: "Juan Marileo", pagado: 11_300, boletas: 1 },
    ],
  },
  pagos: [
    { id: "p1", socio: "Luis Painemal", cuando: "Hoy, 10:42", medio: "Transferencia", monto: 13_150 },
    { id: "p2", socio: "María Huenchuñir", cuando: "12-11", medio: "Efectivo", monto: 9_250 },
    { id: "p3", socio: "Elena Quilaqueo", cuando: "10-11", medio: "Pago en línea", monto: 11_300 },
    { id: "p4", socio: "Rosa Millán", cuando: "09-11", medio: "Transferencia", monto: 7_400 },
  ],
  boletas: [
    { id: "b1", socio: "María Huenchuñir", periodo: "Noviembre", m3: 14, monto: 9_250, estado: "Pagada" },
    { id: "b2", socio: "Pedro Curihual", periodo: "Noviembre", m3: 18, monto: 11_800, estado: "Pendiente" },
    { id: "b3", socio: "Rosa Millán", periodo: "Noviembre", m3: 11, monto: 7_400, estado: "Pendiente" },
    { id: "b4", socio: "Luis Painemal", periodo: "Noviembre", m3: 20, monto: 13_150, estado: "Pagada" },
    { id: "b5", socio: "Carmen Antileo", periodo: "Noviembre", m3: 13, monto: 8_900, estado: "Vencida" },
  ],
  subtituloBoletas: "Noviembre 2026 · vencen el 24-11",
  rutas: { pagos: "/panel/pagos", caja: "/panel/caja" },
};
