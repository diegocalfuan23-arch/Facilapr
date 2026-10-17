import Link from "next/link";
import { Logo } from "@/components/marca/logo";

export function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-7 text-[0.85rem] text-muted-foreground">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Logo className="size-5.5" />
          Facilapr
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <Link href="/ayuda" className="transition-colors hover:text-foreground">
            Centro de ayuda
          </Link>
          <Link
            href="/ayuda/como-calcular-tarifa-agua-apr"
            className="transition-colors hover:text-foreground"
          >
            Cómo calcular la tarifa
          </Link>
          <Link
            href="/ayuda/cortes-por-morosidad-apr"
            className="transition-colors hover:text-foreground"
          >
            Cortes por morosidad
          </Link>
          <Link
            href="/ayuda/planilla-cobro-agua-rural"
            className="transition-colors hover:text-foreground"
          >
            Planilla de cobro
          </Link>
          <Link href="/terminos" className="transition-colors hover:text-foreground">
            Términos de uso
          </Link>
          <Link
            href="/privacidad"
            className="transition-colors hover:text-foreground"
          >
            Privacidad
          </Link>
        </div>

        <span>
          &copy; 2026 Facilapr. Hecho para los comités de agua potable rural
          de Chile.
        </span>

        {/* Quién está detrás del sitio: razón social y RUT, como figuran en el Registro de Empresas y Sociedades. */}
        <p className="w-full border-t border-border/60 pt-5 text-[0.78rem] leading-relaxed">
          Facilapr es un producto de <strong className="font-medium text-foreground">DESARROLLO DE SOFTWARES A MEDIDAS SpA</strong>,
          RUT 78.324.975-8. Domicilio: Padre Las Casas, Región de La Araucanía, Chile. Contacto:{" "}
          <a href="mailto:hola@facilapr.cl" className="underline-offset-2 hover:text-foreground hover:underline">
            hola@facilapr.cl
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
