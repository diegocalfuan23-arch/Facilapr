import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs } from "@/lib/db/schema";
import { huellaDeClave, leerRestablecerClave } from "@/lib/invitacion-socio";
import { cuentaDeSocio } from "@/lib/socios-acceso";
import { basePortal } from "@/lib/portal-socio";
import { AceptarInvitacionForm } from "@/components/socio/aceptar-invitacion-form";

type Props = { params: Promise<{ slug: string; codigo: string }> };

export const metadata: Metadata = {
  title: "Elige tu clave nueva",
  robots: { index: false, follow: false },
};

/** El socio abre el enlace que le mandó su comité y elige una clave nueva. */
export default async function RestablecerClavePage({ params }: Props) {
  const { slug, codigo } = await params;
  const base = await basePortal(slug);

  const apr = await db.query.aprs.findFirst({
    where: eq(aprs.slug, slug),
    columns: { id: true, nombre: true },
  });
  if (!apr) notFound();

  const dato = leerRestablecerClave(codigo);
  const cuenta = dato ? await cuentaDeSocio(dato.socioId, apr.id) : null;
  const vigente = Boolean(dato && cuenta && huellaDeClave(cuenta.claveHash) === dato.huella);

  if (!cuenta || !vigente) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6 py-16">
        <h1 className="text-[1.4rem] font-semibold tracking-tight">
          Este enlace ya no sirve
        </h1>
        <p className="mt-2 text-[0.92rem] leading-relaxed text-muted-foreground">
          Venció o ya lo usaste. Si todavía necesitas cambiar tu clave, pídele a
          tu comité que te mande uno nuevo.
        </p>
        <Link
          href={`${base}/entrar`}
          className="mt-6 text-center text-[0.9rem] font-medium text-primary hover:underline"
        >
          Ir a entrar con mi RUT
        </Link>
      </div>
    );
  }

  const primerNombre = cuenta.socio.nombre.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6 py-16">
      <h1 className="text-[1.4rem] font-semibold tracking-tight">
        Hola, {primerNombre}
      </h1>
      <p className="mt-2 text-[0.92rem] leading-relaxed text-muted-foreground">
        {apr.nombre} te mandó este enlace para que elijas una clave nueva. Solo
        tú la verás.
      </p>

      <AceptarInvitacionForm slug={slug} codigo={codigo} base={base} modo="restablecer" />
    </div>
  );
}
