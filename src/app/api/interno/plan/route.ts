import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs } from "@/lib/db/schema";
import { exigirSecreto, respuesta } from "@/lib/interno";

export const dynamic = "force-dynamic";

/**
 * Cambia el plan de un comité, pedido por el panel de super admin. La escritura
 * queda aquí, en Facilapr, igual que crear comité o cambiar el slug. Protegido
 * por el secreto compartido (SUPERADMIN_API_SECRET).
 *
 * Bajar de plan no borra nada: el sitio público y el chat dejan de estar
 * disponibles (lo deciden planes.ts y sus consultas), y el comité conserva sus
 * datos por si vuelve a subir.
 */
const cuerpoSchema = z.object({
  aprId: z.string().min(1).max(64),
  plan: z.enum(["BASICO", "ESTANDAR", "PREMIUM"]),
});

export async function POST(req: NextRequest) {
  const noAutorizado = exigirSecreto(req);
  if (noAutorizado) return noAutorizado;

  const parsed = cuerpoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return respuesta(400, { error: "Datos inválidos." });
  }

  const [actualizado] = await db
    .update(aprs)
    .set({ plan: parsed.data.plan, updatedAt: new Date() })
    .where(eq(aprs.id, parsed.data.aprId))
    .returning({ id: aprs.id, plan: aprs.plan });

  if (!actualizado) {
    return respuesta(404, { error: "Comité no encontrado." });
  }

  return respuesta(200, { ok: true, plan: actualizado.plan });
}
