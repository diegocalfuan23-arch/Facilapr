import { MessageCircle } from "lucide-react";
import type { CupoWhatsapp } from "@/lib/whatsapp-cupo-comun";
import { cn } from "@/lib/utils";

/** Cuántos mensajes automáticos de WhatsApp tiene el comité este mes y cuántos le quedan. */
export function CupoWhatsappInfo({ cupo, compacto = false, className }: { cupo: CupoWhatsapp; compacto?: boolean; className?: string }) {
  if (cupo.limite === null) {
    return (
      <p className={cn("flex items-center gap-1.5 text-[13px] text-[#5B5970]", className)}>
        <MessageCircle className="size-4 shrink-0" aria-hidden />
        Envías por tu propio número de WhatsApp: sin tope de mensajes automáticos.
      </p>
    );
  }
  const pct = cupo.limite > 0 ? Math.min(100, Math.round((cupo.usados / cupo.limite) * 100)) : 100;
  const agotado = !cupo.disponible;
  const poco = !agotado && (cupo.restantes ?? 0) <= Math.max(5, Math.round(cupo.limite * 0.1));
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-[#5B5970]">
        <MessageCircle className="size-4 shrink-0" aria-hidden />
        <span>{compacto ? "Mensajes automáticos:" : "Mensajes automáticos de WhatsApp este mes:"}</span>
        <strong className={cn("font-semibold tabular-nums", agotado ? "text-[#A32020]" : poco ? "text-[#B86400]" : "text-[#15132B]")}>
          {agotado ? "se acabaron" : `quedan ${cupo.restantes} de ${cupo.limite}`}
        </strong>
        {!compacto && <span className="tabular-nums">(usaste {cupo.usados})</span>}
      </p>
      {!compacto && (
        <div role="img" aria-label={`${pct}% usado`} className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-[#F0EEF7]">
          <div className={cn("h-full rounded-full", agotado ? "bg-[#D6403D]" : poco ? "bg-[#E58200]" : "bg-[#3A0CE3]")} style={{ width: `${pct}%` }} />
        </div>
      )}
      {agotado && <p className="text-xs text-[#5B5970]">Los envíos siguen funcionando: se abre WhatsApp para mandarlos a mano. El cupo se renueva el 1 de cada mes.</p>}
    </div>
  );
}
