import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/marca/logo";

export const metadata: Metadata = {
  alternates: { canonical: "/privacidad" },
  title: "Política de privacidad",
  description:
    "Cómo Facilapr trata los datos personales de socios de comités de Agua Potable Rural, conforme a la Ley 21.719.",
};

const ACTUALIZADO = "30 de agosto de 2026";

/**
 * Redactada sobre la Ley 21.719, que moderniza la protección de datos en
 * Chile y entra en vigencia el 1 de diciembre de 2026.
 *
 * Todo lo que se afirma aquí debe seguir siendo cierto en el sistema: si
 * cambia dónde se alojan los datos, qué proveedores se usan o cuánto se
 * conservan los mensajes, hay que actualizar este texto.
 */
export default function PrivacidadPage() {
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
          Política de privacidad
        </h1>
        <p className="mt-3 text-[0.9rem] text-muted-foreground">
          Última actualización: {ACTUALIZADO}
        </p>

        <div className="mt-10 flex flex-col gap-9 text-[0.97rem] leading-relaxed">
          <section className="rounded-2xl border border-border bg-muted/40 p-6">
            <p>
              Esta política explica cómo tratamos los datos personales en
              Facilapr, conforme a la <strong>Ley 21.719</strong>, que regula
              la protección y el tratamiento de los datos personales en Chile y
              entra en vigencia el <strong>1 de diciembre de 2026</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">
              1. Quién es responsable de tus datos
            </h2>
            <p className="mt-3">
              Facilapr es una herramienta que usan los comités de Agua Potable
              Rural (APR/SSR) para administrar su servicio. Es operada por
              DESARROLLO DE SOFTWARES A MEDIDAS SpA (RUT 78.324.975-8), con
              domicilio en Padre Las Casas, Región de La Araucanía, Chile;
              contacto: hola@facilapr.cl. Esa distinción importa:
            </p>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong>El comité es el responsable</strong> de los datos de sus
                socios. Es quien decide qué datos recolecta, para qué los usa y
                a quién se los entrega.
              </li>
              <li>
                <strong>Facilapr es el encargado del tratamiento.</strong>{" "}
                Procesamos esos datos por cuenta del comité y siguiendo sus
                instrucciones. No los usamos para fines propios, no los vendemos
                y no los compartimos con terceros salvo lo descrito aquí.
              </li>
            </ul>
            <p className="mt-3">
              Si eres socio de un comité y quieres ejercer tus derechos sobre
              tus datos, dirígete primero a tu comité. Si prefieres escribirnos
              directamente, lo derivaremos a quien corresponda.
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">
              2. Qué datos tratamos
            </h2>
            <p className="mt-3">
              Solo los que el comité carga en el sistema o que se generan al
              usarlo:
            </p>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong>De los socios:</strong> nombre, RUT, teléfono,
                dirección, número de cliente, lecturas del medidor, consumo,
                boletas, pagos y deuda pendiente.
              </li>
              <li>
                <strong>Del comité y su directiva:</strong> nombre del comité,
                RUT, dirección, teléfono, correo, y el nombre y cargo de quien
                administra la cuenta.
              </li>
              <li>
                <strong>Sesión del panel de socios:</strong> cuando un socio pide
                acceso a su panel, guardamos su RUT y una clave que solo él
                conoce (nunca en texto plano). Su directiva debe aprobar el
                acceso antes de que la cuenta quede activa.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">
              3. Datos sensibles: tu situación de pago
            </h2>
            <p className="mt-3">
              La Ley 21.719 considera{" "}
              <strong>dato sensible la situación socioeconómica</strong> de una
              persona. La deuda y el historial de pagos de un socio entran en
              esa categoría, y eso nos obliga a tratarlos con especial cuidado:
            </p>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
              <li>
                El sitio público de un comité <strong>nunca</strong> muestra
                deudas, nombres ni datos de socios: solo tarifas generales,
                avisos y datos de contacto.
              </li>
              <li>
                El asistente del sitio web está expresamente impedido de
                responder consultas sobre deudas, aunque le entreguen un RUT o
                un nombre. Deriva siempre al panel de socios.
              </li>
              <li>
                En el panel de socios solo respondemos sobre la deuda del
                socio que inició sesión con su RUT y clave, y previa
                aprobación de su directiva.
              </li>
              <li>
                Cada comité ve únicamente los datos de sus propios socios.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">
              4. Para qué usamos los datos
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
              <li>Emitir boletas y registrar pagos y lecturas del medidor.</li>
              <li>
                Responder, en el panel de cada socio, sus consultas sobre su
                propia cuenta.
              </li>
              <li>
                Publicar avisos de corte, tarifas y datos de contacto en el
                sitio del comité.
              </li>
              <li>Mantener el servicio funcionando y darle soporte al comité.</li>
            </ul>
            <p className="mt-3">
              No usamos los datos de los socios para publicidad, no los
              vendemos, y no los usamos para entrenar modelos de inteligencia
              artificial.
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">
              5. Dónde están alojados y quién más los procesa
            </h2>
            <p className="mt-3">
              Para prestar el servicio trabajamos con proveedores que pueden
              procesar datos fuera de Chile. Esto constituye una transferencia
              internacional de datos y lo declaramos de forma transparente:
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-[0.9rem]">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2.5 pr-4 font-semibold">Proveedor</th>
                    <th className="py-2.5 pr-4 font-semibold">Para qué</th>
                    <th className="py-2.5 font-semibold">Dónde</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <td className="py-2.5 pr-4">Neon (sobre AWS)</td>
                    <td className="py-2.5 pr-4">Base de datos</td>
                    <td className="py-2.5">Brasil</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2.5 pr-4">Vercel</td>
                    <td className="py-2.5 pr-4">Alojamiento de la aplicación</td>
                    <td className="py-2.5">Estados Unidos</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4">Anthropic y OpenAI</td>
                    <td className="py-2.5 pr-4">
                      Generar las respuestas del asistente
                    </td>
                    <td className="py-2.5">Estados Unidos</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              A los proveedores de inteligencia artificial se les envía
              únicamente lo necesario para responder la consulta del momento.
              Sus condiciones de uso comercial no permiten emplear ese contenido
              para entrenar sus modelos.
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">
              6. Cuánto tiempo los conservamos
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong>Datos de socios, boletas y pagos:</strong> mientras el
                comité mantenga su cuenta activa, porque son parte de su
                registro contable.
              </li>
              <li>
                <strong>Al cerrar la cuenta:</strong> el comité puede exportar
                sus datos. Transcurridos 90 días desde el cierre, eliminamos
                todo, salvo lo que la ley obligue a conservar.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">7. Tus derechos</h2>
            <p className="mt-3">
              La Ley 21.719 te reconoce los siguientes derechos sobre tus datos
              personales:
            </p>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong>Acceso:</strong> saber qué datos tuyos tratamos.
              </li>
              <li>
                <strong>Rectificación:</strong> corregir datos erróneos o
                incompletos.
              </li>
              <li>
                <strong>Supresión:</strong> pedir que se eliminen, cuando
                corresponda.
              </li>
              <li>
                <strong>Oposición:</strong> oponerte a un tratamiento
                determinado.
              </li>
              <li>
                <strong>Portabilidad:</strong> recibir tus datos en un formato
                que puedas reutilizar.
              </li>
              <li>
                <strong>Bloqueo:</strong> suspender temporalmente el uso de tus
                datos mientras se resuelve un reclamo.
              </li>
            </ul>
            <p className="mt-3">
              Las solicitudes se responden dentro de{" "}
              <strong>30 días corridos</strong>. Como los datos de los socios
              pertenecen a cada comité, dirige tu solicitud a tu comité; si nos
              escribes a nosotros, la derivaremos y te lo informaremos.
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">
              8. Seguridad y brechas
            </h2>
            <p className="mt-3">
              Ciframos las conexiones, aislamos los datos de cada comité y
              limitamos el acceso a lo estrictamente necesario. Ningún sistema
              es infalible: si ocurre una brecha que afecte datos personales, la
              notificaremos a la Agencia de Protección de Datos Personales
              dentro de <strong>72 horas</strong> y, tratándose de datos
              sensibles, también a las personas afectadas, en lenguaje claro.
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">9. Contacto</h2>
            <p className="mt-3">
              Para cualquier consulta sobre esta política o sobre tus datos,
              escríbenos a{" "}
              <a
                href="mailto:hola@facilapr.cl"
                className="font-medium text-primary hover:underline"
              >
                hola@facilapr.cl
              </a>
              .
            </p>
            <p className="mt-3">
              También puedes reclamar ante la Agencia de Protección de Datos
              Personales una vez que entre en funcionamiento.
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
