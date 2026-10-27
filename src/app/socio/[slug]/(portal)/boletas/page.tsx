import type { Metadata } from "next";
import { requireSocio } from "@/lib/socio-session";
import { basePortal } from "@/lib/portal-socio";
import { boletasDelPortal } from "@/lib/portal-socio-datos";
import { pagoEnLineaActivo } from "@/lib/mercadopago-pagos";
import {
  ListaBoletas,
  SinDatos,
  TituloPantalla,
} from "@/components/socio/boletas-ui";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pago?: string }>;
};

const AVISOS_PAGO: Record<string, { texto: string; tono: string }> = {
  ok: {
    texto: "Recibimos tu pago. Puede tardar unos minutos en verse en tus boletas.",
    tono: "bg-forest/15 text-forest",
  },
  pendiente: {
    texto: "Tu pago está pendiente en Mercado Pago. Cuando se confirme, lo verás aquí.",
    tono: "bg-tertiary/15 text-tertiary-foreground",
  },
  fallo: {
    texto: "El pago no se completó. No se te cobró nada: puedes intentarlo de nuevo.",
    tono: "bg-destructive/15 text-destructive",
  },
};

export const metadata: Metadata = { title: "Mis boletas" };

export default async function BoletasSocioPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { pago } = await searchParams;
  const aviso = pago ? AVISOS_PAGO[pago] : undefined;
  const { socio } = await requireSocio(slug);
  const base = await basePortal(slug);
  const { cuentas, lista } = await boletasDelPortal(socio);

  return (
    <>
      <TituloPantalla
        titulo="Tus boletas"
        descripcion="Todas las boletas que el comité te ha emitido."
      />
      {aviso && (
        <p role="status" className={`mb-4 rounded-xl px-4 py-3 text-[0.9rem] ${aviso.tono}`}>
          {aviso.texto}
        </p>
      )}
      {lista.length === 0 ? (
        <SinDatos>Todavía no tienes boletas emitidas.</SinDatos>
      ) : (
        <ListaBoletas
          boletas={lista}
          base={base}
          variasCuentas={cuentas.length > 1}
          pagoEnLinea={(await pagoEnLineaActivo(socio.apr)) ? { slug } : undefined}
        />
      )}
    </>
  );
}
