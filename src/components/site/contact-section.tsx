"use client";

import { useActionState, useEffect, useRef } from "react";
import { Check, Loader2 } from "lucide-react";
import { formatearTelefono } from "@/lib/formato";
import { enviarConsulta, type ResultadoConsulta } from "@/app/actions-contacto";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const WHATSAPP_CONTACTO = "+56942506724";
const TITULO = "font-semibold tracking-[-0.035em] [text-wrap:balance]";
// Los campos del formulario son claros aunque el sistema esté en modo oscuro: van sobre una tarjeta blanca.
const campo = "mt-2 h-12 rounded-xl border-[#E4E1F0] bg-[#F7F6FC] text-[15px] text-[#15132B] shadow-none dark:bg-[#F7F6FC]";

export function ContactSection() {
  const [estado, accion, pendiente] = useActionState<ResultadoConsulta | null, FormData>(enviarConsulta, null);

  const formRef = useRef<HTMLFormElement>(null);
  const origenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (estado?.ok) formRef.current?.reset();
  }, [estado]);

  // document.referrer solo existe en el cliente y solo tiene el valor
  // correcto en la carga inicial de la página (no cambia con la
  // navegación de una SPA), así que se lee una vez al montar.
  useEffect(() => {
    if (origenRef.current) origenRef.current.value = document.referrer;
  }, []);

  return (
    <section id="contacto" className="scroll-mt-20 px-4 pb-16 sm:px-8 md:pb-24">
      <div className="relative mx-auto grid max-w-[1180px] items-center gap-10 overflow-hidden rounded-[36px] bg-[#0B0A1F] p-6 text-white md:p-12 lg:grid-cols-2">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_15%_20%,rgba(70,90,255,0.5),transparent_70%)]" />
        <div className="relative">
          <h2 className={`${TITULO} text-4xl leading-[1.08] md:text-[52px]`}>Veamos tu comité</h2>
          <p className="mt-3 text-lg text-white/80">Respondemos dentro de 1 día hábil. Sin compromiso, sin costo por la primera conversación.</p>
          <div className="mt-6 flex flex-col gap-2">
            <a
              href={`https://wa.me/${WHATSAPP_CONTACTO.replace("+", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit rounded-full bg-white/10 px-4 py-2 text-[15px] font-medium transition-colors hover:bg-white/20"
            >
              WhatsApp {formatearTelefono(WHATSAPP_CONTACTO)}
            </a>
            <a href="mailto:hola@facilapr.cl" className="w-fit rounded-full bg-white/10 px-4 py-2 text-[15px] font-medium transition-colors hover:bg-white/20">
              hola@facilapr.cl
            </a>
          </div>
        </div>

        <div className="relative rounded-[24px] bg-white p-5 text-[#15132B] md:p-6">
          <form ref={formRef} action={accion} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nombre" className="text-sm font-medium">
                Nombre
              </label>
              <Input id="nombre" name="nombre" placeholder="Tu nombre" required className={campo} />
            </div>
            <div>
              <label htmlFor="apr" className="text-sm font-medium">
                APR o SSR
              </label>
              <Input id="apr" name="apr" placeholder="Ej: APR Pitrelahué" required className={campo} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="contacto-medio" className="text-sm font-medium">
                Email o teléfono
              </label>
              <Input id="contacto-medio" name="contacto" placeholder="tucorreo@ejemplo.cl" required className={campo} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="mensaje" className="text-sm font-medium">
                ¿Cuántos socios tienen?
              </label>
              <Textarea
                id="mensaje"
                name="mensaje"
                rows={3}
                maxLength={2000}
                placeholder="Cuéntanos cuántos socios tiene tu comité y qué te gustaría resolver primero."
                className="mt-2 rounded-xl border-[#E4E1F0] bg-[#F7F6FC] text-[15px] text-[#15132B] shadow-none dark:bg-[#F7F6FC]"
              />
            </div>

            {/* De dónde vino la visita (document.referrer), para saber qué
                canal trae consultas reales. Se rellena por JS al montar. */}
            <input ref={origenRef} type="hidden" name="origenCliente" />

            {/* Trampa para bots: fuera de la vista y del foco, nunca la llena
                una persona. Si viene con algo, la consulta se descarta. */}
            <div aria-hidden className="hidden">
              <label htmlFor="sitioWeb">No completar</label>
              <input id="sitioWeb" name="sitioWeb" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            {estado && !estado.ok && (
              <p role="alert" className="rounded-xl bg-[#FDECEC] px-4 py-3 text-[0.88rem] text-[#A32020] sm:col-span-2">
                {estado.error}
              </p>
            )}
            {estado?.ok && (
              <p role="status" className="flex items-center gap-2 rounded-xl bg-[#DFF4EB] px-4 py-3 text-[0.88rem] text-[#075A3C] sm:col-span-2">
                <Check className="size-4 shrink-0" />
                Consulta recibida. Te contactamos dentro de 1 día hábil.
              </p>
            )}

            <button
              type="submit"
              disabled={pendiente}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#3A0CE3] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#2A07A8] focus-visible:ring-2 focus-visible:ring-[#3A0CE3] focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60 sm:col-span-2"
            >
              {pendiente && <Loader2 className="size-4 animate-spin" />}
              {pendiente ? "Enviando…" : "Enviar consulta"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
