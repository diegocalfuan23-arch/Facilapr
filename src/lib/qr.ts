import QRCode from "qrcode";

const memoria = new Map<string, string>();

/** Un código QR como imagen (data URL PNG). Se recuerda por dirección: un talonario repite el mismo código en cada recibo. */
export async function qrComoImagen(url: string) {
  const guardado = memoria.get(url);
  if (guardado) return guardado;
  const imagen = await QRCode.toDataURL(url, { margin: 1, width: 280, errorCorrectionLevel: "M" });
  memoria.set(url, imagen);
  return imagen;
}
