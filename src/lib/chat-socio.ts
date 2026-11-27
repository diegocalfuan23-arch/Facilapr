import { asc, eq } from "drizzle-orm";
import { entregarPorWhatsappSiCorresponde } from "@/lib/whatsapp-salida";
import { db } from "@/lib/db";
import { mensajesSocio, socios } from "@/lib/db/schema";
import { publicarActividadComite, publicarMensajeEnVivo } from "@/lib/chat/tiempo-real";
import { adjuntoDeFila, type ArchivoGuardado } from "@/lib/adjuntos";
import type { Adjunto } from "@/lib/adjuntos-comun";

export type MensajeChat = {
  id: string;
  remitente: "SOCIO" | "DIRECTIVA" | "IA";
  contenido: string;
  createdAt: Date;
  /** Solo en mensajes de la IA: pasó la conversación a una persona. */
  requiereHumano?: boolean;
  /** La otra parte ya lo leyó (solo importa en mensajes de SOCIO y DIRECTIVA). */
  leido?: boolean;
  /** La directiva corrigió el texto después de enviarlo. */
  editado?: boolean;
  /** Por dónde llegó o salió: el portal o el WhatsApp del comité. */
  canal?: "PORTAL" | "WHATSAPP";
  /** Solo en lo que salió por WhatsApp y no llegó: FALLIDA o FUERA_DE_VENTANA (pasaron 24 h). */
  entrega?: "FALLIDA" | "FUERA_DE_VENTANA" | null;
  /** El archivo del mensaje, si tiene. */
  adjunto?: Adjunto | null;
};

export async function historialChat(socioId: string): Promise<MensajeChat[]> {
  const filas = await db.query.mensajesSocio.findMany({
    where: eq(mensajesSocio.socioId, socioId),
    orderBy: [asc(mensajesSocio.createdAt)],
    limit: 200,
    columns: {
      id: true,
      remitente: true,
      contenido: true,
      createdAt: true,
      requiereHumano: true,
      leidoPorSocio: true,
      leidoPorDirectiva: true,
      editadoAt: true,
      canal: true,
      entrega: true,
      adjuntoClave: true,
      adjuntoNombre: true,
      adjuntoTipo: true,
      adjuntoTamano: true,
    },
  });

  return filas.map(({ leidoPorSocio, leidoPorDirectiva, editadoAt, adjuntoClave, adjuntoNombre, adjuntoTipo, adjuntoTamano, ...m }) => ({
    ...m,
    adjunto: adjuntoDeFila({ id: m.id, adjuntoClave, adjuntoNombre, adjuntoTipo, adjuntoTamano }),
    editado: editadoAt !== null,
    // Lo que escribió el socio lo lee la directiva, y al revés.
    leido: m.remitente === "SOCIO" ? leidoPorDirectiva : leidoPorSocio,
  }));
}

/**
 * Guarda el mensaje y lo publica en el canal del socio. Si la publicación en
 * vivo falla no se pierde nada: el mensaje ya quedó guardado y aparecerá igual la próxima vez que alguien
 * cargue el historial.
 */
export async function enviarMensajeChat({
  socioId,
  remitente,
  autorId,
  contenido,
  requiereHumano = false,
  canal = "PORTAL",
  metaId,
  archivo,
}: {
  socioId: string;
  remitente: "SOCIO" | "DIRECTIVA" | "IA";
  autorId: string | null;
  contenido: string;
  requiereHumano?: boolean;
  /** Solo para lo que llega por WhatsApp. Lo que escribe la directiva o la IA sale por donde escribió el socio. */
  canal?: "PORTAL" | "WHATSAPP";
  metaId?: string;
  /** El archivo que va con el mensaje; ya guardado (o un documento que genera Facilapr). */
  archivo?: ArchivoGuardado;
}): Promise<MensajeChat> {
  const [mensaje] = await db
    .insert(mensajesSocio)
    .values({
      socioId,
      remitente,
      autorId,
      contenido,
      leidoPorSocio: remitente === "SOCIO",
      // Lo que escribe la IA no necesita lectura de la directiva: lo que sí
      // la pide es requiereHumano, que se muestra aparte en Conversaciones.
      leidoPorDirectiva: remitente !== "SOCIO",
      requiereHumano,
      canal,
      metaId,
      adjuntoClave: archivo?.clave,
      adjuntoNombre: archivo?.nombre,
      adjuntoTipo: archivo?.tipo,
      adjuntoTamano: archivo?.tamano,
    })
    .returning({
      id: mensajesSocio.id,
      remitente: mensajesSocio.remitente,
      contenido: mensajesSocio.contenido,
      createdAt: mensajesSocio.createdAt,
      requiereHumano: mensajesSocio.requiereHumano,
    });

  const adjunto = archivo
    ? adjuntoDeFila({ id: mensaje.id, adjuntoClave: archivo.clave, adjuntoNombre: archivo.nombre, adjuntoTipo: archivo.tipo, adjuntoTamano: archivo.tamano })
    : null;

  // Si el socio escribió por WhatsApp, la respuesta de la directiva o de la IA también sale por WhatsApp.
  let entrega: "FALLIDA" | "FUERA_DE_VENTANA" | null = null;
  let canalFinal: "PORTAL" | "WHATSAPP" = canal;
  if (remitente !== "SOCIO") {
    const r = await entregarPorWhatsappSiCorresponde(socioId, contenido, adjunto);
    entrega = r.entrega;
    if (r.metaId || r.entrega) {
      canalFinal = "WHATSAPP";
      await db.update(mensajesSocio).set({ canal: "WHATSAPP", metaId: r.metaId ?? null, entrega: r.entrega }).where(eq(mensajesSocio.id, mensaje.id));
    }
  }

  // Se espera a que el servicio de tiempo real lo reciba. Si no se espera, en
  // Vercel la función puede congelarse apenas responde y la petición queda a
  // medias: el mensaje se guarda pero nadie lo ve en vivo. Si falla, el mensaje
  // ya está guardado y aparece en el próximo refresco del historial.
  // También se avisa a la sala del comité, para que la lista de Conversaciones de la directiva se ponga al día sola.
  try {
    const [socio] = await db.select({ aprId: socios.aprId }).from(socios).where(eq(socios.id, socioId)).limit(1);
    const resultados = await Promise.allSettled([publicarMensajeEnVivo(socioId, { ...mensaje, canal: canalFinal, entrega, adjunto }), socio ? publicarActividadComite(socio.aprId, socioId) : Promise.resolve()]);
    for (const r of resultados) if (r.status === "rejected") console.error("No se pudo publicar el mensaje en tiempo real:", r.reason);
  } catch (error) {
    console.error("No se pudo publicar el mensaje en tiempo real:", error);
  }

  return { ...mensaje, leido: false, editado: false, canal: canalFinal, entrega, adjunto };
}
