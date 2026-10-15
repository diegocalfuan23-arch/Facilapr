"use client";

import { toast } from "sonner";
import { useActionState, useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Gauge,
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

export type DatosConfiguracion = {
  /** El plan incluye la IA dentro del chat (Estándar y Grande). */
  iaChatDisponible: boolean;
  iaChatModo: string;
  iaChatInstrucciones: string | null;
  /** Cómo y dónde pagar: sale en cada recibo. */
  infoPago: string | null;
  /** La dirección del comité: portal de socios y sitio. */
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
  frecuenciaLectura: "MENSUAL" | "BIMENSUAL" | "TRIMESTRAL";
  toleranciaConsumoAnormal: number;
  alertaFugaConsumo: number;
  requiereFotoLectura: boolean;
  diasGraciaCorte: number;
  diasAvisoCorte: number;
  costoReconexion: number;
};

/**
 * Cada bloque guarda por separado. Un solo formulario gigante obliga a
 * revisar todo para cambiar un dato, y un error en cualquier campo bloquea
 * el resto.
 */
function Bloque({
  titulo,
  descripcion,
  accion,
  ancla,
  children,
}: {
  /** Ancla para el recorrido guiado (data-tour). */
  ancla?: string;
  titulo: string;
  descripcion: string;
  accion: (
    prev: ResultadoAccion | null,
    formData: FormData,
  ) => Promise<ResultadoAccion>;
  children: React.ReactNode;
}) {
  const [estado, enviar, pendiente] = useActionState<
    ResultadoAccion | null,
    FormData
  >(accion, null);

  // Cada guardado avisa con un toast, además del texto junto al botón.
  useEffect(() => {
    if (!estado) return;
    if (estado.ok) toast.success("Cambios guardados");
    else toast.error(estado.error);
  }, [estado]);

  return (
    <section
      data-tour={ancla}
      className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[1.05rem] font-semibold">{titulo}</h2>
      <p className="mt-0.5 text-[0.87rem] text-muted-foreground">
        {descripcion}
      </p>

      <form action={enviar} className="mt-5 flex flex-col gap-4">
        {children}

        {estado && !estado.ok && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[0.88rem] text-destructive">
            {estado.error}
          </p>
        )}

        <div className="flex items-center gap-3 border-t border-border pt-4">
          <Button type="submit" disabled={pendiente}>
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
    </section>
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
      <Label htmlFor={id}>{label}</Label>
      {children}
      {ayuda && (
        <p className="hidden text-[0.8rem] text-muted-foreground sm:block">
          {ayuda}
        </p>
      )}
    </div>
  );
}

type Seccion =
  | "comite"
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
}[] = [
  { id: "comite", label: "Comité", resumen: "Tus datos y tu enlace", icono: Building2 },
  { id: "facturacion", label: "Facturación", resumen: "Tarifas, vencimiento y cómo pagar", icono: ReceiptText },
  { id: "medidores", label: "Medidores", resumen: "Frecuencia de lectura y alertas", icono: Gauge },
  { id: "cortes", label: "Cortes", resumen: "Días de gracia y aviso de corte", icono: Scissors },
  { id: "uso", label: "Uso y consumo", resumen: "Socios, técnicos y tokens de IA", icono: BarChart3 },
  { id: "iaChat", label: "Asistente de chat", resumen: "Respuestas automáticas con IA", icono: Sparkles },
  { id: "datos", label: "Datos y privacidad", resumen: "Respaldo y borrado de datos", icono: ShieldCheck },
];

