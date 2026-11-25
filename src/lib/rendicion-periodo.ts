import { mesVecino, nombreMes } from "@/lib/finanzas-comun";

/**
 * Los períodos que se pueden rendir: un mes, un trimestre, un semestre o un año completo. Sin base de datos, para que lo
 * usen igual el servidor (que arma los datos y el PDF) y la pantalla (que elige el período).
 */

export type TipoPeriodo = "mes" | "trimestre" | "semestre" | "anio";

/** `numero` es el mes (1-12), el trimestre (1-4) o el semestre (1-2); en un año no importa. */
export type PeriodoRendicion = { tipo: TipoPeriodo; anio: number; numero: number };

/** Qué partes lleva la rendición. */
export type ContenidoRendicion = {
  ingresos: boolean;
  egresos: boolean;
  compras: boolean;
  /** Material que entró y salió de la bodega, y el que está bajo. */
  inventario: boolean;
  cobranza: boolean;
  /** Lo descontado a los socios que se le cobra a la municipalidad. */
  subsidios: boolean;
  saldos: boolean;
  /** Patrimonio, labores e incidentes, según lo que incluya el plan. */
  extras: boolean;
};

export const CONTENIDO_TODO: ContenidoRendicion = { ingresos: true, egresos: true, compras: true, inventario: true, cobranza: true, subsidios: true, saldos: true, extras: true };

export const TIPOS_PERIODO: { valor: TipoPeriodo; texto: string }[] = [
  { valor: "mes", texto: "Mes" },
  { valor: "trimestre", texto: "Trimestre" },
  { valor: "semestre", texto: "Semestre" },
  { valor: "anio", texto: "Año" },
];

const MESES_POR_TIPO: Record<TipoPeriodo, number> = { mes: 1, trimestre: 3, semestre: 6, anio: 12 };
const TOPE_NUMERO: Record<TipoPeriodo, number> = { mes: 12, trimestre: 4, semestre: 2, anio: 1 };

const dos = (n: number) => String(n).padStart(2, "0");

/** Un período bien formado: el tipo conocido, el año razonable y el número dentro de su rango. */
export function periodoBienFormado(p: { tipo?: string; anio?: number; numero?: number }): p is PeriodoRendicion {
  if (!p.tipo || !(p.tipo in MESES_POR_TIPO)) return false;
  const tipo = p.tipo as TipoPeriodo;
  if (!Number.isInteger(p.anio) || (p.anio as number) < 2000 || (p.anio as number) > 2100) return false;
  return Number.isInteger(p.numero) && (p.numero as number) >= 1 && (p.numero as number) <= TOPE_NUMERO[tipo];
}

/** Del primer mes (AAAA-MM) que abarca, el rango y los nombres. `tope` es el primer día que ya no entra. */
export function rangoDe(p: PeriodoRendicion) {
  const primerMes = p.tipo === "anio" ? 1 : p.tipo === "mes" ? p.numero : (p.numero - 1) * MESES_POR_TIPO[p.tipo] + 1;
  const cuantos = MESES_POR_TIPO[p.tipo];
  const inicio = `${p.anio}-${dos(primerMes)}`;
  const meses = Array.from({ length: cuantos }, (_, i) => mesVecino(inicio, i));
  const siguiente = mesVecino(inicio, cuantos);
  const etiqueta =
    p.tipo === "mes"
      ? nombreMes(inicio)
      : p.tipo === "trimestre"
        ? `${p.numero}.º trimestre ${p.anio}`
        : p.tipo === "semestre"
          ? `${p.numero}.º semestre ${p.anio}`
          : `Año ${p.anio}`;
  return { desde: `${inicio}-01`, tope: `${siguiente}-01`, mesInicio: inicio, mesTope: siguiente, meses, etiqueta };
}

/** El período de hoy, del tipo pedido. */
export function periodoDeHoy(tipo: TipoPeriodo, hoy: string): PeriodoRendicion {
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  return { tipo, anio, numero: tipo === "mes" ? mes : tipo === "trimestre" ? Math.ceil(mes / 3) : tipo === "semestre" ? Math.ceil(mes / 6) : 1 };
}

/** El período de al lado del mismo tipo (delta = -1 o +1). */
export function periodoVecino(p: PeriodoRendicion, delta: number): PeriodoRendicion {
  if (p.tipo === "anio") return { ...p, anio: p.anio + delta };
  const { mesInicio } = rangoDe(p);
  const nuevo = mesVecino(mesInicio, delta * MESES_POR_TIPO[p.tipo]);
  const anio = Number(nuevo.slice(0, 4));
  const mes = Number(nuevo.slice(5, 7));
  return { tipo: p.tipo, anio, numero: p.tipo === "mes" ? mes : Math.ceil(mes / MESES_POR_TIPO[p.tipo]) };
}

/** Un período que ya empezó: no se rinden cuentas de lo que todavía no pasa. */
export function periodoYaEmpezo(p: PeriodoRendicion, hoy: string) {
  return rangoDe(p).desde <= hoy;
}

/** Cambiar de tipo conserva el momento: del 2.º trimestre al mes más reciente de ese trimestre que ya pasó, etc. */
export function cambiarTipo(p: PeriodoRendicion, tipo: TipoPeriodo, hoy: string): PeriodoRendicion {
  const { mesInicio } = rangoDe(p);
  const mes = Number(mesInicio.slice(5, 7));
  const candidato: PeriodoRendicion = {
    tipo,
    anio: p.anio,
    numero: tipo === "mes" ? mes : tipo === "trimestre" ? Math.ceil(mes / 3) : tipo === "semestre" ? Math.ceil(mes / 6) : 1,
  };
  return periodoYaEmpezo(candidato, hoy) ? candidato : periodoDeHoy(tipo, hoy);
}

