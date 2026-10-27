import { desconectarMercadoPago } from "@/app/panel/configuracion/mercadopago-actions";
import { Button } from "@/components/ui/button";
import type { ModoMp } from "@/lib/mercadopago";

const AVISOS: Record<string, { texto: string; error?: boolean }> = {
  ok: { texto: "Cuenta de Mercado Pago conectada." },
  cancelado: { texto: "No se conectó: cancelaste la autorización en Mercado Pago.", error: true },
  invalido: { texto: "No se pudo comprobar la autorización. Vuelve a intentarlo con el botón «Conectar Mercado Pago».", error: true },
  error: { texto: "Mercado Pago no aceptó la conexión. Vuelve a intentarlo en unos minutos.", error: true },
  "no-disponible": { texto: "La conexión con Mercado Pago no está disponible todavía.", error: true },
};

/**
 * Franja de estado de Mercado Pago sobre la tabla de Pagos: el aviso tras conectar
 * (o el error) y, con la cuenta conectada, quién es y cómo desconectarla. Sin nada
 * que decir no se muestra. El botón para conectar está junto a «Registrar pago».
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

  if (!mensaje && !conexion && configurado) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {mensaje && (
        <p
          role="status"
          className={`rounded-lg px-3.5 py-2.5 text-[0.88rem] ${mensaje.error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
        >
          {mensaje.texto}
          {mensaje.error && detalle && (
            <span className="mt-1 block font-mono text-[0.78rem] break-words">Detalle: {detalle}</span>
          )}
        </p>
      )}

      {!configurado && (
        <p className="text-[0.85rem] text-muted-foreground">Falta terminar la configuración de Mercado Pago en el servidor.</p>
      )}

      {conexion && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.85rem] text-muted-foreground">
          <span>
            Mercado Pago conectado · cuenta <span className="font-mono">{conexion.mpUserId}</span>
          </span>
          <span
            className={
              modo === "produccion"
                ? "rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[0.64rem] font-semibold tracking-wide text-emerald-800 uppercase"
                : "rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[0.64rem] font-semibold tracking-wide text-amber-800 uppercase"
            }
          >
            {modo === "produccion" ? "Producción" : "Modo prueba"}
          </span>
          <form action={desconectarMercadoPago}>
            <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-[0.8rem]">
              Desconectar
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
