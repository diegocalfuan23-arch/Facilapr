import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs } from "@/lib/db/schema";
import { SolicitarAccesoForm } from "@/components/socio/solicitar-acceso-form";
import { basePortal } from "@/lib/portal-socio";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { robots: { index: false, follow: false }, title: `Crear acceso — ${slug}` };
}

export default async function SolicitarAccesoPage({ params }: Props) {
  const { slug } = await params;
  const base = await basePortal(slug);

  const apr = await db.query.aprs.findFirst({
    where: eq(aprs.slug, slug),
    columns: { nombre: true },
  });
  if (!apr) notFound();

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6 py-16">
      <h1 className="text-[1.4rem] font-semibold tracking-tight">
        Crear acceso a tu cuenta
      </h1>
      <p className="mt-2 text-[0.92rem] text-muted-foreground">
        {apr.nombre} revisará tu solicitud antes de activarla. Solo necesitas
        tu RUT tal como está registrado en el comité.
      </p>

      <SolicitarAccesoForm slug={slug} />

      <p className="mt-6 text-center text-[0.85rem] text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href={`${base}/entrar`} className="font-medium text-primary hover:underline">
          Entra aquí
        </Link>
      </p>
    </div>
  );
}
