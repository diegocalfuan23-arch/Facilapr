"use client";

import { toast } from "sonner";
import { useActionState, useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Gauge,
  MessageCircle,
  Loader2,
  ReceiptText,
  Scissors,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  DatosPrivacidad,
  type ResumenDatos,
} from "@/components/panel/datos-privacidad";
import {
  guardarComite,
  guardarCortes,
  guardarDireccion,
  guardarFacturacion,
  guardarIaChat,
  guardarMedidores,
  type ResultadoAccion,
} from "@/app/panel/configuracion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { UsoComite, type DatosUso } from "@/components/panel/uso-comite";
import { AjusteBuscador, AjustesWhatsapp } from "@/components/panel/ajustes-comite";
import { LogoComite } from "@/components/panel/logo-comite";
import type { ConexionWhatsapp } from "@/components/panel/conectar-whatsapp";
import type { CupoWhatsapp } from "@/lib/whatsapp-cupo-comun";

export type DatosConfiguracion = {
  /** El plan incluye la IA dentro del chat (Estándar y Grande). */
  iaChatDisponible: boolean;
  iaChatModo: string;
  iaChatInstrucciones: string | null;
  /** Cómo y dónde pagar: sale en cada recibo. */
  infoPago: string | null;
  /** La dirección del comité: la de su portal de socios. */
  slug: string | null;
  nombre: string;
  razonSocial: string | null;
  rut: string;
  comuna: string;
  region: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  sitioWeb: string | null;
  /** Horario de atención de la oficina: lo usa la IA del chat para responder a los socios. */
  horarioAtencion: string | null;
  /** El logo del comité (PNG incrustado): sale en recibos y comprobantes. */
  logoUrl: string | null;
  /** Tarifa única del comité: cargo fijo + valor por m³ (CLP). */
  tarifaCargoFijo: number | null;
  tarifaMetroCubico: number | null;
  tarifaCargoFijoComercial: number | null;
  tarifaMetroCubicoComercial: number | null;
  diaGeneracionBoletas: number;
  diasVencimiento: number;
  prefijoBoleta: string;
  incluyeIva: boolean;
  porcentajeIva: number;
  /** El recibo lleva el QR a la cuenta en línea del socio. */
  qrEnBoleta: boolean;
  /** El plan incluye la cuenta en línea (y por eso el QR). */
  qrDisponible: boolean;
  frecuenciaLectura: "MENSUAL" | "BIMENSUAL" | "TRIMESTRAL";
  toleranciaConsumoAnormal: number;
  alertaFugaConsumo: number;
  requiereFotoLectura: boolean;
  diasGraciaCorte: number;
  diasAvisoCorte: number;
  costoReconexion: number;
  /** Sale en el buscador público de socios. */
  apareceEnBuscador: boolean;
  /** El envío por la API de WhatsApp está activo en el servidor. */
  whatsappDisponible: boolean;
  /** Mensajes automáticos del mes (null si el envío por API no está activo). */
  cupoWhatsapp: CupoWhatsapp | null;
  /** El comprobante sale solo por WhatsApp al registrar un pago. */
  whatsappComprobanteAuto: boolean;
  /** Se puede conectar el WhatsApp propio del comité. */
  conexionWhatsappDisponible: boolean;
  conexionWhatsapp: ConexionWhatsapp | null;
};

const GRIS = "text-[#5B5970]";
const CAMPO = "h-11 rounded-xl border-[#E4E1F0] bg-white shadow-none";
const SELECT = "h-11 w-full rounded-xl border border-[#E4E1F0] bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const REGIONES = ["Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso", "Metropolitana", "O'Higgins", "Maule", "Ñuble", "Biobío", "La Araucanía", "Los Ríos", "Los Lagos", "Aysén", "Magallanes"];

/** La tarjeta de una sección: ícono y título arriba, sus bloques abajo. */
function Tarjeta({ icono: Icono, titulo, children }: { icono: typeof Building2; titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(58,12,227,0.08)]">
      <div className="flex items-center gap-3 border-b border-[#F0EEF6] px-5 py-4 sm:px-7">
        <span aria-hidden className="flex size-9 items-center justify-center rounded-xl bg-[#ECE8FD] text-[#3A0CE3]">
          <Icono className="size-[18px]" />
        </span>
        <h2 className="text-[17px] font-semibold">{titulo}</h2>
      </div>
      {children}
    </div>
  );
}

