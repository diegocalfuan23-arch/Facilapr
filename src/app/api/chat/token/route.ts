import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { comitePuedeEscuchar, puedeEscucharChatSocio } from "@/lib/chat/autorizacion";
import { firmarTokenChat, salaChatComite, salaChatSocio } from "@/lib/chat/tiempo-real";

/**
 * Entrega el token con el que el navegador se conecta al servidor Socket.IO.
 * Solo se firma para la sala de un socio que esa persona puede escuchar.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("No autorizado.", { status: 401 });

  // La directiva pide la sala de su comité para enterarse de la actividad de todas sus conversaciones.
  if (req.nextUrl.searchParams.get("comite") === "1") {
    const aprId = await comitePuedeEscuchar(session.user);
    if (!aprId) return new Response("No autorizado.", { status: 403 });
    const token = await firmarTokenChat([salaChatComite(aprId)]);
    return Response.json({ token }, { headers: { "cache-control": "no-store" } });
  }

  const socioId = req.nextUrl.searchParams.get("socioId") ?? "";
  if (!socioId) return new Response("Solicitud inválida.", { status: 400 });

  if (!(await puedeEscucharChatSocio(session.user, socioId))) {
    return new Response("No autorizado.", { status: 403 });
  }

  const token = await firmarTokenChat([salaChatSocio(socioId)]);
  return Response.json({ token }, { headers: { "cache-control": "no-store" } });
}
