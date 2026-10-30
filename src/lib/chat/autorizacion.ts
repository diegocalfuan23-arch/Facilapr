import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socios } from "@/lib/db/schema";
import { puede, type Plan } from "@/lib/planes";

type UsuarioChat = { id: string; rol?: string | null; aprId?: string | null };

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
