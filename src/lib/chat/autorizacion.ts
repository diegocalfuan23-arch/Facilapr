import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, socios } from "@/lib/db/schema";
import { puede, type Plan } from "@/lib/planes";

type UsuarioChat = { id: string; rol?: string | null; aprId?: string | null };

/**
 * Quién puede escuchar la actividad de todas las conversaciones de un comité: solo su ADMIN, y solo si el plan incluye el
 * chat. Devuelve el comité (para firmar la sala) o null.
 */
export async function comitePuedeEscuchar(user: UsuarioChat): Promise<string | null> {
  if (user.rol !== "ADMIN" || !user.aprId) return null;
  const apr = await db.query.aprs.findFirst({ where: eq(aprs.id, user.aprId), columns: { id: true, plan: true } });
  return apr && puede(apr.plan as Plan, "chat") ? apr.id : null;
}

/**
 * Quién puede escuchar el chat de un socio: ese mismo socio, o un ADMIN del
 * comité al que pertenece. Nunca otro socio ni un ADMIN de otro comité: sin
 * esta comprobación, cualquiera con el id de un socio podría leer su
 * conversación. La usa el token que se entrega al servicio Socket.IO.
 */
export async function puedeEscucharChatSocio(user: UsuarioChat, socioId: string) {
  if (user.rol === "SOCIO") {
    const socio = await db.query.socios.findFirst({
      where: eq(socios.id, socioId),
      columns: { userId: true },
      with: { apr: { columns: { plan: true } } },
    });
    return Boolean(
      socio && socio.userId === user.id && puede(socio.apr.plan as Plan, "chat")
    );
  }

  if (user.rol === "ADMIN") {
    const socio = await db.query.socios.findFirst({
      where: eq(socios.id, socioId),
      columns: { aprId: true },
      with: { apr: { columns: { plan: true } } },
    });
    return Boolean(
      socio && socio.aprId === user.aprId && puede(socio.apr.plan as Plan, "chat")
    );
  }

  return false;
}
