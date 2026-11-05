import { BYTES_MAXIMOS_IMAGEN } from "@/lib/sitio-imagenes-comun";

/**
 * Reduce una foto en el navegador antes de subirla: la achica al lado máximo y la guarda como WebP,
 * bajando la calidad hasta que pese menos que el tope. Así el comité puede subir la foto del celular tal cual.
 */
export async function comprimirImagen(archivo: File, ladoMaximo: number): Promise<File> {
  if (!archivo.type.startsWith("image/")) throw new Error("Elige un archivo de imagen.");

  const bitmap = await createImageBitmap(archivo).catch(() => null);
  if (!bitmap) throw new Error("No pudimos leer esa imagen. Prueba con una JPG o PNG.");

  const factor = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.max(1, Math.round(bitmap.width * factor));
  const alto = Math.max(1, Math.round(bitmap.height * factor));

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no puede procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  for (const calidad of [0.85, 0.75, 0.65, 0.55, 0.45, 0.35]) {
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/webp", calidad));
    if (blob && blob.type === "image/webp" && blob.size <= BYTES_MAXIMOS_IMAGEN) {
      return new File([blob], "imagen.webp", { type: "image/webp" });
    }
  }
  throw new Error("La imagen sigue siendo muy pesada. Prueba con una más chica.");
}