export function ConfiguracionForm({
  datos,
  resumenDatos,
  uso,
}: {
  datos: DatosConfiguracion;
  resumenDatos: ResumenDatos;
  uso: DatosUso;
}) {
  const [seccion, setSeccion] = useState<Seccion>("comite");
  // Solo celular: primero la lista de temas y, al tocar uno, su contenido. En
  // pantallas grandes se ven siempre las dos cosas (menú a un lado).
  const [vistaMovil, setVistaMovil] = useState<"lista" | "detalle">("lista");

  function abrirSeccion(id: Seccion) {
    setSeccion(id);
    setVistaMovil("detalle");
    window.scrollTo({ top: 0 });
  }

  // El asistente de chat solo existe en los planes que incluyen la IA: en los demás ni se nombra.
  const secciones = SECCIONES.filter((x) => x.id !== "iaChat" || datos.iaChatDisponible);
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
            "shrink-0 flex-col gap-2 lg:flex lg:w-56 lg:gap-1",
            vistaMovil === "lista" ? "flex" : "hidden"
          )}
        >
          {secciones.map(({ id, label, resumen, icono: Icono }) => (
            <button
              key={id}
              type="button"
              data-tour={`cfg-${id}`}
              onClick={() => abrirSeccion(id)}
              aria-current={seccion === id ? "page" : undefined}
              className={cn(
                // Celular: fila con borde, ícono, nombre, resumen y flecha.
                "flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors",
                // Pantallas grandes: pestaña lateral compacta.
                "lg:gap-2.5 lg:rounded-lg lg:border-0 lg:bg-transparent lg:px-3 lg:py-2.5",
                seccion === id
                  ? "lg:bg-primary lg:text-primary-foreground"
                  : "lg:text-muted-foreground lg:hover:bg-muted lg:hover:text-foreground"
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary lg:size-auto lg:bg-transparent lg:text-inherit">
                <Icono className="size-4.5 lg:size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] font-medium lg:text-[0.9rem]">
                  {label}
                </span>
                <span className="block text-[0.78rem] text-muted-foreground lg:hidden">
                  {resumen}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground lg:hidden" />
            </button>
          ))}
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
        <Bloque
          titulo="Datos del comité"
          ancla="cfg-datos"
          descripcion="Aparecen en las boletas y en tu sitio público."
          accion={guardarComite}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="nombre" label="Nombre del comité">
              <Input
                id="nombre"
                name="nombre"
                defaultValue={datos.nombre}
                required
              />
            </Campo>
            <Campo
              id="razonSocial"
              label="Razón social"
              ayuda="El nombre legal, si es distinto del de uso diario."
            >
              <Input
                id="razonSocial"
                name="razonSocial"
                defaultValue={datos.razonSocial ?? ""}
              />
            </Campo>
            <Campo id="rut" label="RUT">
              <Input id="rut" name="rut" defaultValue={datos.rut} required />
            </Campo>
            <Campo id="telefono" label="Teléfono">
              <Input
                id="telefono"
                name="telefono"
                defaultValue={datos.telefono ?? ""}
                placeholder="+56 9 1234 5678"
              />
            </Campo>
            <Campo id="comuna" label="Comuna">
              <Input
                id="comuna"
                name="comuna"
                defaultValue={datos.comuna}
                required
              />
            </Campo>
            <Campo id="region" label="Región">
              <Input
                id="region"
                name="region"
                defaultValue={datos.region ?? ""}
              />
            </Campo>
            <Campo id="direccion" label="Dirección">
              <Input
                id="direccion"
                name="direccion"
                defaultValue={datos.direccion ?? ""}
              />
            </Campo>
            <Campo id="email" label="Correo">
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={datos.email ?? ""}
              />
            </Campo>
            <Campo
              id="sitioWeb"
              label="Sitio web"
              ayuda="Solo si tu comité ya tiene su propia página, fuera de Facilapr."
            >
              <Input
                id="sitioWeb"
                name="sitioWeb"
                defaultValue={datos.sitioWeb ?? ""}
                placeholder="https://…"
              />
            </Campo>
          </div>
        </Bloque>
      )}

      {seccion === "comite" && (
        <Bloque
          titulo="Tu enlace en Facilapr"
          ancla="cfg-enlace"
          descripcion="El nombre que va en el enlace de tu portal de socios y de tu sitio dentro de Facilapr. No es tu domicilio ni tu página web."
          accion={guardarDireccion}
        >
          <Campo
            id="slug"
            label="Nombre del enlace"
            ayuda="Letras minúsculas, números y guiones. Si la cambias, los enlaces anteriores dejan de funcionar: avísale a tus socios."
          >
            <div className="flex items-center overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <span className="shrink-0 bg-muted/60 px-3 py-2 text-[0.85rem] text-muted-foreground">
                facilapr.cl/
              </span>
              <input
                id="slug"
                name="slug"
                defaultValue={datos.slug ?? ""}
                placeholder="mi-comite"
                maxLength={40}
                required
                autoComplete="off"
                className="h-9 min-w-0 flex-1 bg-transparent px-2 font-mono text-sm outline-none"
              />
              <span className="shrink-0 pr-3 text-[0.85rem] text-muted-foreground">
                /cuenta
              </span>
            </div>
          </Campo>
          {datos.slug && (
            <p className="text-[0.82rem] text-muted-foreground">
              Tu portal de socios hoy:{" "}
              <span className="font-mono text-foreground">
                facilapr.cl/{datos.slug}/cuenta/entrar
              </span>
            </p>
          )}
        </Bloque>
      )}

      {seccion === "facturacion" && (
        <Bloque
          titulo="Facturación"
          descripcion="Cuánto se cobra, cuándo se emiten las boletas y cuándo vencen."
          accion={guardarFacturacion}
        >
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
        </Bloque>
      )}

      {seccion === "medidores" && (
        <Bloque
          titulo="Medidores y lecturas"
          descripcion="Cada cuánto se toman las lecturas y cuándo avisar de un consumo raro."
          accion={guardarMedidores}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="frecuenciaLectura" label="Frecuencia de lectura">
              <select
                id="frecuenciaLectura"
                name="frecuenciaLectura"
                defaultValue={datos.frecuenciaLectura}
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
              técnico todavía no pide ni guarda la foto, así que el interruptor
              prometía algo que no pasaba. Se vuelve a mostrar cuando exista la
              subida de fotos. Mientras, el valor guardado se conserva tal cual. */}
          {datos.requiereFotoLectura && (
            <input type="hidden" name="requiereFotoLectura" value="on" />
          )}
        </Bloque>
      )}

      {seccion === "cortes" && (
        <Bloque
          titulo="Cortes por morosidad"
          descripcion="Cuánto se espera después del vencimiento y cuántos días se le dan al socio, desde que se le avisa, antes de cortar."
          accion={guardarCortes}
        >
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
        </Bloque>
      )}

      {seccion === "iaChat" && datos.iaChatDisponible && (
          <Bloque
            titulo="Asistente de IA en el chat"
            descripcion="Responde a tus socios en segundos y te pasa la conversación cuando hace falta."
            accion={guardarIaChat}
          >
            <Campo
              id="iaChatModo"
              label="Cuándo responde"
              ayuda="Próximamente: responder solo si la directiva no contesta en unos minutos."
            >
              <select
                id="iaChatModo"
                name="iaChatModo"
                defaultValue={datos.iaChatModo === "SIEMPRE" ? "SIEMPRE" : "APAGADO"}
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
          </Bloque>
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
