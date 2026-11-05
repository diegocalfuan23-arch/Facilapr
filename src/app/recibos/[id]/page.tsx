import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFinanzas } from "@/lib/apr-session";
import { reciboDeComite } from "@/lib/recibo";
import { Recibo } from "@/components/recibos/recibo";
import { ImprimirBoton } from "@/components/recibos/imprimir-boton";

type Props = { params: Promise<{ id: string }> };

// Es un comprobante con datos personales: no debe indexarse.
export const metadata: Metadata = {
  title: "Recibo",
  robots: { index: false, follow: false },
};

export default async function ReciboPage({ params }: Props) {
  const { id } = await params;
  const { apr } = await requireFinanzas();

  const recibo = await reciboDeComite(apr.id, id);
  if (!recibo) notFound();

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/panel/boletas"
          className="text-[0.9rem] text-muted-foreground hover:underline"
        >
          ← Volver a boletas
        </Link>
        <ImprimirBoton />
      </div>
      <Recibo r={recibo} />
    </div>
  );
}
