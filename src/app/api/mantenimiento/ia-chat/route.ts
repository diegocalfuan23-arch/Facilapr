import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { responderConIaSiCorresponde } from "@/lib/ia-chat";

/**
 * Cada minuto revisa las conversaciones donde un socio escribió y nadie ha
 * respondido todavía, en los comités con la IA en modo «cuando no esté
 * disponible». Para cada una vuelve a preguntar si ya toca responder (la
 * directiva tuvo sus minutos, o dejó de estar disponible).
 *
 * Protegido con CRON_SECRET, igual que el resto de los procesos de mantenimiento.
 */
export const maxDuration = 60;

/** Solo se consideran mensajes recientes: no se responde a algo de hace horas. */
const VENTANA_MIN = 120;
/** Tope por pasada, para no pasarse del tiempo de la función. */
const MAX_POR_PASADA = 8;

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return Response.json({ error: "Mantenimiento no configurado." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const { rows } = await db.execute<{ socioId: string }>(sql`
    select u."socioId"
    from (
      select distinct on (m."socioId") m."socioId", m."remitente", m."createdAt"
      from "MensajeSocio" m
      where m."createdAt" > now() - make_interval(mins => ${VENTANA_MIN})
      order by m."socioId", m."createdAt" desc
    ) u
    join "Socio" s on s."id" = u."socioId"
    join "Apr" a on a."id" = s."aprId"
    where u."remitente" = 'SOCIO' and a."iaChatModo" = 'SIN_RESPUESTA'
    order by u."createdAt" asc
    limit ${MAX_POR_PASADA}
  `);

  // Una por una: cada respuesta es una llamada al modelo y vuelve a decidir sola si corresponde.
  for (const { socioId } of rows) {
    await responderConIaSiCorresponde(socioId);
  }

  return Response.json({ revisadas: rows.length });
}