/** Lee el período de una dirección: ?tipo=trimestre&anio=2026&numero=2. Lo que no sea válido cae en el período de hoy. */
export function periodoDeParametros(sp: { tipo?: string; anio?: string; numero?: string }, hoy: string): PeriodoRendicion {
  const tipo = (sp.tipo && sp.tipo in MESES_POR_TIPO ? sp.tipo : "anio") as TipoPeriodo;
  const candidato = { tipo, anio: Number(sp.anio), numero: tipo === "anio" ? 1 : Number(sp.numero) };
  if (periodoBienFormado(candidato) && periodoYaEmpezo(candidato, hoy)) return candidato;
  return periodoDeHoy(tipo, hoy);
}

/** Qué partes lleva, desde una dirección (?c=ingresos,egresos). Sin dato, lleva todo. */
export function contenidoDeParametro(c: string | undefined | null): ContenidoRendicion {
  if (!c) return CONTENIDO_TODO;
  const pedidos = new Set(c.split(",").map((s) => s.trim()));
  const contenido = {
    ingresos: pedidos.has("ingresos"),
    egresos: pedidos.has("egresos"),
    compras: pedidos.has("compras"),
    inventario: pedidos.has("inventario"),
    cobranza: pedidos.has("cobranza"),
    subsidios: pedidos.has("subsidios"),
    saldos: pedidos.has("saldos"),
    extras: pedidos.has("extras"),
  };
  return Object.values(contenido).some(Boolean) ? contenido : CONTENIDO_TODO;
}

export function contenidoAParametro(c: ContenidoRendicion) {
  return (Object.keys(c) as (keyof ContenidoRendicion)[]).filter((k) => c[k]).join(",");
}

/** «Ingresos y egresos», «Solo egresos»…: para el encabezado del PDF. */
export function descripcionContenido(c: ContenidoRendicion) {
  const partes = [c.ingresos && "ingresos", c.egresos && "egresos", c.compras && "compras", c.inventario && "inventario", c.cobranza && "cobranza", c.subsidios && "subsidios", c.saldos && "saldos"].filter(Boolean) as string[];
  if (c.extras) partes.push("patrimonio y trabajos");
  if (partes.length === 0) return "";
  const texto = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Lo que se ve en la pantalla a la vez: todo el informe o una sola sección. El PDF y el Excel llevan lo mismo que se ve. */
export type SeccionRendicion = "todo" | "saldos" | "ingresos" | "egresos" | "compras" | "cobranza" | "subsidios" | "inventario" | "patrimonio";

export const SECCIONES_RENDICION: { id: SeccionRendicion; nombre: string }[] = [
  { id: "todo", nombre: "Todo" },
  { id: "saldos", nombre: "Saldos" },
  { id: "ingresos", nombre: "Ingresos" },
  { id: "egresos", nombre: "Egresos" },
  { id: "compras", nombre: "Compras" },
  { id: "cobranza", nombre: "Cobranza" },
  { id: "subsidios", nombre: "Subsidios" },
  { id: "inventario", nombre: "Inventario" },
  { id: "patrimonio", nombre: "Patrimonio y trabajos" },
];

export function seccionDeParametro(s: string | undefined | null): SeccionRendicion {
  return SECCIONES_RENDICION.some((x) => x.id === s) ? (s as SeccionRendicion) : "todo";
}

/** Las partes del PDF y del Excel que corresponden a una sección. «Saldos» lleva el cuadro de caja completo, sin las listas por concepto. */
export function contenidoDeSeccion(s: SeccionRendicion): ContenidoRendicion {
  if (s === "todo") return CONTENIDO_TODO;
  return {
    ingresos: s === "ingresos",
    egresos: s === "egresos",
    compras: s === "compras",
    inventario: s === "inventario",
    cobranza: s === "cobranza",
    subsidios: s === "subsidios",
    saldos: s === "saldos",
    extras: s === "patrimonio",
  };
}

/** Lo que viene marcado al abrir la pantalla: lo que casi todos los comités tienen. Inventario y patrimonio se marcan a mano. */
export const SECCIONES_DEFECTO: SeccionRendicion[] = ["saldos", "ingresos", "egresos", "compras", "cobranza", "subsidios"];

const CLAVE_DE_SECCION: Record<Exclude<SeccionRendicion, "todo">, keyof ContenidoRendicion> = {
  saldos: "saldos",
  ingresos: "ingresos",
  egresos: "egresos",
  compras: "compras",
  cobranza: "cobranza",
  subsidios: "subsidios",
  inventario: "inventario",
  patrimonio: "extras",
};

/** Las partes del PDF y del Excel que corresponden a las secciones marcadas. «Saldos» lleva el cuadro de caja completo. */
export function contenidoDeSecciones(marcadas: SeccionRendicion[]): ContenidoRendicion {
  const c = { ingresos: false, egresos: false, compras: false, inventario: false, cobranza: false, subsidios: false, saldos: false, extras: false };
  for (const s of marcadas) if (s !== "todo") c[CLAVE_DE_SECCION[s]] = true;
  return c;
}

export function seccionesDeContenido(c: ContenidoRendicion): SeccionRendicion[] {
  return (Object.keys(CLAVE_DE_SECCION) as Exclude<SeccionRendicion, "todo">[]).filter((s) => c[CLAVE_DE_SECCION[s]]);
}

/** Las secciones marcadas según la dirección (?c=ingresos,egresos); sin dato, las de siempre. */
export function seccionesIniciales(c: string | undefined | null): SeccionRendicion[] {
  return c ? seccionesDeContenido(contenidoDeParametro(c)) : SECCIONES_DEFECTO;
}
