import { generateKeyPairSync } from "node:crypto";
import forge from "node-forge";
import type { Firmante } from "@/lib/sii/dte/firma";
import { abrirCaf } from "@/lib/sii/dte/timbre";

/**
 * Folios y certificado inventados para ver una boleta de muestra sin gastar folios reales ni firmar nada que pueda
 * valer. El SII no los reconoce.
 */

const llaves = (bits: number) => generateKeyPairSync("rsa", { modulusLength: bits });

export function foliosDePrueba(rut: string, tipo: number) {
  const { privateKey, publicKey } = llaves(1024);
  const jwk = publicKey.export({ format: "jwk" });
  const base64 = (x: string) => Buffer.from(x, "base64url").toString("base64");
  return abrirCaf(
    `<AUTORIZACION><CAF version="1.0"><DA><RE>${rut}</RE><RS>FOLIOS DE PRUEBA</RS><TD>${tipo}</TD><RNG><D>1</D><H>1</H></RNG><FA>2026-01-01</FA><RSAPK><M>${base64(jwk.n!)}</M><E>${base64(jwk.e!)}</E></RSAPK><IDK>100</IDK></DA><FRMA algoritmo="SHA1withRSA">UFJVRUJB</FRMA></CAF><RSASK>${privateKey.export({ type: "pkcs1", format: "pem" })}</RSASK></AUTORIZACION>`
  )!;
}

/** Un certificado propio que dura un día. */
export function certificadoDePrueba(): Firmante {
  const { privateKey, publicKey } = llaves(2048);
  const llave = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
  const certificado = forge.pki.createCertificate();
  certificado.publicKey = forge.pki.publicKeyFromPem(publicKey.export({ type: "spki", format: "pem" }).toString());
  certificado.serialNumber = "01";
  certificado.validity.notBefore = new Date();
  certificado.validity.notAfter = new Date(Date.now() + 86_400_000);
  const nombre = [{ name: "commonName", value: "Prueba Facilapr" }];
  certificado.setSubject(nombre);
  certificado.setIssuer(nombre);
  certificado.sign(forge.pki.privateKeyFromPem(llave), forge.md.sha256.create());
  return { llave, certificado: forge.pki.certificateToPem(certificado) };
}
