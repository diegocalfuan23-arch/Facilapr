import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mensajesSocio } from "@/lib/db/schema";
import { publicarMensajeEnVivo } from "@/lib/chat/tiempo-real";

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
    },
  });

  return filas.map(({ leidoPorSocio, leidoPorDirectiva, editadoAt, ...m }) => ({
    ...m,
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
}: {
  socioId: string;
  remitente: "SOCIO" | "DIRECTIVA" | "IA";
  autorId: string | null;
  contenido: string;
  requiereHumano?: boolean;
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
    })
    .returning({
      id: mensajesSocio.id,
      remitente: mensajesSocio.remitente,
      contenido: mensajesSocio.contenido,
      createdAt: mensajesSocio.createdAt,
      requiereHumano: mensajesSocio.requiereHumano,
    });

  // Se espera a que el servicio de tiempo real lo reciba. Si no se espera, en
  // Vercel la función puede congelarse apenas responde y la petición queda a
  // medias: el mensaje se guarda pero nadie lo ve en vivo. Si falla, el mensaje
  // ya está guardado y aparece en el próximo refresco del historial.
  try {
    await publicarMensajeEnVivo(socioId, mensaje);
  } catch (error) {
    console.error("No se pudo publicar el mensaje en tiempo real:", error);
  }

  return { ...mensaje, leido: false, editado: false };
}
