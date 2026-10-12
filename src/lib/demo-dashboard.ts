/**
 * Datos ficticios para ver el dashboard poblado, con la forma que tendría un
 * comité mediano en marcha.
 *
 * Solo se usan con ?demo=1 en la URL y con un aviso visible en pantalla:
 * nunca deben aparecer por defecto. Un panel que muestra cifras inventadas
 * sin decirlo es peor que uno vacío — un dirigente podría creer que son suyas.
 */

export type DatosDashboard = {
  padron: { total: number; activos: number };
  morosidad: { socios: number; monto: number };
  facturacion: { emitidas: number; recaudado: number; facturado: number };
  variacionRecaudado: number | null;
  variacionEmitidas: number | null;
  cobranza: {
    periodo: string;
    pagadas: number;
    pendientes: number;
    vencidas: number;
  }[];
  consumo: { periodo: string; valor: number }[];
  /** m³ de los períodos mostrados, según el uso del arranque. */
  consumoPorUso: { residencial: number; comercial: number };
  recaudado: { periodo: string; valor: number }[];
  vencidas: { periodo: string; valor: number }[];
  boletas: {
    id: string;
    socioNombre: string;
    periodo: string;
    montoTotal: number;
    montoPagado: number;
    fechaVencimiento: Date;
  }[];
  socios: { id: string; nombre: string; activo: boolean }[];
  /** El período que más recaudó y quiénes pagaron en él. */
  mejorPeriodo: { periodo: string; monto: number } | null;
  pagadores: { id: string; nombre: string; pagado: number; boletas: number }[];
  /** Socios esperando que la directiva apruebe o rechace su acceso al panel. */
  solicitudesPendientes: {
    id: string;
    nombre: string;
    rut: string | null;
    hace: string;
  }[];
};

const MESES = ["Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul"];

const dias = (n: number) => new Date(Date.now() + n * 86_400_000);

export const DEMO: DatosDashboard = {
  padron: { total: 248, activos: 236 },
  morosidad: { socios: 31, monto: 412_800 },
  facturacion: { emitidas: 1_842, recaudado: 14_620_400, facturado: 15_033_200 },
  variacionRecaudado: 12.4,
  variacionEmitidas: 3.1,

  // La morosidad sube en invierno: es cuando más cuesta cobrar en el campo.
  cobranza: [
    { periodo: "Dic", pagadas: 198, pendientes: 22, vencidas: 8 },
    { periodo: "Ene", pagadas: 205, pendientes: 19, vencidas: 11 },
    { periodo: "Feb", pagadas: 212, pendientes: 17, vencidas: 9 },
    { periodo: "Mar", pagadas: 208, pendientes: 21, vencidas: 14 },
    { periodo: "Abr", pagadas: 216, pendientes: 15, vencidas: 12 },
    { periodo: "May", pagadas: 203, pendientes: 24, vencidas: 19 },
    { periodo: "Jun", pagadas: 197, pendientes: 28, vencidas: 24 },
    { periodo: "Jul", pagadas: 189, pendientes: 33, vencidas: 31 },
  ],

  // El consumo baja en invierno: menos riego, menos animales.
  consumoPorUso: { residencial: 21800, comercial: 3900 },
  consumo: [
    { periodo: "Dic", valor: 4_120 },
    { periodo: "Ene", valor: 4_780 },
    { periodo: "Feb", valor: 4_560 },
    { periodo: "Mar", valor: 3_940 },
    { periodo: "Abr", valor: 3_210 },
    { periodo: "May", valor: 2_870 },
    { periodo: "Jun", valor: 2_640 },
    { periodo: "Jul", valor: 2_710 },
  ],

  recaudado: [
    { periodo: "Dic", valor: 1_840_000 },
    { periodo: "Ene", valor: 1_920_000 },
    { periodo: "Feb", valor: 1_980_000 },
    { periodo: "Mar", valor: 1_870_000 },
    { periodo: "Abr", valor: 1_910_000 },
    { periodo: "May", valor: 1_760_000 },
    { periodo: "Jun", valor: 1_690_000 },
    { periodo: "Jul", valor: 1_650_400 },
  ],

  vencidas: [
    { periodo: "Dic", valor: 8 },
    { periodo: "Ene", valor: 11 },
    { periodo: "Feb", valor: 9 },
    { periodo: "Mar", valor: 14 },
    { periodo: "Abr", valor: 12 },
    { periodo: "May", valor: 19 },
    { periodo: "Jun", valor: 24 },
    { periodo: "Jul", valor: 31 },
  ],

  boletas: [
    {
      id: "d1",
      socioNombre: "María Huenchuñir",
      periodo: "2026-07",
      montoTotal: 9_250,
      montoPagado: 9_250,
      fechaVencimiento: dias(12),
    },
    {
      id: "d2",
      socioNombre: "Pedro Curihual",
      periodo: "2026-07",
      montoTotal: 11_800,
      montoPagado: 0,
      fechaVencimiento: dias(-6),
    },
    {
      id: "d3",
      socioNombre: "Rosa Millán",
      periodo: "2026-07",
      montoTotal: 7_400,
      montoPagado: 4_000,
      fechaVencimiento: dias(12),
    },
    {
      id: "d4",
      socioNombre: "Luis Painemal",
      periodo: "2026-07",
      montoTotal: 13_150,
      montoPagado: 13_150,
      fechaVencimiento: dias(12),
    },
    {
      id: "d5",
      socioNombre: "Carmen Antileo",
      periodo: "2026-06",
      montoTotal: 8_900,
      montoPagado: 0,
      fechaVencimiento: dias(-18),
    },
  ],

  // Febrero es el mes más alto de la serie de recaudación.
  mejorPeriodo: { periodo: "2026-02", monto: 1_980_000 },

  pagadores: [
    { id: "p1", nombre: "Luis Painemal", pagado: 39_450, boletas: 3 },
    { id: "p2", nombre: "María Huenchuñir", pagado: 27_750, boletas: 3 },
    { id: "p3", nombre: "Elena Quilaqueo", pagado: 22_100, boletas: 2 },
    { id: "p4", nombre: "Rosa Millán", pagado: 14_800, boletas: 2 },
    { id: "p5", nombre: "Juan Marileo", pagado: 11_300, boletas: 1 },
  ],

  socios: [
    { id: "s1", nombre: "Carmen Antileo", activo: true },
    { id: "s2", nombre: "Luis Painemal", activo: true },
    { id: "s3", nombre: "Rosa Millán", activo: true },
    { id: "s4", nombre: "Pedro Curihual", activo: false },
    { id: "s5", nombre: "María Huenchuñir", activo: true },
  ],

  solicitudesPendientes: [
    { id: "sol1", nombre: "Elena Quilaqueo", rut: "9.876.543-2", hace: "hace 5 min" },
    { id: "sol2", nombre: "Juan Marileo", rut: "11.222.333-4", hace: "hace 1 día" },
  ],
};

export { MESES };
