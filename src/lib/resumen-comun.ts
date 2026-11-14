/**
 * Lo que muestra el Resumen del panel, ya calculado y listo para pintar. Es el mismo formato para las cifras reales
 * (lib/resumen.ts) y para la demostración (lib/demo-dashboard.ts), y no toca la base de datos: lo usa el navegador.
 */

export type EstadoBoletaResumen = "Pagada" | "Pendiente" | "Vencida";

export type DatosResumen = {
  /** "Buenas noches, Diego" y "Viernes 13 de noviembre". */
  saludo: string;
  fecha: string;
  /** Es la vista de demostración (cifras inventadas, con su aviso). */
  demo: boolean;
  periodo: { valor: string; opciones: { valor: string; texto: string }[] };

  /** La tarjeta principal: lo cobrado de lo facturado en el período. */
  hero: {
    titulo: string;
    recaudado: number;
    facturado: number;
    pct: number;
    /** Días hasta que vence la primera boleta que sigue impaga, si alguna no ha vencido. */
    vencenEn: number | null;
    /** Cuánto subió o bajó lo recaudado contra el mes anterior ("68% más que octubre"). */
    variacion: { pct: number; contra: string } | null;
    pagadas: number;
    pendientes: number;
    vencidas: number;
  };

  /** Solo con Finanzas. `serie` es el disponible de los últimos días. */
  caja: { disponible: number | null; ingresos: number; egresos: number; etiquetaNeto: string; serie: number[] } | null;

  kpis: {
    socios: { total: number; nuevos: number; textoNuevos: string };
    morosos: { n: number; pct: number };
    consumo: { titulo: string; m3: number; porSocio: number };
    lecturas: { hechas: number; total: number };
  };

  recaudacion: { meses: { corto: string; largo: string }[]; valores: number[]; actual: number };

  consumo: {
    meses: { corto: string; largo: string }[];
    /** null = ese mes no tiene lecturas ni boletas con consumo. */
    valores: (number | null)[];
    actual: number;
    raro: number | null;
    avisoRaro: string | null;
    residencial: number;
    comercial: number;
  };

  /** Lo que necesita acción hoy (no depende del período elegido). */
  atencion: { clave: string; titulo: string; detalle: string; n: number; tono: "alerta" | "info"; href: string }[];

  pagos: { id: string; socio: string; cuando: string; medio: string; monto: number }[];

  /** Los últimos comunicados publicados a los socios (para el botón «Comunicado»). */
  comunicados: { id: string; titulo: string; hace: string }[];

  boletas: { id: string; socio: string; periodo: string; m3: number | null; monto: number; estado: EstadoBoletaResumen }[];
  subtituloBoletas: string;

  /** A dónde llevan los enlaces ("Ver pagos", "Registrar pago"...): según el plan. */
  rutas: { pagos: string; caja: string | null };
};
