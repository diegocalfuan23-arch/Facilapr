import { normalizarRut, normalizarTelefono, rutValido } from "@/lib/formato";

/**
 * Importar el padrón desde una planilla "tal como la tiene el comité": con
 * títulos arriba, varias tablas lado a lado (socios y usuarios), columnas en
 * cualquier orden. Aquí está la lógica pura (sin base de datos) para que corra
 * igual en el servidor y en la pantalla de revisión, donde la directiva corrige
 * filas y el resultado se vuelve a validar al instante.
 *
 * Cada fila es una CUENTA COBRABLE (un arranque con su medidor). Una persona
 * con dos arranques son dos filas con el mismo RUT; un usuario (no socio, pero
 * que también paga) puede no tener RUT.
 */

export type TipoCuenta = "SOCIO" | "USUARIO";

export type FilaSocio = {
  /** Identificador estable dentro de la revisión (no es el de la base). */
  id: string;
  /** Fila del archivo, para ubicarla ("fila 12"). */
  linea: number;
  tipo: TipoCuenta;
  nombre: string;
  rut: string;
  telefono: string;
  direccion: string;
  numeroCliente: string;
  /** Uso del agua según el archivo; vacío si no trae esa columna (no se toca el que ya tenía). */
  uso: "RESIDENCIAL" | "COMERCIAL" | "";
};

/** Lo que ya hay en el padrón, para detectar "ya existe". */
export type Existente = {
  id: string;
  tipo: TipoCuenta;
  numeroCliente: string | null;
  rut: string | null;
  nombre: string;
  activo: boolean;
};

export type Veredicto = {
  /** Bloquean la importación de esa fila hasta corregirla o excluirla. */
  errores: string[];
  /** Avisan, pero no bloquean. */
  avisos: string[];
  accion: "crear" | "actualizar";
  /** Si actualiza, a quién (id de la base). */
  existenteId: string | null;
};

export type Deteccion =
  | { ok: true; filas: FilaSocio[]; notas: string[] }
  | { ok: false; error: string };

const sinTildes = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const limpiar = (t: string | undefined) => (t ?? "").replace(/\s+/g, " ").trim();

const esRut = (c: string) => /\b(rut|run)\b/.test(sinTildes(c));
const esNombre = (c: string) => /\bnombres?\b/.test(sinTildes(c)) && !esRut(c);
const esTelefono = (c: string) =>
  /\b(tel|telefono|fono|celular|movil|whatsapp)\b|telef/.test(sinTildes(c));
const esDireccion = (c: string) =>
  /direcc|domicilio|parcela|sector|calle/.test(sinTildes(c));
const esNumero = (c: string) =>
  /^(n|no|nro|num|numero)\.?$|^n\.?\s*[°º]\.?$|n\.?\s*[°º]\s*(cliente|arranque)|numero|arranque\s*n|n\s*cliente/.test(
    sinTildes(c)
  );

const PATRON_RUT = /^\d{1,2}(\.?\d{3}){2}-?[\dkK]$/;

