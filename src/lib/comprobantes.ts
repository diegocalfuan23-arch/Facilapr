/** Lo que comparten las acciones que guardan un comprobante: el límite de tamaño y la revisión del archivo. */

import { COMPROBANTE_MAX_BYTES } from "@/lib/comprobantes-comun";

export type TipoComprobante = "application/pdf" | "image/png" | "image/jpeg";

/** Los primeros bytes de cada tipo de archivo: no se confía en el tipo que declara el navegador. */
function tipoReal(b: Buffer): TipoComprobante | null {
  if (b.length >= 5 && b.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

export type ComprobanteLeido = { ok: true; nombre: string; tipo: TipoComprobante; tamano: number; contenido: string } | { ok: false; error: string };

/** Revisa un archivo subido (PDF, PNG o JPG de hasta 3 MB) y lo deja listo para guardar. */
export async function leerComprobante(archivo: File): Promise<ComprobanteLeido> {
  if (archivo.size > COMPROBANTE_MAX_BYTES) return { ok: false, error: "El archivo pesa más de 3 MB. Prueba con una versión más liviana." };
  const bytes = Buffer.from(await archivo.arrayBuffer());
  const tipo = tipoReal(bytes);
  if (!tipo) return { ok: false, error: "Solo se pueden adjuntar PDF, PNG o JPG." };
  const nombre = archivo.name.replace(/[\\/\r\n]+/g, " ").trim().slice(0, 120) || "Comprobante";
  return { ok: true, nombre, tipo, tamano: bytes.length, contenido: bytes.toString("base64") };
}

/** El archivo del formulario, si el usuario eligió uno. */
export function archivoDe(valor: FormDataEntryValue | null): File | null {
  return valor instanceof File && valor.size > 0 ? valor : null;
}
