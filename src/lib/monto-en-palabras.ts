/** Un monto entero en pesos escrito con palabras («doscientos cuarenta y seis mil ochocientos veintiséis»), para el «Son: …» de una liquidación. */
const UNIDADES = [
  "", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince",
  "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco",
  "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function menorDeMil(x: number): string {
  if (x === 0) return "";
  if (x === 100) return "cien";
  const c = Math.floor(x / 100);
  const r = x % 100;
  const resto = r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : "");
  return [CENTENAS[c], resto].filter(Boolean).join(" ");
}

/** Antes de «mil» o «millones», «uno» pasa a «un» y «veintiuno» a «veintiún». */
const apocopar = (t: string) => t.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");

export function montoEnPalabras(monto: number): string {
  const n = Math.max(0, Math.floor(monto));
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "un millón" : `${apocopar(menorDeMil(millones))} millones`);
  if (miles) partes.push(miles === 1 ? "mil" : `${apocopar(menorDeMil(miles))} mil`);
  if (resto) partes.push(menorDeMil(resto));
  return partes.join(" ");
}
