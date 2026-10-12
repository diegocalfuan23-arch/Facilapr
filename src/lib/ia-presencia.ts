import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Cuándo debe responder la IA del chat en el modo «cuando no esté disponible».
 * Todo se calcula con la hora de la base de datos (now()), no la del servidor:
 * así los tiempos son coherentes entre el panel, el cron y las funciones.
 *
 * Las reglas, en orden:
 *  1. Si alguien de la directiva está escribiendo en ESTE chat, la IA espera
 *     (con un tope, para que un chat abandonado a medio escribir no la bloquee).
 *  2. Si la directiva está atendiendo OTRO chat (escribió o mandó un mensaje en
 *     otra conversación hace poco), la IA atiende este.
 *  3. Si nadie está conectado, la IA responde al tiro.
 *  4. Si hay alguien conectado pero sin atender, la IA espera los minutos
 *     configurados y, pasados, responde.
 */

export type Decision = "responder" | "esperar";

/** Segundos que se considera vigente un «está escribiendo». */
const ESCRIBIENDO_SEG = 25;
/** Segundos sin latido tras los cuales se da por desconectada a una persona. */
const CONECTADA_SEG = 45;
/** Minutos que cuenta como «atendiendo otro chat» haber mandado un mensaje en él. */
const OCUPADA_MIN = 3;
/** Minutos extra de gracia si la directiva sigue escribiendo cuando se cumple la espera. */
const TOPE_ESCRIBIENDO_EXTRA_MIN = 5;

export async function decidirRespuesta(
  aprId: string,
  socioId: string,
  esperaMin: number
): Promise<Decision> {
  try {
    const { rows } = await db.execute<{
      edad_seg: number | null;
      conectadas: number;
      escribe_aqui: boolean;
      escribe_otro: boolean;
      mensajeo_otro: boolean;
    }>(sql`
      select
        (select extract(epoch from (now() - m."createdAt"))::float
           from "MensajeSocio" m where m."socioId" = ${socioId}
           order by m."createdAt" desc limit 1) as edad_seg,
        (select count(*)::int from "PresenciaComite" p
           where p."aprId" = ${aprId}
             and p."visto" > now() - make_interval(secs => ${CONECTADA_SEG})) as conectadas,
        exists (select 1 from "PresenciaComite" p
           where p."aprId" = ${aprId} and p."escribiendoSocioId" = ${socioId}
             and p."escribiendoAt" > now() - make_interval(secs => ${ESCRIBIENDO_SEG})) as escribe_aqui,
        exists (select 1 from "PresenciaComite" p
           where p."aprId" = ${aprId} and p."escribiendoSocioId" is not null
             and p."escribiendoSocioId" <> ${socioId}
             and p."escribiendoAt" > now() - make_interval(secs => ${ESCRIBIENDO_SEG})) as escribe_otro,
        exists (select 1 from "MensajeSocio" m join "Socio" s on s."id" = m."socioId"
           where s."aprId" = ${aprId} and m."remitente" = 'DIRECTIVA' and m."socioId" <> ${socioId}
             and m."createdAt" > now() - make_interval(mins => ${OCUPADA_MIN})) as mensajeo_otro
    `);
    const f = rows[0];
    const edadMin = (f?.edad_seg ?? 0) / 60;

    // 1. Escribiendo aquí: se le deja terminar, dentro de un tope.
    if (f?.escribe_aqui && edadMin < esperaMin + TOPE_ESCRIBIENDO_EXTRA_MIN) return "esperar";
    // 2. Ocupada en otro chat: la IA atiende este.
    if (f?.escribe_otro || f?.mensajeo_otro) return "responder";
    // 3. Nadie conectado: responde ya.
    if (!f || f.conectadas === 0) return "responder";
    // 4. Hay alguien disponible: se le da su tiempo.
    return edadMin >= esperaMin ? "responder" : "esperar";
  } catch (e) {
    // Si no se puede saber (p. ej. la tabla de presencia no existe), no dejar al socio esperando.
    console.error("Presencia de la directiva:", e);
    return "responder";
  }
}
