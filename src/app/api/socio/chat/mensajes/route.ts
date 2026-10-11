import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { socios } from "@/lib/db/schema";
import { historialChat } from "@/lib/chat-socio";
import { puede, type Plan } from "@/lib/planes";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.rol !== "SOCIO") {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const socio = await db.query.socios.findFirst({
    where: eq(socios.userId, session.user.id),
    columns: { id: true },
    with: { apr: { columns: { plan: true } } },
  });
  if (!socio) {
    return Response.json({ error: "Socio no encontrado." }, { status: 404 });
  }

  if (!puede(socio.apr.plan as Plan, "chat")) {
    return Response.json({ error: "Tu comité no tiene el chat activado." }, { status: 403 });
  }

  const mensajes = await historialChat(socio.id);
  return Response.json(mensajes);
}
