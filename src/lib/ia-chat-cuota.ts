import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { Plan } from "@/lib/planes";
import { CUOTA_TOKENS_MES, type UsoIaChat } from "@/lib/ia-chat-limites";

const TOKENS_POR_RESPUESTA_INICIAL = 2_000;

/**
 * El consumo sale de la tabla UsoIA, que ya guarda los tokens de cada llamada.
 * Lo que pasa de la cuota de un mes se descuenta de los packs: así no hace falta
 * guardar un saldo que haya que mantener, y no hay carreras al responder.
 */
/**
 * Tokens de packs comprados. Se lee aparte (no es parte del esquema de Drizzle)
 * para que, si la columna todavía no existe en la base, el resto del panel siga
 * funcionando y los packs valgan 0.
 */
async function packsComprados(aprId: string) {
  try {
    const { rows } = await db.execute<{ extra: number }>(
      sql`select "iaChatTokensExtra" as extra from "Apr" where "id" = ${aprId}`
    );
    return Number(rows[0]?.extra ?? 0);
  } catch {
    return 0;
  }
}

export async function usoIaChat(aprId: string, plan: Plan): Promise<UsoIaChat> {
  const extraComprado = await packsComprados(aprId);
  const { rows } = await db.execute<{ mes: string; tokens: string; n: number }>(sql`
    select date_trunc('month', "createdAt") as mes,
           coalesce(sum("tokensEntrada" + "tokensSalida"), 0)::bigint as tokens,
           count(*)::int as n
    from "UsoIA"
    where "aprId" = ${aprId} and "origen" = 'chat-ia'
    group by 1
  `);

  const cuotaMes = CUOTA_TOKENS_MES[plan];
  const ahora = new Date();
  const mesActual = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1);

  let usadoMes = 0;
  let respuestasMes = 0;
  let extraUsado = 0;
  let tokensTotal = 0;
  let respuestasTotal = 0;
  for (const f of rows) {
    const tokens = Number(f.tokens);
    tokensTotal += tokens;
    respuestasTotal += f.n;
    // Sin zona horaria en la base: el mes se lee tal cual, como UTC.
    const mes = new Date(`${new Date(f.mes).toISOString().slice(0, 10)}T00:00:00Z`).getTime();
    if (mes === mesActual) {
      usadoMes = tokens;
      respuestasMes = f.n;
    }
    extraUsado += Math.max(0, tokens - cuotaMes);
  }

  const restanteMes = Math.max(0, cuotaMes - usadoMes);
  const extraRestante = Math.max(0, extraComprado - extraUsado);
  const disponible = restanteMes + extraRestante;
  const porRespuesta =
    respuestasTotal >= 5 ? Math.round(tokensTotal / respuestasTotal) : TOKENS_POR_RESPUESTA_INICIAL;

  return {
    cuotaMes,
    usadoMes,
    restanteMes,
    extraRestante,
    extraComprado,
    disponible,
    respuestasDisponibles: Math.floor(disponible / Math.max(1, porRespuesta)),
    respuestasMes,
    reinicia: new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1)
    ).toISOString(),
  };
}
