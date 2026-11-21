/**
 * Qué hora es para quien escribe, para que la IA salude como corresponde. Siempre en hora de Chile: el servidor corre en otra zona.
 */
const ZONA = "America/Santiago";

const formato = new Intl.DateTimeFormat("es-CL", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const soloHora = new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", hourCycle: "h23" });

/** «buenos días» hasta el mediodía, «buenas tardes» hasta las 20:00 y «buenas noches» después. */
export function saludoDeLaHora(ahora: Date = new Date()): string {
  const hora = Number(soloHora.format(ahora));
  if (hora < 12) return "buenos días";
  if (hora < 20) return "buenas tardes";
  return "buenas noches";
}

/** El párrafo del prompt que le dice a la IA la fecha, la hora y cómo saludar. */
export function momentoParaPrompt(ahora: Date = new Date()): string {
  const saludo = saludoDeLaHora(ahora);
  return `Momento actual (hora de Chile): ${formato.format(ahora)}.
Saludo: ahora corresponde «${saludo}». Si te saludan o empieza la conversación, responde «Hola, ${saludo}» con el primer nombre de la persona (por ejemplo «Hola, ${saludo}, Juan») y pregunta en qué le puedes ayudar. Nunca uses un saludo de otra hora del día. Saluda solo una vez, al comenzar: en las respuestas siguientes ve directo a lo que preguntó. Si te preguntan por el horario de atención, compáralo con la hora actual.`;
}
