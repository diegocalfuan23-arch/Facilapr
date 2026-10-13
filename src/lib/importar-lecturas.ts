import { normalizarRut } from "@/lib/formato";

/**
 * Lecturas en bloque desde una planilla. Dos usos:
 *  - "inicial": la lectura de partida de cada medidor (sin boleta), para que la
 *    primera boleta cobre solo el consumo del mes y no el medidor completo.
 *  - "mensual": las lecturas del mes, de arranques que ya tienen una anterior;
 *    de ahí sale el consumo (lectura - anterior) y el monto a cobrar.
 * La planilla trae, por cada arranque, cómo identificarlo (N.º, nombre o RUT) y
 * su lectura. Lógica pura: corre igual en el servidor y se prueba sin base.
 */

export type ModoLecturas = "inicial" | "mensual";

export type FilaLectura = {
  linea: number;
  numero: string;
  nombre: string;
  rut: string;
  tipo: string;
  valor: string;
};

export type CuentaRef = {
  id: string;
  nombre: string;
  rut: string | null;
  tipo: "SOCIO" | "USUARIO";
  numeroCliente: string | null;
  /** Ya tiene al menos una lectura aprobada: entonces esta no sería la inicial. */
  tieneLecturas: boolean;
  /** Su última lectura aprobada (la base del consumo); null si no tiene. */
  anterior: number | null;
  /** Ya hay una lectura pendiente suya en el período que se está cargando. */
  pendienteEnPeriodo: boolean;
};

export type LecturaResuelta = {
  linea: number;
  /** Cómo la identificó la planilla, para mostrarla ("N.º 3", "Aedo Bernardo"). */
  referencia: string;
  valor: number | null;
  socioId: string | null;
  /** El nombre del arranque encontrado, para que se vea a quién corresponde. */
  nombre: string | null;
  /** Solo en modo mensual: la lectura anterior y los m³ que resultan. */
  anterior: number | null;
  consumo: number | null;
  error: string | null;
};

const sinTildes = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** El nombre reducido a letras y números, para reconocer al mismo arranque aunque esté escrito distinto. */
const claveNombre = (t: string) => sinTildes(t).replace(/[^a-z0-9]/g, "");

const NOMBRE_MES =
  "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept|sep|set|oct|nov|dic";
const NUMERO_MES: Record<string, number> = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4, mayo: 5, may: 5,
  junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8, septiembre: 9, setiembre: 9, sept: 9, sep: 9, set: 9,
  octubre: 10, oct: 10, noviembre: 11, nov: 11, diciembre: 12, dic: 12,
};

/**
 * El mes al que se refiere un texto de encabezado: «agosto», «Lectura agosto 2026»,
 * «2026-08» o «08/2026». Sin año, se toma el último agosto que ya pasó (o el actual).
 * Devuelve «AAAA-MM», o null si el texto no habla de ningún mes.
 */
