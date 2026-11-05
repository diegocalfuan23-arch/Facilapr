import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { aprDeInvitacion } from "@/lib/invitaciones";
import { InvitacionForm } from "@/components/auth/invitacion-form";

export const metadata: Metadata = {
  title: "Unirme a mi comité — Facilapr",
};

export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const apr = await aprDeInvitacion(codigo);

  if (!apr) {
    return (
      <div className="w-full max-w-[440px] text-center">
        <h1 className="text-[1.4rem] font-semibold tracking-tight">
          Invitación no válida
        </h1>
        <p className="mt-2 text-[0.95rem] text-muted-foreground">
          Este enlace ya se usó o venció. Pide al administrador de tu comité
          que te envíe uno nuevo desde el panel.
        </p>
      </div>
    );
  }

  const tesorero = apr.rol === "TESORERO";

  return (
    <div className="w-full max-w-[440px]">
      <h1 className="text-[1.4rem] font-semibold tracking-tight">
        Únete como {tesorero ? "tesorero" : "operador"} de {apr.nombre}
      </h1>
      <p className="mt-2 text-[0.95rem] text-muted-foreground">
        {tesorero
          ? "Crea tu cuenta para llevar las finanzas del comité: pagos, caja, compras e inventario."
          : "Crea tu cuenta para cargar lecturas de terreno. El administrador del comité revisa y aprueba cada lectura antes de que se cobre."}
      </p>

      <InvitacionForm codigo={codigo} apr={apr} cargo={tesorero ? "tesorero" : "operador"} />
    </div>
  );
}
