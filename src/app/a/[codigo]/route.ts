import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mensajesSocio } from "@/lib/db/schema";
import { direccionEnAlmacen, mensajeIdDeCodigo } from "@/lib/adjuntos";

/**
 * Un archivo del chat, a partir de su enlace firmado. Sin sesión, como el recibo: lo protege que el código es
 * imposible de adivinar. Así lo puede descargar también Meta para entregarlo por WhatsApp.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const noEncontrado = new Response("No encontrado.", { status: 404 });
  const { codigo } = await params;
  const id = mensajeIdDeCodigo(decodeURIComponent(codigo));
  if (!id) return noEncontrado;

  const mensaje = await db.query.mensajesSocio.findFirst({
    where: eq(mensajesSocio.id, id),
    columns: { adjuntoClave: true, adjuntoNombre: true, adjuntoTipo: true },
  });
  if (!mensaje?.adjuntoClave) return noEncontrado;

  const direccion = await direccionEnAlmacen(mensaje.adjuntoClave);
  if (!direccion) return noEncontrado;
  const archivo = await fetch(direccion, { cache: "no-store" });
  if (!archivo.ok || !archivo.body) return noEncontrado;

  const tipo = mensaje.adjuntoTipo ?? "application/octet-stream";
  // Solo se muestran en el navegador los tipos que no pueden ejecutar nada; lo demás se descarga.
  const enPantalla = /^(application\/pdf|image\/(png|jpeg|webp)|audio\/|video\/)/.test(tipo);
  const nombre = mensaje.adjuntoNombre ?? "archivo";

  return new Response(archivo.body, {
    headers: {
      "content-type": tipo,
      "content-disposition": `${enPantalla ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