/** A, B, … Z, AA: la letra de columna como la ve el usuario en Excel. */
function letraColumna(indice: number) {
  let n = indice;
  let letra = "";
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

/** La clave que identifica a una cuenta: su N.º de arranque, o si no hay, quién es. */
export function claveCuenta(
  tipo: TipoCuenta,
  numeroCliente: string | null | undefined,
  rut: string | null | undefined,
  nombre: string
) {
  const numero = (numeroCliente ?? "").trim();
  if (numero) return `${tipo}|#${numero}`;
  // El nombre se reduce a letras y números: «N°1», «Nº 1» y «N.º1» son el mismo, y así no se duplica un socio por un signo.
  return `${tipo}|${rut ? normalizarRut(rut) : ""}|${sinTildes(limpiar(nombre)).replace(/[^a-z0-9]/g, "")}`;
}

/**
 * Busca dónde están los socios (y los usuarios) dentro de una tabla de filas de
 * texto. Toma la primera fila con encabezados ("Nombre…", "RUT"), y por cada
 * columna de nombre arma una tabla con lo que tenga a su derecha: RUT, teléfono,
 * dirección y N.º. El tipo (socio o usuario) sale de los títulos.
 */
/** «Comercial», «comercio»… → COMERCIAL; «residencial», «domiciliario»… → RESIDENCIAL; lo demás, sin dato. */
function usoDeTexto(valor: string): FilaSocio["uso"] {
  const v = sinTildes(valor);
  if (/comerc/.test(v)) return "COMERCIAL";
  if (/resid|domicil|casa|particular/.test(v)) return "RESIDENCIAL";
  return "";
}

export function detectarSocios(tabla: string[][]): Deteccion {
  const limite = Math.min(tabla.length, 30);
  let filaEncabezado = -1;
  for (let r = 0; r < limite; r++) {
    if (tabla[r].some((c) => c && (esNombre(c) || esRut(c)))) {
      filaEncabezado = r;
      break;
    }
  }

  if (filaEncabezado < 0) {
    return {
      ok: false,
      error:
        "No encontré los encabezados. Revisa que el archivo tenga una fila con «Nombre» y «RUT» cerca de la parte de arriba.",
    };
  }

  const encabezado = tabla[filaEncabezado];
  const ancho = Math.max(...tabla.map((f) => f.length), encabezado.length);

  // Una columna de nombre por tabla; sin ninguna, la que está pegada al RUT.
  let inicios = encabezado
    .map((c, i) => (c && esNombre(c) ? i : -1))
    .filter((i) => i >= 0);
  if (inicios.length === 0) {
    const colRut = encabezado.findIndex((c) => c && esRut(c));
    inicios = [Math.max(0, colRut - 1)];
  }

  const datos = tabla.slice(filaEncabezado + 1);
  const celda = (r: number, c: number) => limpiar(tabla[r]?.[c]);

  // ¿La columna, sin título, es una numeración 1, 2, 3…? (el N.º de arranque)
  const esNumeracion = (c: number) => {
    if (c < 0 || limpiar(encabezado[c])) return false;
    const muestra = datos
      .slice(0, 10)
      .map((f) => limpiar(f[c]))
      .filter(Boolean);
    return muestra.length > 0 && muestra.every((v) => /^\d+(\.0)?$/.test(v));
  };

  // ¿La columna trae RUT aunque no tenga título?
  const traeRut = (c: number) => {
    if (c < 0 || c >= ancho) return false;
    return datos.slice(0, 40).some((f) => PATRON_RUT.test(limpiar(f[c])));
  };

  const notas: string[] = [];
  const filas: FilaSocio[] = [];
  const conteo: Record<TipoCuenta, number> = { SOCIO: 0, USUARIO: 0 };

  inicios.forEach((inicio, t) => {
    const siguiente = inicios[t + 1];
    // La numeración de la tabla siguiente puede quedar a la izquierda de su nombre.
    const numeracionSiguiente =
      siguiente !== undefined && esNumeracion(siguiente - 1) ? siguiente - 1 : -1;
    const fin = siguiente !== undefined ? (numeracionSiguiente >= 0 ? numeracionSiguiente : siguiente) : ancho;

    const enRegion = (cond: (c: string) => boolean) => {
      for (let c = inicio + 1; c < fin; c++) {
        if (encabezado[c] && cond(encabezado[c])) return c;
      }
      return -1;
    };

    let colRut = enRegion(esRut);
    if (colRut < 0 && inicio + 1 < fin && traeRut(inicio + 1)) colRut = inicio + 1;
    const colTelefono = enRegion(esTelefono);
    const colUso = enRegion((c) => /^(uso|categoria)/.test(sinTildes(c)));
    const colDireccion = enRegion(esDireccion);
    let colNumero = enRegion(esNumero);
    if (
      colNumero < 0 &&
      inicio > 0 &&
      (esNumero(encabezado[inicio - 1] ?? "") || esNumeracion(inicio - 1))
    ) {
      colNumero = inicio - 1;
    }

    // El tipo sale del título de la tabla (la fila de arriba) y del encabezado.
    const titulo = sinTildes(
      [encabezado[inicio], celda(filaEncabezado - 1, inicio), celda(filaEncabezado - 1, colRut)]
        .filter(Boolean)
        .join(" ")
    );
    const tipo: TipoCuenta = /usuario/.test(titulo) ? "USUARIO" : "SOCIO";

    let cuantas = 0;
    for (let r = filaEncabezado + 1; r < tabla.length; r++) {
      const nombre = celda(r, inicio);
      const rut = colRut >= 0 ? celda(r, colRut) : "";

      if (!nombre && !rut) continue;
      // Filas de cierre que no son cuentas ("TOTAL", "Total socios: 66").
      if (/^total/.test(sinTildes(nombre))) continue;

      const numero = colNumero >= 0 ? celda(r, colNumero).replace(/\.0$/, "") : "";

      filas.push({
        id: `t${t}-${r}`,
        linea: r + 1,
        tipo,
        nombre,
        rut,
        telefono: colTelefono >= 0 ? celda(r, colTelefono) : "",
        direccion: colDireccion >= 0 ? celda(r, colDireccion) : "",
        numeroCliente: numero,
        uso: colUso >= 0 ? usoDeTexto(celda(r, colUso)) : "",
      });
      cuantas++;
    }

    conteo[tipo] += cuantas;
    const columnas = [`nombre (${letraColumna(inicio)})`];
    if (colRut >= 0) columnas.push(`RUT (${letraColumna(colRut)})`);
    else columnas.push("sin columna de RUT");
    if (colTelefono >= 0) columnas.push(`teléfono (${letraColumna(colTelefono)})`);
    if (colDireccion >= 0) columnas.push(`dirección (${letraColumna(colDireccion)})`);
    if (colNumero >= 0) columnas.push(`N.º (${letraColumna(colNumero)})`);
    if (colUso >= 0) columnas.push(`uso (${letraColumna(colUso)})`);
    notas.push(
      `${tipo === "USUARIO" ? "Usuarios" : "Socios"}: ${cuantas} filas. Columnas: ${columnas.join(", ")}.`
    );
  });

  notas.unshift(`Encontré los encabezados en la fila ${filaEncabezado + 1}.`);

  if (filas.length === 0) {
    return {
      ok: false,
      error: "Encontré los encabezados, pero no hay filas debajo de ellos.",
    };
  }

  return { ok: true, filas, notas };
}

/**
 * Valida las filas en orden. Una cuenta repetida (mismo N.º de arranque, o misma
 * persona y nombre si no hay número) se marca en la segunda aparición: la
 * primera queda válida, así excluir una resuelve la otra. Repetir un RUT NO es
 * un error: es la misma persona con otro arranque.
 */
export function validarFilas(
  filas: Pick<FilaSocio, "tipo" | "nombre" | "rut" | "telefono" | "numeroCliente" | "linea">[],
  existentes: Existente[]
): Veredicto[] {
  const existentePorClave = new Map(
    existentes.map((e) => [claveCuenta(e.tipo, e.numeroCliente, e.rut, e.nombre), e])
  );
  const clavesVistas = new Map<string, number>(); // clave → fila donde apareció
  const rutsVistos = new Map<string, number>();

  return filas.map((f) => {
    const errores: string[] = [];
    const avisos: string[] = [];

    const nombre = f.nombre.trim();
    const rut = f.rut.trim() ? normalizarRut(f.rut) : "";
    const telefono = f.telefono.trim() ? normalizarTelefono(f.telefono) : "";

    if (!nombre) errores.push("Falta el nombre");

    if (!rut) {
      avisos.push(
        f.tipo === "USUARIO"
          ? "Sin RUT"
          : "Sin RUT: no podrá pedir acceso al portal hasta que lo tenga"
      );
    } else if (!/^\d{6,8}-[\dK]$/.test(rut)) {
      errores.push("El RUT no tiene un formato válido");
    } else {
      if (!rutValido(rut)) {
        avisos.push("El dígito verificador del RUT no calza: revísalo");
      }
      const antes = rutsVistos.get(rut);
      if (antes !== undefined) {
        avisos.push(`Mismo RUT que la fila ${antes}: otro arranque de la misma persona`);
      } else {
        rutsVistos.set(rut, f.linea);
      }
    }

    if (telefono && !/^\+\d{8,15}$/.test(telefono)) {
      errores.push("Teléfono inválido");
    }

    const clave = claveCuenta(f.tipo, f.numeroCliente, rut, nombre);
    const antes = clavesVistas.get(clave);
    if (antes !== undefined) {
      errores.push(
        f.numeroCliente.trim()
          ? `El N.º ${f.numeroCliente.trim()} ya está en la fila ${antes}`
          : `Fila repetida (igual a la ${antes})`
      );
    } else {
      clavesVistas.set(clave, f.linea);
    }

    const existente = existentePorClave.get(clave) ?? null;
    if (existente) avisos.push("Ya está en tu padrón: se actualizarán sus datos");

    // Mismo N.º pero otra persona: casi siempre es una numeración que cambió, y
    // actualizar pisaría el nombre de alguien que ya no corresponde.
    if (
      existente &&
      f.numeroCliente.trim() &&
      sinTildes(limpiar(existente.nombre)) !== sinTildes(limpiar(nombre))
    ) {
      avisos.push(`Hoy ese N.º es «${existente.nombre}»: se le cambiará el nombre`);
    }

    return {
      errores,
      avisos,
      accion: existente ? "actualizar" : "crear",
      existenteId: existente?.id ?? null,
    };
  });
}
