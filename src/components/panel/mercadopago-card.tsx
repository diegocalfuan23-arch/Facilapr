import { desconectarMercadoPago } from "@/app/panel/configuracion/mercadopago-actions";
import { Button } from "@/components/ui/button";
import type { ModoMp } from "@/lib/mercadopago";

const AVISOS: Record<string, { texto: string; error?: boolean }> = {
  ok: { texto: "Cuenta de Mercado Pago conectada." },
  cancelado: { texto: "No se conectó: cancelaste la autorización en Mercado Pago.", error: true },
  invalido: { texto: "No se pudo comprobar la autorización. Vuelve a intentarlo desde este botón.", error: true },
  error: { texto: "Mercado Pago no aceptó la conexión. Vuelve a intentarlo en unos minutos.", error: true },
  "no-disponible": { texto: "La conexión con Mercado Pago no está disponible todavía.", error: true },
};

/**
 * Conectar la cuenta de Mercado Pago del comité. Solo se muestra a los comités
 * con el interruptor `mercadoPagoHabilitado` prendido.
 */
export function MercadoPagoCard({
  modo,
  configurado,
  conexion,
  aviso,
  detalle,
}: {
  modo: ModoMp;
  configurado: boolean;
  conexion: { mpUserId: string } | null;
  aviso?: string;
  detalle?: string;
}) {
  // «Conectada» solo se muestra si de verdad hay una cuenta conectada (la dirección puede traer un aviso viejo).
  const mensaje = aviso && !(aviso === "ok" && !conexion) ? AVISOS[aviso] : undefined;

  return (
    <section className="mb-6 rounded-2xl border border-border p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[1.05rem] font-semibold">Cobro en línea con Mercado Pago</h2>
        <span
          className={
            modo === "produccion"
              ? "rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-[0.68rem] font-semibold tracking-wide text-emerald-800 uppercase"
              : "rounded-full bg-amber-100 px-2.5 py-0.5 font-mono text-[0.68rem] font-semibold tracking-wide text-amber-800 uppercase"
          }
        >
          {modo === "produccion" ? "Producción" : "Modo prueba"}
        </span>
      </div>
      <p className="mt-1.5 text-[0.92rem] text-muted-foreground">
        Tus socios pagan su boleta en Mercado Pago y el dinero llega directo a la cuenta de tu comité. Facilapr no cobra
        comisión ni recibe el dinero: solo registra el pago.
      </p>

      {mensaje && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-3.5 py-2.5 text-[0.88rem] ${mensaje.error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
        >
          {mensaje.texto}
          {mensaje.error && detalle && <span className="mt-1 block font-mono text-[0.78rem] break-words">Detalle: {detalle}</span>}
        </p>
      )}

      <div className="mt-4">
        {!configurado ? (
          <p className="text-[0.88rem] text-muted-foreground">Falta terminar la configuración en el servidor.</p>
        ) : conexion ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[0.92rem]">
              Conectada · cuenta <span className="font-mono">{conexion.mpUserId}</span>
            </span>
            <span className="basis-full text-[0.88rem] text-muted-foreground">
              Ahora puedes enviar links de pago a tus socios: en esta pantalla, botón «Link de pago».
            </span>
            <form action={desconectarMercadoPago}>
              <Button type="submit" variant="outline" size="sm">
                Desconectar
              </Button>
            </form>
          </div>
        ) : (
          <p className="text-[0.88rem] text-muted-foreground">
            Todavía no hay una cuenta conectada. Usa el botón «Conectar Mercado Pago», arriba a la derecha.
          </p>
        )}
      </div>
    </section>
  );
}
