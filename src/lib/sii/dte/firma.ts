import { createHash, createPrivateKey, createPublicKey, createSign, X509Certificate } from "node:crypto";
import { enLineas } from "@/lib/sii/dte/xml";

/**
 * Firma XML (XMLDSig, RSA-SHA1, como la exige el SII) con el certificado digital del representante. Trabaja sobre el
 * XML que escribe este mismo motor, que ya sale en forma canónica: canonizar es solo agregar al primer elemento los
 * espacios de nombres que hereda. La forma canónica se mide en UTF-8, aunque el archivo se envíe en ISO-8859-1.
 */

export type Firmante = {
  /** PEM. */
  llave: string;
  /** PEM. */
  certificado: string;
};

const NS_FIRMA = "http://www.w3.org/2000/09/xmldsig#";
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";

/** El elemento tal como lo ve la canonización: con los espacios de nombres heredados en su etiqueta de apertura. */
function canonico(elemento: string, espacios: string) {
  const fin = elemento.search(/[\s>]/);
  return `${elemento.slice(0, fin)} ${espacios}${elemento.slice(fin)}`;
}

/**
 * La `<Signature>` de un elemento con atributo `ID`.
 * @param heredados Las declaraciones `xmlns` vigentes sobre ese elemento, la por defecto primero.
 */
export function firmar(elemento: string, id: string, firmante: Firmante, heredados: string[]) {
  const resumen = createHash("sha1").update(canonico(elemento, heredados.join(" ")), "utf8").digest("base64");

  const info = `<SignedInfo><CanonicalizationMethod Algorithm="${C14N}"></CanonicalizationMethod><SignatureMethod Algorithm="${NS_FIRMA}rsa-sha1"></SignatureMethod><Reference URI="#${id}"><Transforms><Transform Algorithm="${C14N}"></Transform></Transforms><DigestMethod Algorithm="${NS_FIRMA}sha1"></DigestMethod><DigestValue>${resumen}</DigestValue></Reference></SignedInfo>`;
  // Dentro de <Signature> el espacio por defecto pasa a ser el de la firma; los demás heredados se mantienen.
  const dentro = [`xmlns="${NS_FIRMA}"`, ...heredados.filter((h) => !h.startsWith("xmlns="))].join(" ");
  const valor = createSign("RSA-SHA1").update(canonico(info, dentro), "utf8").sign(createPrivateKey(firmante.llave), "base64");

  const publica = createPublicKey(firmante.certificado).export({ format: "jwk" });
  const normal = (base64url: string) => Buffer.from(base64url, "base64url").toString("base64");
  const certificado = new X509Certificate(firmante.certificado).raw.toString("base64");

  return `<Signature xmlns="${NS_FIRMA}">${info}<SignatureValue>\n${enLineas(valor)}\n</SignatureValue><KeyInfo><KeyValue><RSAKeyValue><Modulus>\n${enLineas(
    normal(publica.n!)
  )}\n</Modulus><Exponent>${normal(publica.e!)}</Exponent></RSAKeyValue></KeyValue><X509Data><X509Certificate>\n${enLineas(
    certificado
  )}\n</X509Certificate></X509Data></KeyInfo></Signature>`;
}
