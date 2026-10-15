import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs } from "@/lib/db/schema";
import { NoPuedoEntrarForm } from "@/components/socio/no-puedo-entrar-form";
import { basePortal } from "@/lib/portal-socio";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `No puedo entrar — ${slug}` };
}

export default async function NoPuedoEntrarPage({ params }: Props) {
  const { slug } = await params;
  const base = await basePortal(slug);

  const apr = await db.query.aprs.findFirst({
    where: eq(aprs.slug, slug),
    columns: { nombre: true },
  });
  if (!apr) notFound();

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6 py-16">
      <h1 className="text-[1.4rem] font-semibold tracking-tight">¿No puedes entrar?</h1>
      <p className="mt-2 text-[0.92rem] text-muted-foreground">
        Escribe tu RUT y avisamos a {apr.nombre}. Ellos te mandarán por WhatsApp un enlace para elegir una clave nueva.
      </p>

      <NoPuedoEntrarForm slug={slug} />

      <p className="mt-6 text-center text-[0.85rem] text-muted-foreground">
        ¿Recordaste tu clave?{" "}
        <Link href={`${base}/entrar`} className="font-medium text-primary hover:underline">
          Entra aquí
        </Link>
      </p>
      <p className="mt-3 text-center text-[0.85rem] text-muted-foreground">
        ¿Todavía no tienes cuenta?{" "}
        <Link href={`${base}/solicitar`} className="font-medium text-primary hover:underline">
          Solicítala aquí
        </Link>
      </p>
    </div>
  );
}
