import { cn } from "@/lib/utils";

const TONOS = ["bg-[#ECE8FD] text-[#2A07A8]", "bg-[#E2F2FC] text-[#0A5F91]", "bg-[#DFF4EB] text-[#075A3C]", "bg-[#FFEEDC] text-[#8F4400]", "bg-[#F0EFF4] text-[#4A4760]"];

const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .filter((p) => /^\p{L}/u.test(p))
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

/** El tono sale del id del socio: es siempre el mismo para la misma persona. */
const tono = (id: string) => TONOS[[...id].reduce((t, c) => t + c.charCodeAt(0), 0) % TONOS.length];

/** Círculo con las iniciales del socio. */
export function AvatarSocio({ id, nombre, className }: { id: string; nombre: string; className?: string }) {
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold tracking-tight", tono(id), className)}>
      {iniciales(nombre) || "?"}
    </span>
  );
}
