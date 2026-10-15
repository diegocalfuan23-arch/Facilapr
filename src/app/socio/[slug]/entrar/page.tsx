import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { aprs, socios } from "@/lib/db/schema";
import { EntrarSocioForm } from "@/components/socio/entrar-form";
import { basePortal } from "@/lib/portal-socio";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Mi cuenta — ${slug}` };
}

export default async function EntrarSocioPage({ params }: Props) {
  const { slug } = await params;
  const base = await basePortal(slug);

  const apr = await db.query.aprs.findFirst({
    where: eq(aprs.slug, slug),
    columns: { nombre: true },
  });
  if (!apr) notFound();

  // La PWA abre siempre en /socio/entrar: con sesión activa el socio debe caer
  // directo en su cuenta, no volver a escribir RUT y clave.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user.rol === "SOCIO") {
    const socio = await db.query.socios.findFirst({
      where: eq(socios.userId, session.user.id),
      with: { apr: { columns: { slug: true } } },
    });
    if (socio?.apr.slug === slug) redirect(base);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6 py-16">
      <h1 className="text-[1.4rem] font-semibold tracking-tight">
        Mi cuenta — {apr.nombre}
      </h1>
      <p className="mt-2 text-[0.92rem] text-muted-foreground">
        Ingresa con tu RUT y tu clave.
      </p>

      <EntrarSocioForm slug={slug} base={base} />

      <p className="mt-6 text-center text-[0.85rem] text-muted-foreground">
        ¿Olvidaste tu clave o no puedes entrar?{" "}
        <Link
          href={`${base}/no-puedo-entrar`}
          className="font-medium text-primary hover:underline"
        >
          Avisa a tu comité
        </Link>
      </p>

      <p className="mt-3 text-center text-[0.85rem] text-muted-foreground">
        ¿Todavía no tienes cuenta?{" "}
        <Link
          href={`${base}/solicitar`}
          className="font-medium text-primary hover:underline"
        >
          Solicítala aquí
        </Link>
      </p>
    </div>
  );
}
