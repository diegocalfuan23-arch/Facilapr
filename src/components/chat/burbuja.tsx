import { Check, CheckCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Piezas visuales del chat, con el aspecto de WhatsApp: fondo beige, globos con
 * cola, la hora dentro del globo y un botón de enviar redondo y verde. Las usan
 * el chat de la directiva (panel) y el del socio (portal).
 */

export const FONDO_CHAT =
  "bg-[#efeae2] [background-image:radial-gradient(rgba(11,20,26,0.04)_1px,transparent_1px)] [background-size:18px_18px]";

export const CLASE_BARRA_ESCRIBIR = "flex items-center gap-2 bg-[#f0f2f5] px-3 py-2.5";

export const CLASE_CAJA_ESCRIBIR =
  "h-10 flex-1 rounded-full border-0 bg-white px-4 text-[0.9rem] shadow-none focus-visible:ring-1 focus-visible:ring-[#00a884]/40";

export const CLASE_BOTON_ENVIAR =
  "size-10 shrink-0 rounded-full bg-[#00a884] p-0 text-white hover:bg-[#019477] disabled:bg-[#00a884]/45";

const hora = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export type TonoBurbuja = "propio" | "ajeno" | "ia";

/**
 * Un mensaje. `propio` va a la derecha en verde (lo que escribe quien mira la
 * pantalla); `ajeno`, a la izquierda en blanco; `ia`, el asistente, en lila y
 * con su etiqueta. `lado` fija de qué costado sale la cola y el globo.
 */
export function BurbujaChat({
  tono,
  lado,
  fecha,
  etiqueta,
  leido = false,
  editado = false,
  acciones,
  children,
  ancho = "max-w-[78%]",
}: {
  tono: TonoBurbuja;
  lado: "izquierda" | "derecha";
  fecha: string | Date;
  etiqueta?: string;
  /** Solo para mensajes propios: la otra parte ya lo leyó. */
  leido?: boolean;
  /** Se corrigió el texto después de enviarlo. */
  editado?: boolean;
  /** Menú que aparece al pasar el mouse (editar, eliminar…). */
  acciones?: React.ReactNode;
  children: React.ReactNode;
  ancho?: string;
}) {
  const derecha = lado === "derecha";
  return (
    <div className={cn("flex", derecha ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "group relative rounded-lg px-2.5 pt-1.5 pb-1 text-[0.9rem] leading-snug whitespace-pre-line text-neutral-900 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]",
          ancho,
          tono === "propio" && "bg-[#d9fdd3]",
          tono === "ajeno" && "bg-white",
          tono === "ia" && "bg-[#ede7ff]",
          derecha ? "rounded-tr-none" : "rounded-tl-none"
        )}
      >
        {acciones && (
          <div className="absolute top-0.5 right-0.5 opacity-0 transition-opacity group-hover:opacity-100 has-[[data-popup-open]]:opacity-100 focus-within:opacity-100">
            {acciones}
          </div>
        )}
        {etiqueta && (
          <div className="mb-0.5 flex items-center gap-1 text-[0.68rem] font-semibold text-primary">
            <Sparkles className="size-3" />
            {etiqueta}
          </div>
        )}
        {children}
        {/* La hora va dentro del globo, abajo a la derecha, como en WhatsApp. */}
        <span className="float-right mt-1.5 ml-3 flex translate-y-0.5 items-center gap-0.5 text-[0.66rem] text-neutral-500">
          {editado && <span className="italic">editado</span>}
          {hora.format(new Date(fecha))}
          {tono === "propio" &&
            (leido ? (
              <CheckCheck className="size-3.5 text-[#53bdeb]" />
            ) : (
              <Check className="size-3.5" />
            ))}
        </span>
      </div>
    </div>
  );
}
