import { Bot, Check, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const puntos = [
  {
    titulo: "Responde en segundos, a cualquier hora",
    detalle:
      "El socio pregunta cuánto debe, cómo pagar o qué pasa con su corte, y la respuesta llega al tiro, también de noche o fin de semana.",
  },
  {
    titulo: "Con los datos reales de ese socio",
    detalle:
      "No contesta de memoria: mira su deuda, sus boletas y sus pagos. Si no sabe algo, no lo inventa.",
  },
  {
    titulo: "La directiva toma el control cuando quiere",
    detalle:
      "Si alguien del comité escribe en la conversación, la IA se pausa sola. Tú decides cuándo habla ella y cuándo hablas tú.",
  },
  {
    titulo: "Menos llamadas y mensajes sueltos",
    detalle:
      "Las preguntas repetidas se resuelven solas, y la conversación queda ordenada por socio, en vez de perdida en un teléfono personal.",
  },
];

/** Una conversación de ejemplo (los datos son ilustrativos, no de un socio real). */
const mensajes: { de: "socio" | "ia" | "directiva"; texto: string }[] = [
  { de: "socio", texto: "Hola, ¿cuánto debo este mes?" },
  {
    de: "ia",
    texto:
      "Hola, Marta. Tienes 1 boleta pendiente: consumo de 14 m³ más cargo fijo, en total $8.400, que vence el día 10.",
  },
  { de: "socio", texto: "¿Y si pago en la Caja Vecina?" },
  {
    de: "ia",
    texto:
      "Sí se puede. Cuando el comité registre tu pago, te queda el comprobante en tu cuenta.",
  },
  { de: "socio", texto: "Quiero pedir una reparación, tengo una filtración." },
  {
    de: "directiva",
    texto: "Marta, mañana pasa el técnico por tu casa. Ya quedó anotado.",
  },
];

export function ChatSection() {
  return (
    <section id="chat" className="py-23">
      <div className="mx-auto grid max-w-[1180px] gap-15 px-7 sm:grid-cols-[1.1fr_0.9fr] sm:items-center">
        <div>
          <span className="font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
            Chat con tus socios
          </span>
          <h2 className="mt-3 text-[clamp(1.7rem,2.8vw,2.2rem)] font-semibold text-balance">
            Un chat donde la IA contesta por el comité, y tú entras cuando hace falta.
          </h2>
          <p className="mt-4 max-w-[560px] text-[0.97rem] text-muted-foreground">
            Cada socio habla con su comité desde su cuenta, en tiempo real. La
            inteligencia artificial resuelve lo repetitivo con los datos de ese
            socio y deja para ti lo que de verdad necesita a una persona.
          </p>
          <ul className="mt-7 flex flex-col gap-4">
            {puntos.map(({ titulo, detalle }) => (
              <li key={titulo} className="flex gap-3">
                <Check className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <strong className="mb-0.5 block">{titulo}</strong>
                  <span className="text-[0.9rem] text-muted-foreground">
                    {detalle}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[0.85rem] text-muted-foreground">
            Incluido en los planes Estándar y Grande.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2.5 bg-foreground px-5 py-3.5 text-background">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <UserRound className="size-4" />
            </span>
            <div className="leading-tight">
              <div className="text-[0.92rem] font-semibold">Chat con el comité</div>
              <div className="text-[0.72rem] opacity-70">Conversación de ejemplo</div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 bg-muted/40 p-4">
            {mensajes.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex max-w-[86%] flex-col gap-1",
                  m.de === "socio" ? "self-start" : "self-end items-end"
                )}
              >
                {m.de !== "socio" && (
                  <span className="inline-flex items-center gap-1 font-mono text-[0.66rem] tracking-[0.05em] text-muted-foreground uppercase">
                    {m.de === "ia" ? (
                      <>
                        <Bot className="size-3" /> Asistente IA
                      </>
                    ) : (
                      <>
                        <UserRound className="size-3" /> Directiva
                      </>
                    )}
                  </span>
                )}
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-[0.88rem] leading-snug",
                    m.de === "socio" && "rounded-bl-sm border border-border bg-card",
                    m.de === "ia" && "rounded-br-sm bg-primary/12",
                    m.de === "directiva" && "rounded-br-sm bg-primary text-primary-foreground"
                  )}
                >
                  {m.texto}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
