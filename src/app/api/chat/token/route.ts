import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { puedeEscucharChatSocio } from "@/lib/chat/autorizacion";
import { firmarTokenChat, salaChatSocio } from "@/lib/chat/tiempo-real";

/**
 * Entrega el token con el que el navegador se conecta al servidor Socket.IO.
 * Solo se firma para la sala de un socio que esa persona puede escuchar.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("No autorizado.", { status: 401 });

  const socioId = req.nextUrl.searchParams.get("socioId") ?? "";
  if (!socioId) return new Response("Solicitud inválida.", { status: 400 });

  if (!(await puedeEscucharChatSocio(session.user, socioId))) {
    return new Response("No autorizado.", { status: 403 });
  }

  const token = await firmarTokenChat([salaChatSocio(socioId)]);
  return Response.json({ token }, { headers: { "cache-control": "no-store" } });
}