export function periodoDeTexto(texto: string, ahora = new Date()): string | null {
  const t = sinTildes(texto);
  let m = t.match(/(20\d{2})\s*[-\/.]\s*(0?[1-9]|1[0-2])\b/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = t.match(/\b(0?[1-9]|1[0-2])\s*[-\/.]\s*(20\d{2})\b/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;

  const palabra = t.match(new RegExp(`\\b(${NOMBRE_MES})\\b`));
  if (!palabra) return null;
  const mes = NUMERO_MES[palabra[1]];
  const conAnio = t.match(/\b(20\d{2})\b/);
  let anio = conAnio ? Number(conAnio[1]) : ahora.getFullYear();
  if (!conAnio && mes > ahora.getMonth() + 1) anio -= 1;
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

const esLectura = (c: string) =>
  /lectura|medidor/.test(sinTildes(c)) || new RegExp(`^(${NOMBRE_MES})\\b`).test(sinTildes(c));
const esNumero = (c: string) =>
  /^(n|no|nro|num|numero)\.?$|n\.?\s*[°º]|numero|arranque|cliente/.test(sinTildes(c));
const esNombre = (c: string) => /\bnombres?\b/.test(sinTildes(c));
const esRut = (c: string) => /\b(rut|run)\b/.test(sinTildes(c));
const esTipo = (c: string) => /^tipo$/.test(sinTildes(c));

export type DeteccionLecturas =
  | { ok: true; filas: FilaLectura[]; notas: string[]; periodoDetectado: string | null }
  | { ok: false; error: string };

export function detectarLecturas(tabla: string[][]): DeteccionLecturas {
  const limite = Math.min(tabla.length, 30);
  let fila = -1;
  for (let r = 0; r < limite; r++) {
    const celdas = tabla[r].filter(Boolean);
    const tieneLectura = celdas.some(esLectura);
    const tieneIdentificador = celdas.some(
      (c) => esNumero(c) || esNombre(c) || esRut(c)
    );
    if (tieneLectura && tieneIdentificador) {
      fila = r;
      break;
    }
  }

  if (fila < 0) {
    return {
      ok: false,
      error:
        "No encontré los encabezados. Necesito una columna «Lectura» y otra que identifique el arranque: «N.º», «Nombre» o «RUT».",
    };
  }

  const enc = tabla[fila];
  const col = (cond: (c: string) => boolean) => enc.findIndex((c) => c && cond(c));
  // Si hay varias columnas de lectura (p. ej. «agosto» y «julio»), vale la del mes más reciente.
  const candidatas = enc.flatMap((c, i) => (c && esLectura(c) ? [i] : []));
  const cLectura =
    candidatas.length > 1
      ? candidatas.reduce((mejor, i) =>
          (periodoDeTexto(enc[i]) ?? "") > (periodoDeTexto(enc[mejor]) ?? "") ? i : mejor
        )
      : col(esLectura);
  const cNumero = col(esNumero);
  const cNombre = col(esNombre);
  const cRut = col(esRut);
  const cTipo = col(esTipo);

  const celda = (r: number, c: number) =>
    c >= 0 ? (tabla[r]?.[c] ?? "").replace(/\s+/g, " ").trim() : "";

  const filas: FilaLectura[] = [];
  let sinLectura = 0;
  for (let r = fila + 1; r < tabla.length; r++) {
    const f: FilaLectura = {
      linea: r + 1,
      numero: celda(r, cNumero).replace(/\.0$/, ""),
      nombre: celda(r, cNombre),
      rut: celda(r, cRut),
      tipo: celda(r, cTipo),
      valor: celda(r, cLectura),
    };
    if (!f.numero && !f.nombre && !f.rut && !f.valor) continue;
    // Un medidor que no se leyó se deja en blanco: se ignora, no es un error.
    if (!f.valor) {
      sinLectura++;
      continue;
    }
    filas.push(f);
  }

  if (filas.length === 0) {
    return {
      ok: false,
      error: "Encontré los encabezados, pero no hay ninguna fila con lectura.",
    };
  }

  const por = [
    cNumero >= 0 ? "N.º" : null,
    cNombre >= 0 ? "nombre" : null,
    cRut >= 0 ? "RUT" : null,
  ].filter(Boolean);
  // El mes: del encabezado de la columna de lectura, de otro encabezado o de las filas de arriba.
  const donde = [enc[cLectura], ...enc, ...[1, 2, 3].flatMap((k) => (fila - k >= 0 ? tabla[fila - k] : []))];
  const periodoDetectado = donde.reduce<string | null>((p, texto) => p ?? (texto ? periodoDeTexto(texto) : null), null);

  return {
    ok: true,
    filas,
    periodoDetectado,
    notas: [
      `Encontré los encabezados en la fila ${fila + 1}: lectura, e identifico cada arranque por ${por.join(", ")}.`,
      ...(sinLectura > 0
        ? [`${sinLectura} filas no traen lectura: las ignoré.`]
        : []),
    ],
  };
}

/** "1.250" → 1250; "1250,5" → 1250 (un medidor se lee en m³ enteros). */
function leerValor(texto: string): number | null {
  const t = texto.trim().split(",")[0].replace(/\./g, "");
  return /^\d{1,9}$/.test(t) ? Number(t) : null;
}

export function resolverLecturas(
  filas: FilaLectura[],
  cuentas: CuentaRef[],
  modo: ModoLecturas = "inicial"
): LecturaResuelta[] {
  const vistos = new Set<string>();

  return filas.map((f) => {
    const referencia = f.numero
      ? `N.º ${f.numero}`
      : f.nombre || (f.rut ? `RUT ${f.rut}` : "—");
    const base = {
      linea: f.linea,
      referencia,
      valor: null,
      socioId: null,
      nombre: null,
      anterior: null,
      consumo: null,
    };
    const mal = (error: string): LecturaResuelta => ({ ...base, error });

    const valor = leerValor(f.valor);
    if (valor === null) return mal(`Lectura inválida: «${f.valor || "vacía"}»`);

    const tipo = /usuario/i.test(f.tipo) ? "USUARIO" : /socio/i.test(f.tipo) ? "SOCIO" : null;
    const delTipo = (c: CuentaRef) => !tipo || c.tipo === tipo;

    let candidatos: CuentaRef[] = [];
    let criterio = "";

    if (f.numero) {
      criterio = `el N.º ${f.numero}`;
      candidatos = cuentas.filter((c) => c.numeroCliente === f.numero && delTipo(c));
      if (candidatos.length > 1) {
        return mal(
          `Hay un socio y un usuario con el N.º ${f.numero}: agrega una columna «Tipo» (socio o usuario)`
        );
      }
    } else if (f.nombre) {
      criterio = `el nombre «${f.nombre}»`;
      // Se comparan sin tildes, mayúsculas, espacios ni signos: «N°1», «Nº 1» y «N.º1» son el mismo nombre.
      const n = claveNombre(f.nombre);
      candidatos = cuentas.filter((c) => claveNombre(c.nombre) === n && delTipo(c));
      if (candidatos.length > 1) {
        return mal(`Hay ${candidatos.length} arranques con el nombre «${f.nombre}»: usa el N.º`);
      }
    } else if (f.rut) {
      criterio = `el RUT ${f.rut}`;
      const r = normalizarRut(f.rut);
      candidatos = cuentas.filter((c) => c.rut === r && delTipo(c));
      if (candidatos.length > 1) {
        return mal(`El RUT ${f.rut} tiene ${candidatos.length} arranques: usa el N.º o el nombre`);
      }
    } else {
      return mal("Falta el N.º, el nombre o el RUT para saber de qué arranque es");
    }

    if (candidatos.length === 0) return mal(`No hay un arranque con ${criterio}`);

    const cuenta = candidatos[0];
    const resuelta = {
      ...base,
      valor,
      socioId: cuenta.id,
      nombre: cuenta.nombre,
      anterior: modo === "mensual" ? cuenta.anterior : null,
    };

    if (vistos.has(cuenta.id)) {
      return { ...resuelta, error: "Repetida en el archivo: este arranque ya aparece arriba" };
    }
    vistos.add(cuenta.id);

    if (modo === "inicial") {
      if (cuenta.tieneLecturas) {
        return { ...resuelta, error: "Ya tiene lecturas aprobadas: esta no sería la inicial" };
      }
      return { ...resuelta, error: null };
    }

    // Lectura del mes: necesita una anterior para saber cuántos m³ se consumieron.
    if (cuenta.anterior === null) {
      return {
        ...resuelta,
        error: "Es su primera lectura: cárgala como lectura inicial (así no se cobra el medidor completo)",
      };
    }
    if (valor < cuenta.anterior) {
      return {
        ...resuelta,
        error: `Es menor que la anterior (${cuenta.anterior}): ¿medidor nuevo o error de digitación?`,
      };
    }
    if (cuenta.pendienteEnPeriodo) {
      return { ...resuelta, error: "Ya tiene una lectura pendiente de este período" };
    }

    return { ...resuelta, consumo: valor - cuenta.anterior, error: null };
  });
}