/** Un tema dentro de la tarjeta: el título a la izquierda y sus campos a la derecha. */
function Fila({ titulo, sub, ancla, children }: { titulo: string; sub?: string; ancla?: string; children: React.ReactNode }) {
  return (
    <section data-tour={ancla} className="grid gap-4 border-t border-[#F0EEF6] px-5 py-6 first:border-t-0 sm:px-7 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
      <div>
        <h3 className="text-[15px] font-semibold">{titulo}</h3>
        {sub ? <p className={cn("mt-1 text-[13px] leading-relaxed", GRIS)}>{sub}</p> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * Cada formulario guarda por separado. Un solo formulario gigante obliga a
 * revisar todo para cambiar un dato, y un error en cualquier campo bloquea
 * el resto.
 */
function Formulario({
  accion,
  children,
}: {
  accion: (prev: ResultadoAccion | null, formData: FormData) => Promise<ResultadoAccion>;
  children: React.ReactNode;
}) {
  const [estado, enviar, pendiente] = useActionState<ResultadoAccion | null, FormData>(accion, null);

  // Cada guardado avisa con un toast, además del texto junto al botón.
  useEffect(() => {
    if (!estado) return;
    if (estado.ok) toast.success("Cambios guardados");
    else toast.error(estado.error);
  }, [estado]);

  return (
    <form action={enviar}>
      {children}
      {estado && !estado.ok && (
        <p className="mx-5 mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[0.88rem] text-destructive sm:mx-7">
          {estado.error}
        </p>
      )}
      <div className="flex items-center gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-4 sm:px-7">
        <Button type="submit" disabled={pendiente} className="h-11 rounded-xl px-5 font-semibold">
          {pendiente && <Loader2 className="animate-spin" />}
          Guardar
        </Button>
        {estado?.ok && (
          <span className="flex items-center gap-1.5 text-[0.88rem] text-forest">
            <Check className="size-4" />
            Guardado
          </span>
        )}
      </div>
    </form>
  );
}

function Campo({
  id,
  label,
  ayuda,
  children,
}: {
  id: string;
  label: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[13px] font-semibold">{label}</Label>
      {children}
      {ayuda && (
        <p className="hidden text-xs text-[#5B5970] sm:block">
          {ayuda}
        </p>
      )}
    </div>
  );
}

type Seccion =
  | "comite"
  | "whatsapp"
  | "uso"
  | "facturacion"
  | "medidores"
  | "cortes"
  | "iaChat"
  | "datos";

const SECCIONES: {
  id: Seccion;
  label: string;
  /** Qué hay adentro: se muestra en la lista del celular. */
  resumen: string;
  icono: typeof Building2;
  grupo: "General" | "Cobro" | "Cuenta";
}[] = [
  { id: "comite", label: "Comité", resumen: "Tus datos y tu enlace", icono: Building2, grupo: "General" },
  { id: "whatsapp", label: "WhatsApp", resumen: "Número y mensajes automáticos", icono: MessageCircle, grupo: "General" },
  { id: "iaChat", label: "Asistente de chat", resumen: "Respuestas automáticas con IA", icono: Sparkles, grupo: "General" },
  { id: "facturacion", label: "Facturación", resumen: "Tarifas, vencimiento y cómo pagar", icono: ReceiptText, grupo: "Cobro" },
  { id: "medidores", label: "Medidores", resumen: "Frecuencia de lectura y alertas", icono: Gauge, grupo: "Cobro" },
  { id: "cortes", label: "Cortes", resumen: "Días de gracia y aviso de corte", icono: Scissors, grupo: "Cobro" },
  { id: "uso", label: "Uso y consumo", resumen: "Socios, operadores y tokens de IA", icono: BarChart3, grupo: "Cuenta" },
  { id: "datos", label: "Datos y privacidad", resumen: "Respaldo y borrado de datos", icono: ShieldCheck, grupo: "Cuenta" },
];

export function ConfiguracionForm({
  datos,
  resumenDatos,
  uso,
  abrirFacturacion = false,
}: {
  datos: DatosConfiguracion;
  resumenDatos: ResumenDatos;
  uso: DatosUso;
  abrirFacturacion?: boolean;
}) {
  const [seccion, setSeccion] = useState<Seccion>(abrirFacturacion ? "facturacion" : "comite");
  // Solo celular: primero la lista de temas y, al tocar uno, su contenido. En
  // pantallas grandes se ven siempre las dos cosas (menú a un lado).
  const [vistaMovil, setVistaMovil] = useState<"lista" | "detalle">(abrirFacturacion ? "detalle" : "lista");

  function abrirSeccion(id: Seccion) {
    setSeccion(id);
    setVistaMovil("detalle");
    window.scrollTo({ top: 0 });
  }

  // El asistente de chat solo existe en los planes que incluyen la IA: en los demás ni se nombra.
  const secciones = SECCIONES.filter(
    (x) =>
      (x.id !== "iaChat" || datos.iaChatDisponible) &&
      (x.id !== "whatsapp" || datos.conexionWhatsappDisponible || datos.whatsappDisponible)
  );
  const grupos = ["General", "Cobro", "Cuenta"] as const;
  const [copiado, setCopiado] = useState(false);
  const actual = secciones.find((x) => x.id === seccion);

  return (
    <>
      <div className={cn(vistaMovil === "detalle" && "hidden lg:block")}>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">
          Configuración
        </h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
          Tu comité y sus reglas de cobro.
        </p>
      </div>

      {/* Cinco bloques apilados eran un muro de campos. Con el menú al
          costado cada tema se ve solo, los nombres se leen en vertical sin
          competir por el ancho, y el formulario conserva el espacio. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav
          aria-label="Secciones de configuración"
          data-tour="cfg-nav"
          className={cn(
            "shrink-0 flex-col gap-2 lg:sticky lg:top-4 lg:flex lg:w-56 lg:gap-4",
            vistaMovil === "lista" ? "flex" : "hidden"
          )}
        >
          {grupos.map((g) => {
            const items = secciones.filter((x) => x.grupo === g);
            return (
              <div key={g} className="flex flex-col gap-2 lg:gap-1">
                <p className="hidden px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[#8F8CA3] lg:block">{g}</p>
                {items.map(({ id, label, resumen, icono: Icono }) => (
                  <button
                    key={id}
                    type="button"
                    data-tour={`cfg-${id}`}
                    onClick={() => abrirSeccion(id)}
                    aria-current={seccion === id ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors",
                      "lg:h-10 lg:gap-2.5 lg:border-0 lg:bg-transparent lg:px-3 lg:py-0",
                      seccion === id
                        ? "lg:bg-white lg:font-semibold lg:text-[#2A07A8] lg:shadow-sm lg:ring-1 lg:ring-[#E4DEFA]"
                        : "lg:text-[#46435C] lg:hover:bg-white/60"
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary lg:size-auto lg:bg-transparent lg:text-inherit">
                      <Icono className="size-4.5 lg:size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.95rem] font-medium lg:text-[14px]">{label}</span>
                      <span className="block text-[0.78rem] text-muted-foreground lg:hidden">{resumen}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground lg:hidden" />
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* min-w-0 evita que un campo ancho empuje el menú fuera de la vista. */}
        <div
          className={cn(
            "min-w-0 flex-1 flex-col gap-5 lg:flex",
            vistaMovil === "detalle" ? "flex" : "hidden"
          )}
        >
          <button
            type="button"
            onClick={() => setVistaMovil("lista")}
            className="-mb-1 flex items-center gap-1 self-start text-[0.9rem] font-medium text-primary lg:hidden"
          >
            <ChevronLeft className="size-4" />
            Configuración
            {actual && (
              <span className="font-normal text-muted-foreground">
                · {actual.label}
              </span>
            )}
          </button>
      {seccion === "uso" && <UsoComite uso={uso} />}

      {seccion === "comite" && (
        <Tarjeta icono={Building2} titulo="Comité">
          <Formulario accion={guardarComite}>
            <Fila titulo="Identidad" sub="Aparece en boletas, comprobantes y en el portal de socios." ancla="cfg-datos">
              <LogoComite logoUrl={datos.logoUrl} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id="nombre" label="Nombre del comité">
                  <Input id="nombre" name="nombre" defaultValue={datos.nombre} required className={CAMPO} />
                </Campo>
                <Campo id="rut" label="RUT">
                  <Input id="rut" name="rut" defaultValue={datos.rut} required className={`${CAMPO} tabular-nums`} />
                </Campo>
                <div className="sm:col-span-2">
                  <Campo id="razonSocial" label="Razón social" ayuda="El nombre legal, si es distinto del de uso diario.">
                    <Input id="razonSocial" name="razonSocial" defaultValue={datos.razonSocial ?? ""} className={CAMPO} />
                  </Campo>
                </div>
              </div>
            </Fila>

            <Fila titulo="Contacto y ubicación" sub="Para que los socios sepan cómo y cuándo encontrarlos.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id="telefono" label="Teléfono">
                  <Input id="telefono" name="telefono" defaultValue={datos.telefono ?? ""} placeholder="+56 9 1234 5678" className={CAMPO} />
                </Campo>
                <Campo id="email" label="Correo">
                  <Input id="email" name="email" type="email" defaultValue={datos.email ?? ""} className={CAMPO} />
                </Campo>
                <div className="sm:col-span-2">
                  <Campo id="direccion" label="Dirección">
                    <Input id="direccion" name="direccion" defaultValue={datos.direccion ?? ""} className={CAMPO} />
                  </Campo>
                </div>
                <Campo id="comuna" label="Comuna">
                  <Input id="comuna" name="comuna" defaultValue={datos.comuna} required className={CAMPO} />
                </Campo>
                <Campo id="region" label="Región">
                  <select id="region" name="region" defaultValue={datos.region ?? ""} className={SELECT}>
                    <option value="">Sin región</option>
                    {datos.region && !REGIONES.includes(datos.region) && <option value={datos.region}>{datos.region}</option>}
                    {REGIONES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Campo>
                <div className="sm:col-span-2">
                  <Campo id="horarioAtencion" label="Horario de atención" ayuda="Lo usa la IA del chat cuando un socio pregunta cuándo atienden.">
                    <Textarea
                      id="horarioAtencion"
                      name="horarioAtencion"
                      rows={2}
                      maxLength={300}
                      defaultValue={datos.horarioAtencion ?? ""}
                      placeholder={"Lunes a viernes, 9:00 a 14:00"}
                      className="rounded-xl border-[#E4E1F0] shadow-none"
                    />
                  </Campo>
                </div>
                <div className="sm:col-span-2">
                  <Campo id="sitioWeb" label="Sitio web propio · opcional" ayuda="Solo si tu comité ya tiene su propia página, fuera de Facilapr.">
                    <Input id="sitioWeb" name="sitioWeb" defaultValue={datos.sitioWeb ?? ""} placeholder="https://…" className={CAMPO} />
                  </Campo>
                </div>
              </div>
            </Fila>
          </Formulario>

          <div className="border-t border-[#F0EEF6]">
            <Formulario accion={guardarDireccion}>
              <Fila titulo="Portal de socios" sub="Dónde entran tus socios a ver y pagar sus boletas." ancla="cfg-enlace">
                <Campo
                  id="slug"
                  label="Enlace del portal"
                  ayuda="Minúsculas, números y guiones. Si lo cambias, los enlaces anteriores dejan de funcionar: avísale a tus socios."
                >
                  <div className="flex h-11 items-center overflow-hidden rounded-xl border border-[#E4E1F0] bg-white focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                    <span className={cn("flex h-full shrink-0 items-center border-r border-[#E4E1F0] bg-[#F7F6FB] px-3 text-sm", GRIS)}>facilapr.cl/</span>
                    <input
                      id="slug"
                      name="slug"
                      defaultValue={datos.slug ?? ""}
                      placeholder="mi-comite"
                      maxLength={40}
                      required
                      autoComplete="off"
                      className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-sm outline-none"
                    />
                    <span className={cn("hidden shrink-0 pr-3 text-sm sm:block", GRIS)}>/cuenta</span>
                  </div>
                </Campo>
                {datos.slug && (
                  <div className="flex items-center gap-2 rounded-xl bg-[#F7F5FF] px-3.5 py-2.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px]">facilapr.cl/{datos.slug}/cuenta/entrar</span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        try {
                          void navigator.clipboard?.writeText(`https://facilapr.cl/${datos.slug}/cuenta/entrar`);
                        } catch {
                          /* sin portapapeles */
                        }
                        setCopiado(true);
                        setTimeout(() => setCopiado(false), 1500);
                      }}
                      className="h-8 shrink-0 rounded-md px-2.5 text-[13px] font-semibold text-[#2A07A8]"
                    >
                      {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                      {copiado ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                )}
                <AjusteBuscador apareceEnBuscador={datos.apareceEnBuscador} tieneSlug={Boolean(datos.slug)} />
              </Fila>
            </Formulario>
          </div>
        </Tarjeta>
      )}

      {seccion === "whatsapp" && (
        <Tarjeta icono={MessageCircle} titulo="WhatsApp">
          <Fila titulo="Número del comité" sub="Los socios reciben comprobantes, boletas y avisos desde el número del comité. Meta cobra los mensajes a tu cuenta.">
            <AjustesWhatsapp
              whatsappDisponible={datos.whatsappDisponible}
              cupo={datos.cupoWhatsapp}
              comprobanteAuto={datos.whatsappComprobanteAuto}
              conexionDisponible={datos.conexionWhatsappDisponible}
              conexion={datos.conexionWhatsapp}
            />
          </Fila>
        </Tarjeta>
      )}

      {seccion === "facturacion" && (
        <Tarjeta icono={ReceiptText} titulo="Facturación">
<Formulario accion={guardarFacturacion}>
<Fila titulo="Cobro y boletas" sub="Cuánto se cobra, cuándo se emiten las boletas y cuándo vencen.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="tarifaCargoFijo"
              label="Cargo fijo ($)"
              ayuda="Lo que paga cada arranque cada mes, aunque no consuma."
            >
              <Input
                id="tarifaCargoFijo"
                name="tarifaCargoFijo"
                inputMode="numeric"
                placeholder="3000"
                defaultValue={datos.tarifaCargoFijo ?? ""}
              />
            </Campo>
            <Campo
              id="tarifaMetroCubico"
              label="Valor por m³ ($)"
              ayuda="Se multiplica por el consumo del mes y se suma al cargo fijo."
            >
              <Input
                id="tarifaMetroCubico"
                name="tarifaMetroCubico"
                inputMode="numeric"
                placeholder="500"
                defaultValue={datos.tarifaMetroCubico ?? ""}
              />
            </Campo>
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 sm:col-span-2">
              <div className="text-[0.88rem] font-medium">Tarifa comercial (opcional)</div>
              <p className="mt-0.5 mb-3 text-[0.8rem] text-muted-foreground">
                Si cobras distinto a los arranques que marcaste como comerciales, escribe su tarifa. Si la dejas vacía, pagan lo mismo que todos.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id="tarifaCargoFijoComercial" label="Cargo fijo comercial ($)">
                  <Input
                    id="tarifaCargoFijoComercial"
                    name="tarifaCargoFijoComercial"
                    inputMode="numeric"
                    placeholder="Igual al general"
                    defaultValue={datos.tarifaCargoFijoComercial ?? ""}
                  />
                </Campo>
                <Campo id="tarifaMetroCubicoComercial" label="Valor por m³ comercial ($)">
                  <Input
                    id="tarifaMetroCubicoComercial"
                    name="tarifaMetroCubicoComercial"
                    inputMode="numeric"
                    placeholder="Igual al general"
                    defaultValue={datos.tarifaMetroCubicoComercial ?? ""}
                  />
                </Campo>
              </div>
            </div>
            <Campo
              id="diaGeneracionBoletas"
              label="Día de emisión"
              ayuda="Del 1 al 28, para que exista en todos los meses."
            >
              <Input
                id="diaGeneracionBoletas"
                name="diaGeneracionBoletas"
                inputMode="numeric"
                defaultValue={datos.diaGeneracionBoletas}
              />
            </Campo>
            <Campo
              id="diasVencimiento"
              label="Días para pagar"
              ayuda="Desde la emisión hasta el vencimiento."
            >
              <Input
                id="diasVencimiento"
                name="diasVencimiento"
                inputMode="numeric"
                defaultValue={datos.diasVencimiento}
              />
            </Campo>
            <Campo
              id="prefijoBoleta"
              label="Prefijo del número"
              ayuda={`Las boletas se numeran ${datos.prefijoBoleta}000123.`}
            >
              <Input
                id="prefijoBoleta"
                name="prefijoBoleta"
                defaultValue={datos.prefijoBoleta}
                maxLength={10}
              />
            </Campo>
            <Campo
              id="porcentajeIva"
              label="Porcentaje de IVA"
              ayuda="Solo se aplica si marcas la casilla de abajo."
            >
              <Input
                id="porcentajeIva"
                name="porcentajeIva"
                inputMode="numeric"
                defaultValue={datos.porcentajeIva}
              />
            </Campo>
          </div>

          <label className="flex items-start gap-2.5 text-[0.9rem]">
            <Checkbox
              name="incluyeIva"
              defaultChecked={datos.incluyeIva}
              className="mt-0.5"
            />
            <span>
              Las boletas incluyen IVA
              <span className="mt-0.5 block text-[0.8rem] text-muted-foreground">
                La mayoría de los comités de agua rural está exenta.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-[0.9rem]">
            <Checkbox name="qrEnBoleta" defaultChecked={datos.qrDisponible && datos.qrEnBoleta} disabled={!datos.qrDisponible} className="mt-0.5" />
            <span>
              Agregar QR en la boleta
              <span className="mt-0.5 block text-[0.8rem] text-muted-foreground">
                {datos.qrDisponible
                  ? "El socio lo escanea desde el recibo impreso y entra a su cuenta en línea: ve sus boletas y pide su acceso."
                  : "Disponible desde el plan Estándar, que incluye la cuenta en línea de los socios."}
              </span>
            </span>
          </label>

          <Campo
            id="infoPago"
            label="Cómo y dónde pagar"
            ayuda="Sale en cada recibo y en el mensaje de WhatsApp. Ej: «Transferencia a la cuenta RUT 12.345.678-9, Banco Estado, a nombre del comité. En el comentario escribe tu número de cliente. También en efectivo en la oficina.»"
          >
            <Textarea
              id="infoPago"
              name="infoPago"
              rows={4}
              maxLength={600}
              defaultValue={datos.infoPago ?? ""}
            />
          </Campo>
        </Fila>
</Formulario>
</Tarjeta>
      )}

      {seccion === "medidores" && (
        <Tarjeta icono={Gauge} titulo="Medidores">
<Formulario accion={guardarMedidores}>
<Fila titulo="Lecturas y alertas" sub="Cada cuánto se toman las lecturas y cuándo avisar de un consumo raro.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="frecuenciaLectura" label="Frecuencia de lectura">
              <select
                id="frecuenciaLectura"
                name="frecuenciaLectura"
                defaultValue={datos.frecuenciaLectura}
                className={SELECT}
              >
                <option value="MENSUAL">Mensual</option>
                <option value="BIMENSUAL">Cada dos meses</option>
                <option value="TRIMESTRAL">Cada tres meses</option>
              </select>
            </Campo>
            <Campo
              id="toleranciaConsumoAnormal"
              label="Consumo anormal (%)"
              ayuda="Sobre el promedio del socio. Al superarlo, conviene revisar."
            >
              <Input
                id="toleranciaConsumoAnormal"
                name="toleranciaConsumoAnormal"
                inputMode="numeric"
                defaultValue={datos.toleranciaConsumoAnormal}
              />
            </Campo>
            <Campo
              id="alertaFugaConsumo"
              label="Posible fuga (%)"
              ayuda="Un salto de este tamaño casi siempre es una fuga."
            >
              <Input
                id="alertaFugaConsumo"
                name="alertaFugaConsumo"
                inputMode="numeric"
                defaultValue={datos.alertaFugaConsumo}
              />
            </Campo>
          </div>

          {/* "Pedir foto del medidor" está oculto a propósito: el formulario del
              operador todavía no pide ni guarda la foto, así que el interruptor
              prometía algo que no pasaba. Se vuelve a mostrar cuando exista la
              subida de fotos. Mientras, el valor guardado se conserva tal cual. */}
          {datos.requiereFotoLectura && (
            <input type="hidden" name="requiereFotoLectura" value="on" />
          )}
        </Fila>
</Formulario>
</Tarjeta>
      )}

      {seccion === "cortes" && (
        <Tarjeta icono={Scissors} titulo="Cortes">
<Formulario accion={guardarCortes}>
<Fila titulo="Cortes por morosidad" sub="Días de espera tras el vencimiento y plazo desde el aviso.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo
              id="diasGraciaCorte"
              label="Días de gracia"
              ayuda="Días después del vencimiento antes de que el socio aparezca en la lista de morosos para cortar."
            >
              <Input
                id="diasGraciaCorte"
                name="diasGraciaCorte"
                inputMode="numeric"
                defaultValue={datos.diasGraciaCorte}
              />
            </Campo>
            <Campo
              id="diasAvisoCorte"
              label="Plazo tras el aviso"
              ayuda="Días que se le dan al socio, desde el aviso, para regularizar antes de cortar. Va escrito en el mensaje de aviso."
            >
              <Input
                id="diasAvisoCorte"
                name="diasAvisoCorte"
                inputMode="numeric"
                defaultValue={datos.diasAvisoCorte}
              />
            </Campo>
            <Campo
              id="costoReconexion"
              label="Costo de reconexión"
              ayuda="En pesos. Deja 0 si no se cobra."
            >
              <Input
                id="costoReconexion"
                name="costoReconexion"
                inputMode="numeric"
                defaultValue={datos.costoReconexion}
              />
            </Campo>
          </div>
        </Fila>
</Formulario>
</Tarjeta>
      )}

      {seccion === "iaChat" && datos.iaChatDisponible && (
          <Tarjeta icono={Sparkles} titulo="Asistente de chat">
<Formulario accion={guardarIaChat}>
<Fila titulo="Asistente de IA" sub="Responde a tus socios en segundos y te pasa la conversación cuando hace falta.">
            <Campo
              id="iaChatModo"
              label="Cuándo responde"
              ayuda="Próximamente: responder solo si la directiva no contesta en unos minutos."
            >
              <select
                id="iaChatModo"
                name="iaChatModo"
                defaultValue={datos.iaChatModo === "SIEMPRE" ? "SIEMPRE" : "APAGADO"}
                className={SELECT}
              >
                <option value="APAGADO">Apagado: solo responde la directiva</option>
                <option value="SIEMPRE">Siempre responde primero</option>
              </select>
            </Campo>

            <Campo
              id="iaChatInstrucciones"
              label="Instrucciones propias"
              ayuda="Tono, reglas o respuestas a preguntas frecuentes. Ej: «Háblales de usted. Si preguntan por cortes, que llamen a la oficina de 9 a 13 h.»"
            >
              <Textarea
                id="iaChatInstrucciones"
                name="iaChatInstrucciones"
                rows={5}
                maxLength={1500}
                defaultValue={datos.iaChatInstrucciones ?? ""}
              />
            </Campo>

            <ul className="flex flex-col gap-1.5 rounded-lg bg-muted/50 px-4 py-3 text-[0.82rem] leading-relaxed text-muted-foreground">
              <li>• Sus mensajes salen marcados como «Asistente del comité · IA».</li>
              <li>• Responde con los datos de la cuenta del socio y los de tu comité. No promete plazos ni descuentos.</li>
              <li>• Si es un reclamo, un corte o no sabe, marca la conversación como «Necesita respuesta humana».</li>
              <li>• Si escribes tú en una conversación, la IA se pausa 10 minutos ahí y luego vuelve a responder.</li>
            </ul>
          </Fila>
</Formulario>
</Tarjeta>
        )}

      {seccion === "datos" && (
        <DatosPrivacidad
          resumen={resumenDatos}
          nombreComite={datos.nombre}
        />
      )}
        </div>
      </div>
    </>
  );
}
