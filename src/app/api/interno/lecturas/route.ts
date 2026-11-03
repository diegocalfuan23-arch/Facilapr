import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs } from "@/lib/db/schema";
import { exigirSecreto, respuesta } from "@/lib/interno";
import { confirmarLecturasDe, previsualizarLecturasDe } from "@/lib/cargar-lecturas";

export const dynamic = "force-dynamic";

/**
 * Carga de lecturas a un comité, pedida por el panel de super admin. Mismos dos
 * pasos y mismas reglas que la carga masiva de la directiva (lib/cargar-lecturas):
 *  - multipart con `aprId` y `archivo` (y `periodo`, `modo`): solo lee y devuelve
 *    qué se entendió, sin guardar.
 *  - JSON con `aprId`, `items`, `periodo` y `modo`: guarda lo confirmado.
 * La escritura queda aquí, en Facilapr; el super admin no toca la base. Protegido
 * por el secreto compartido (SUPERADMIN_API_SECRET).
 */

/** Marca de quién cargó: no hay un usuario de Facilapr detrás, es el super admin. */
const REGISTRADA_POR = "superadmin";

const confirmarSchema = z.object({
  aprId: z.string().min(1).max(64),
  periodo: z.string().min(1).max(20),
  modo: z.enum(["inicial", "mensual"]),
  items: z
    .array(z.object({ socioId: z.string().min(1).max(64), valor: z.number() }))
    .min(1),
});

async function cargarApr(aprId: string) {
  return db.query.aprs.findFirst({ where: eq(aprs.id, aprId) });
}

export async function POST(req: NextRequest) {
  const noAutorizado = exigirSecreto(req);
  if (noAutorizado) return noAutorizado;

  const esArchivo = (req.headers.get("content-type") ?? "").includes("multipart/form-data");

  if (esArchivo) {
    let formData: FormData;
    try {
      // Next tipa el cuerpo con el FormData de undici, distinto al global solo en los tipos.
      formData = (await req.formData()) as unknown as FormData;
    } catch {
      return respuesta(400, { error: "Datos inválidos." });
    }
    const aprId = String(formData.get("aprId") ?? "");
    if (!aprId) return respuesta(400, { error: "Datos inválidos." });

    const apr = await cargarApr(aprId);
    if (!apr) return respuesta(404, { error: "Comité no encontrado." });

    const vista = await previsualizarLecturasDe(apr, formData);
    if (!vista.ok) return respuesta(400, { error: vista.error });
    return respuesta(200, { ...vista });
  }

  const parsed = confirmarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return respuesta(400, { error: "Datos inválidos." });

  const apr = await cargarApr(parsed.data.aprId);
  if (!apr) return respuesta(404, { error: "Comité no encontrado." });

  const r = await confirmarLecturasDe(
    apr,
    REGISTRADA_POR,
    parsed.data.items,
    parsed.data.periodo,
    parsed.data.modo
  );
  if (!r.ok) return respuesta(400, { error: r.error });
  return respuesta(200, { ok: true, cargadas: r.cargadas });
}
