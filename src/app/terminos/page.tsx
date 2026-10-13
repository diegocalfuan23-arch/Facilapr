import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/marca/logo";

export const metadata: Metadata = {
  title: "Términos de uso",
  description:
    "Condiciones del servicio Facilapr para comités de Agua Potable Rural de Chile.",
};

const ACTUALIZADO = "30 de agosto de 2026";

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[820px] items-center gap-2 px-7 py-5">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Logo className="size-6" />
            Facilapr
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-7 py-14">
        <span className="font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
          Legal
        </span>
        <h1 className="mt-3 text-[clamp(1.8rem,3vw,2.4rem)] font-semibold tracking-tight">
          Términos de uso
        </h1>
        <p className="mt-3 text-[0.9rem] text-muted-foreground">
          Última actualización: {ACTUALIZADO}
        </p>

        <div className="mt-10 flex flex-col gap-9 text-[0.97rem] leading-relaxed">
          <section>
            <h2 className="text-[1.2rem] font-semibold">1. Qué es Facilapr</h2>
            <p className="mt-3">
              Facilapr es un servicio de software para comités de Agua Potable
              Rural (APR/SSR) de Chile. Permite administrar el padrón de socios,
              emitir boletas, registrar lecturas y pagos, publicar un sitio
              público del comité y dar a cada socio un panel propio para
              consultar su cuenta.
            </p>
            <p className="mt-3">
              Al crear una cuenta y usar el servicio, el comité acepta estos
              términos.
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">2. Quién puede usarlo</h2>
            <p className="mt-3">
              El servicio está dirigido a comités y cooperativas de agua potable
              rural constituidos en Chile. Quien crea la cuenta declara estar
              autorizado para actuar en nombre del comité.
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">
              3. Los datos son del comité
            </h2>
            <p className="mt-3">
              Los datos que el comité carga en Facilapr le pertenecen. Nosotros
              los procesamos por su cuenta, según lo descrito en la{" "}
              <Link
                href="/privacidad"
                className="font-medium text-primary hover:underline"
              >
                política de privacidad
              </Link>
              .
            </p>
            <p className="mt-3">
              El comité puede exportar sus datos en cualquier momento y
              solicitar su eliminación al cerrar la cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">
              4. Responsabilidades del comité
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
              <li>
                Cargar datos veraces y tener derecho a tratarlos. Los datos de
                los socios son responsabilidad del comité, incluido informarles
                sobre su tratamiento.
              </li>
              <li>
                Cuidar las credenciales de acceso y las de los operadores que
                invite. Cada cuenta es personal.
              </li>
              <li>
                Revisar las boletas y lecturas antes de emitirlas. Facilapr
                calcula según los datos y tarifas que el comité configura, pero
                el monto cobrado es decisión del comité.
              </li>
              <li>
                Usar el servicio conforme a la ley, sin enviar mensajes no
                solicitados a personas que no sean sus socios.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">
              5. El asistente de inteligencia artificial
            </h2>
            <p className="mt-3">
              La inteligencia artificial del chat con el comité (planes Estándar y
              Grande) y el asistente del sitio público generan sus respuestas con inteligencia artificial, a partir de los
              datos que el comité tiene cargados.
            </p>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
              <li>
                Sus respuestas pueden contener errores. No reemplazan la
                atención del comité ni constituyen un documento oficial de
                cobro: la boleta emitida es la que vale.
              </li>
              <li>
                El asistente del sitio público no entrega información sobre
                deudas ni datos personales de ningún socio, por diseño. Solo
                la IA del chat de un socio con sesión iniciada responde sobre
                su propia cuenta, y únicamente la suya.
              </li>
              <li>
                El servicio depende de proveedores externos de IA; si están
                caídos, el asistente puede dejar de responder temporalmente.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">6. Planes y pagos</h2>
            <p className="mt-3">
              Las funciones disponibles dependen del plan contratado. Los
              precios se informan en el sitio y pueden cambiar; cualquier cambio
              se avisará con anticipación razonable al comité.
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">
              7. Disponibilidad del servicio
            </h2>
            <p className="mt-3">
              Trabajamos para mantener el servicio disponible, pero puede haber
              interrupciones por mantención o por fallas de proveedores. No
              garantizamos disponibilidad ininterrumpida.
            </p>
            <p className="mt-3">
              Nuestra responsabilidad se limita al monto pagado por el comité en
              los últimos doce meses. No respondemos por perjuicios indirectos
              derivados del uso del servicio.
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">
              8. Término del servicio
            </h2>
            <p className="mt-3">
              El comité puede dejar de usar Facilapr cuando quiera. Podemos
              suspender una cuenta que incumpla estos términos o que use el
              servicio de forma que perjudique a terceros, avisando salvo casos
              graves o urgentes.
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">
              9. Cambios y legislación aplicable
            </h2>
            <p className="mt-3">
              Podemos actualizar estos términos; los cambios relevantes se
              avisarán a los comités con cuenta activa. Este servicio se rige por
              la legislación chilena.
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">10. Contacto</h2>
            <p className="mt-3">
              Escríbenos a{" "}
              <a
                href="mailto:hola@facilapr.cl"
                className="font-medium text-primary hover:underline"
              >
                hola@facilapr.cl
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <Link
            href="/"
            className="text-[0.9rem] font-medium text-primary hover:underline"
          >
            ← Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  );
}
