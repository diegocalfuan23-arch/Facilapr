
const AVISOS: Record<string, { texto: string; error?: boolean }> = {
  ok: { texto: "Cuenta de Mercado Pago conectada." },
  cancelado: { texto: "No se conectó: cancelaste la autorización en Mercado Pago.", error: true },
  invalido: { texto: "No se pudo comprobar la autorización. Vuelve a intentarlo con el botón «Conectar Mercado Pago».", error: true },
  error: { texto: "Mercado Pago no aceptó la conexión. Vuelve a intentarlo en unos minutos.", error: true },
  "no-disponible": { texto: "La conexión con Mercado Pago no está disponible todavía.", error: true },
};

/**
 * Aviso de Mercado Pago bajo el encabezado de Pagos: solo cuando algo salió mal al
 * conectar (con el motivo que da Mercado Pago) o falta configurar el servidor.
 * Cuando todo está bien no se muestra nada: la cuenta conectada se ve en el check
 * verde del botón «Link de pago».
 */
export function MercadoPagoCard({
  configurado,
  aviso,
  detalle,
}: {
  configurado: boolean;
  aviso?: string;
  detalle?: string;
}) {
  const mensaje = aviso ? AVISOS[aviso] : undefined;
  const error = mensaje?.error ? mensaje : undefined;
  if (!error && configurado) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-[0.88rem] text-red-800">
          {error.texto}
          {detalle && <span className="mt-1 block font-mono text-[0.78rem] break-words">Detalle: {detalle}</span>}
        </p>
      )}
      {!configurado && (
        <p className="text-[0.85rem] text-muted-foreground">Falta terminar la configuración de Mercado Pago en el servidor.</p>
      )}
    </div>
  );
}
