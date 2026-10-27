"use client";

import { useActionState, useEffect, useRef } from "react";
import { Check, Loader2, MessageCircle, Mail } from "lucide-react";
import { formatearTelefono } from "@/lib/formato";
import {
  enviarConsulta,
  type ResultadoConsulta,
} from "@/app/actions-contacto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const WHATSAPP_CONTACTO = "+56942506724";

export function ContactSection() {
  const [estado, accion, pendiente] = useActionState<
    ResultadoConsulta | null,
    FormData
  >(enviarConsulta, null);

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
    <section id="contacto" className="border-y border-border bg-muted/40 py-24">
      <div className="mx-auto grid max-w-[1180px] gap-16 px-7 sm:grid-cols-[0.85fr_1.15fr]">
        <div>
          <h2 className="mt-3 text-[clamp(1.7rem,2.8vw,2.2rem)] font-semibold text-balance">
            Cuéntanos de tu APR y te contactamos.
          </h2>
          <p className="mt-3.5 max-w-[42ch] text-[1.02rem] leading-relaxed text-muted-foreground">
            Respondemos dentro de 1 día hábil. Sin compromiso, sin costo por
            la primera conversación.
          </p>

          <div className="mt-8.5 flex flex-col gap-4.5">
            <a
              href={`https://wa.me/${WHATSAPP_CONTACTO.replace("+", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-[0.92rem] transition-opacity hover:opacity-80"
            >
              <MessageCircle className="size-4.5 shrink-0 text-primary" />
              <div>
                <strong className="block text-[0.88rem]">
                  WhatsApp directo
                </strong>
                <span className="text-muted-foreground">
                  {formatearTelefono(WHATSAPP_CONTACTO)}
                </span>
              </div>
            </a>
            <div className="flex items-center gap-3 text-[0.92rem]">
              <Mail className="size-4.5 shrink-0 text-primary" />
              <div>
                <strong className="block text-[0.88rem]">Correo</strong>
                <span className="text-muted-foreground">
                  hola@facilapr.cl
                </span>
              </div>
            </div>
          </div>
        </div>

        <form
          ref={formRef}
          action={accion}
          className="grid gap-4.5 rounded-2xl border border-border bg-card p-7.5 shadow-md sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" placeholder="Tu nombre" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apr">APR o SSR</Label>
            <Input
              id="apr"
              name="apr"
              placeholder="Ej: APR Pitrelahué"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="contacto-medio">Email o teléfono</Label>
            <Input
              id="contacto-medio"
              name="contacto"
              placeholder="tucorreo@ejemplo.cl"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="mensaje">Mensaje</Label>
            <Textarea
              id="mensaje"
              name="mensaje"
              rows={4}
              maxLength={2000}
              placeholder="Cuéntanos cuántos socios tiene tu comité y qué te gustaría resolver primero."
            />
          </div>

          {/* De dónde vino la visita (document.referrer), para saber qué
              canal trae consultas reales. Se rellena por JS al montar. */}
          <input ref={origenRef} type="hidden" name="origenCliente" />

          {/* Trampa para bots: fuera de la vista y del foco, nunca la llena
              una persona. Si viene con algo, la consulta se descarta. */}
          <div aria-hidden className="hidden">
            <label htmlFor="sitioWeb">No completar</label>
            <input
              id="sitioWeb"
              name="sitioWeb"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {estado && !estado.ok && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-[0.88rem] text-destructive sm:col-span-2"
            >
              {estado.error}
            </p>
          )}
          {estado?.ok && (
            <p className="flex items-center gap-2 rounded-lg bg-forest/10 px-3.5 py-2.5 text-[0.88rem] text-forest sm:col-span-2">
              <Check className="size-4 shrink-0" />
              Consulta recibida. Te contactamos dentro de 1 día hábil.
            </p>
          )}

          <Button
            type="submit"
            disabled={pendiente}
            className="justify-self-start sm:col-span-2"
          >
            {pendiente && <Loader2 className="animate-spin" />}
            {pendiente ? "Enviando…" : "Enviar consulta"}
          </Button>
        </form>
      </div>
    </section>
  );
}
