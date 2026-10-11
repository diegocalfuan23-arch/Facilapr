import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, socios } from "@/lib/db/schema";
import { leerInvitacionSocio } from "@/lib/invitacion-socio";
import { basePortal } from "@/lib/portal-socio";
import { AceptarInvitacionForm } from "@/components/socio/aceptar-invitacion-form";

type Props = { params: Promise<{ slug: string; codigo: string }> };

export const metadata: Metadata = {
  title: "Crea tu clave",
  robots: { index: false, follow: false },
};

/** Lo que ve el socio cuando el enlace no sirve: dice por qué y qué hacer. */
function EnlaceNoValido({
  base,
  texto,
}: {
  base: string;
  texto: string;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6 py-16">
      <h1 className="text-[1.4rem] font-semibold tracking-tight">
        Este enlace ya no sirve
      </h1>
      <p className="mt-2 text-[0.92rem] leading-relaxed text-muted-foreground">
        {texto}
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

export default async function InvitacionSocioPage({ params }: Props) {
  const { slug, codigo } = await params;
  const base = await basePortal(slug);

  const apr = await db.query.aprs.findFirst({
    where: eq(aprs.slug, slug),
    columns: { id: true, nombre: true },
  });
  if (!apr) notFound();

  const socioId = leerInvitacionSocio(codigo);
  const socio = socioId
    ? await db.query.socios.findFirst({
        where: and(eq(socios.id, socioId), eq(socios.aprId, apr.id)),
        columns: { nombre: true, rut: true, aprId: true, userId: true },
      })
    : null;

  if (!socio) {
    return (
      <EnlaceNoValido
        base={base}
        texto="Venció o no es válido. Pídele a tu comité que te mande uno nuevo."
      />
    );
  }

  // Una persona con varios arranques comparte una sola cuenta (por su RUT).
  const conCuenta =
    socio.userId ||
    (socio.rut &&
      (await db.query.socios.findFirst({
        where: and(
          eq(socios.aprId, socio.aprId),
          eq(socios.rut, socio.rut),
          isNotNull(socios.userId)
        ),
        columns: { id: true },
      })));
  if (conCuenta) {
    return (
      <EnlaceNoValido
        base={base}
        texto="Tu cuenta ya está creada. Entra con tu RUT y tu clave; si la olvidaste, pídele a tu comité que te la restablezca."
      />
    );
  }

  const primerNombre = socio.nombre.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6 py-16">
      <h1 className="text-[1.4rem] font-semibold tracking-tight">
        Hola, {primerNombre}
      </h1>
      <p className="mt-2 text-[0.92rem] leading-relaxed text-muted-foreground">
        {apr.nombre} te invitó a ver tu cuenta, tus boletas y tus recibos en
        línea. Elige una clave para entrar.
      </p>

      <AceptarInvitacionForm slug={slug} codigo={codigo} base={base} />

      <p className="mt-6 text-center text-[0.82rem] text-muted-foreground">
        Para entrar después usarás tu RUT y esta clave.
      </p>
    </div>
  );
}
