import { X509Certificate } from "node:crypto";
import forge from "node-forge";
import type { Firmante } from "@/lib/sii/dte/firma";

/**
 * Abre el certificado digital del representante (.pfx o .p12) y saca su llave y su certificado para firmar. Lo que
 * devuelve permite firmar a nombre de esa persona: no se guarda así, no sale del servidor y no se registra.
 */

export type CertificadoAbierto =
  | { ok: true; firmante: Firmante; titular: string; rut: string | null; vence: Date; vigente: boolean }
  | { ok: false; error: string };

export function abrirCertificado(pfx: Buffer, clave: string): CertificadoAbierto {
  let contenedor: forge.pkcs12.Pkcs12Pfx;
  try {
    contenedor = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.createBuffer(pfx.toString("binary"))), false, clave);
  } catch (e) {
    // El mensaje de la librería no se muestra ni se registra: solo se distingue la clave mala.
    const mala = e instanceof Error && /password|mac/i.test(e.message);
    return { ok: false, error: mala ? "La clave del certificado no es correcta." : "Ese archivo no es un certificado digital que se pueda abrir." };
  }

  const bolsas = (oid: string) => contenedor.getBags({ bagType: oid })[oid] ?? [];
  const llaves = [...bolsas(forge.pki.oids.pkcs8ShroudedKeyBag), ...bolsas(forge.pki.oids.keyBag)].flatMap((b) =>
    b.key ? [b.key as forge.pki.rsa.PrivateKey] : []
  );
  const certificados = bolsas(forge.pki.oids.certBag).flatMap((b) => (b.cert ? [b.cert] : []));

  for (const llave of llaves) {
    // El archivo suele traer también los certificados de la entidad que lo emitió: sirve el que calza con la llave.
    const propio = certificados.find((c) => (c.publicKey as forge.pki.rsa.PublicKey).n.equals(llave.n));
    if (!propio) continue;

    const certificado = forge.pki.certificateToPem(propio);
    const leido = new X509Certificate(certificado);
    const vence = new Date(leido.validTo);
    // Los certificados chilenos traen el RUT del titular en el «nombre alternativo».
    const alterno = propio.getExtension("subjectAltName") as { value?: string } | null;
    const rut = alterno?.value?.match(/\d{7,8}-[\dkK]/)?.[0] ?? (propio.subject.getField({ name: "serialNumber" })?.value as string | undefined) ?? null;

    return {
      ok: true,
      firmante: { llave: forge.pki.privateKeyToPem(llave), certificado },
      titular: forge.util.decodeUtf8(String(propio.subject.getField("CN")?.value ?? "")),
      rut: rut?.toUpperCase() ?? null,
      vence,
      vigente: new Date(leido.validFrom).getTime() <= Date.now() && vence.getTime() > Date.now(),
    };
  }
  return { ok: false, error: "El archivo no trae una llave RSA con su certificado." };
}
