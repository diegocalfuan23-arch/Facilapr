import Link from "next/link";

const GRIS = "text-[#5B5970]";

const enlaces: [string, string][] = [
  ["Centro de ayuda", "/ayuda"],
  ["Cómo calcular la tarifa", "/ayuda/como-calcular-tarifa-agua-apr"],
  ["Cortes por morosidad", "/ayuda/cortes-por-morosidad-apr"],
  ["Soy socio: paga tu boleta", "/socios"],
  ["Planilla gratis en Excel", "/planilla-cobro-agua-potable-rural"],
  ["Términos de uso", "/terminos"],
  ["Privacidad", "/privacidad"],
];

export function Footer() {
  return (
    <footer className="px-4 pb-8 sm:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-lg font-semibold tracking-tight">facilapr</p>
          <nav aria-label="Pie de página" className={`flex flex-wrap gap-x-5 gap-y-1 text-sm ${GRIS}`}>
            {enlaces.map(([n, h]) => (
              <Link key={h} href={h} className="transition-colors hover:text-[#3A0CE3]">
                {n}
              </Link>
            ))}
          </nav>
        </div>
        <p className={`mt-4 text-[13px] leading-relaxed ${GRIS}`}>&copy; 2026 Facilapr. Hecho para los comités de agua potable rural de Chile.</p>
        {/* Quién está detrás del sitio: razón social y RUT, como figuran en el Registro de Empresas y Sociedades. */}
        <p className={`mt-2 text-[13px] leading-relaxed ${GRIS}`}>
          Facilapr es un producto de <strong className="font-medium text-[#15132B]">DESARROLLO DE SOFTWARES A MEDIDAS SpA</strong>, RUT 78.324.975-8. Domicilio: Padre Las Casas, Región de La Araucanía, Chile. Contacto:{" "}
          <a href="mailto:hola@facilapr.cl" className="underline-offset-2 hover:text-[#15132B] hover:underline">
            hola@facilapr.cl
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
