import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createSecureContext } from "node:tls";

/**
 * Lo delicado de las boletas al SII: quién puede usarlas y cómo se guardan el certificado digital, su clave y los
 * folios. El certificado permite firmar a nombre de una persona: se guarda cifrado, nunca vuelve al navegador y
 * nunca se escribe en los registros.
 *
 * Variables de entorno (en Vercel; nunca en el código):
 *  - SII_COMITES: los comités que ven el módulo (sus enlaces separados por comas), o "todos". Vacío: ninguno.
 *  - CLAVE_CIFRADO_SII: texto largo al azar con el que se cifra todo lo anterior. Si cambia, hay que volver a subirlo.
 *  - SIMPLEAPI_KEY: la clave del proveedor que firma y envía los documentos.
 */

export function siiHabilitado(slug: string | null) {
  const lista = (process.env.SII_COMITES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return lista.includes("todos") || Boolean(slug && lista.includes(slug.toLowerCase()));
}

export const cifradoListo = () => (process.env.CLAVE_CIFRADO_SII?.trim().length ?? 0) >= 16;

function clave() {
  if (!cifradoListo()) throw new Error("Falta CLAVE_CIFRADO_SII.");
  return createHash("sha256").update(process.env.CLAVE_CIFRADO_SII!.trim()).digest();
}

/** AES-256-GCM: devuelve iv.etiqueta.cifrado en base64. */
export function cifrarSii(texto: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), datos].map((b) => b.toString("base64")).join(".");
}

export function descifrarSii(valor: string) {
  const [iv, etiqueta, datos] = valor.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", clave(), iv);
  d.setAuthTag(etiqueta);
  return Buffer.concat([d.update(datos), d.final()]).toString("utf8");
}

/**
 * Revisa que el archivo sea un certificado .pfx y que la clave lo abra. Los certificados con cifrado antiguo no se
 * pueden abrir aquí, pero la clave sí se comprueba antes de llegar a ese punto.
 */
export function revisarCertificado(pfx: Buffer, claveDelCertificado: string): { ok: true } | { ok: false; error: string } {
  try {
    createSecureContext({ pfx, passphrase: claveDelCertificado });
    return { ok: true };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "";
    if (/unsupported pkcs12/i.test(mensaje)) return { ok: true };
    if (/mac verify/i.test(mensaje)) return { ok: false, error: "La clave del certificado no es correcta." };
    return { ok: false, error: "Ese archivo no es un certificado digital (.pfx o .p12)." };
  }
}
