import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, ilike, isNotNull, or } from "drizzle-orm";
import { ArrowRight, Search } from "lucide-react";
import { db } from "@/lib/db";
import { aprs } from "@/lib/db/schema";
import { Logo } from "@/components/marca/logo";

export const metadata: Metadata = {
  title: "Paga tu cuenta del agua potable rural: encuentra tu comité (APR)",
  description:
    "Si eres socio de un comité de agua potable rural (APR o SSR), busca tu comité y entra a tu cuenta para ver tus boletas y pagarlas en línea.",
  alternates: { canonical: "/socios" },
  openGraph: {
    type: "website",
    siteName: "Facilapr",
    locale: "es_CL",
    url: "/socios",
    title: "Paga tu cuenta del agua potable rural: encuentra tu comité",
    description: "Busca tu comité de agua potable rural y entra a tu cuenta para ver y pagar tus boletas.",
  },
};

// La lista cambia cuando un comité se suma al buscador: no se guarda en caché.
export const dynamic = "force-dynamic";

const MAXIMO = 40;

/** Quita los comodines de ILIKE para que la búsqueda sea literal. */
const literal = (t: string) => t.replace(/[\\%_]/g, "");

export default async function SociosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const busqueda = literal((q ?? "").trim()).slice(0, 60);

  // Solo los comités que decidieron aparecer y tienen portal. Nada de socios, teléfonos ni montos.
  const comites = await db
    .select({ nombre: aprs.nombre, comuna: aprs.comuna, region: aprs.region, slug: aprs.slug })
    .from(aprs)
    .where(
      and(
        eq(aprs.apareceEnBuscador, true),
        eq(aprs.activo, true),
        isNotNull(aprs.slug),
        busqueda
          ? or(ilike(aprs.nombre, `%${busqueda}%`), ilike(aprs.comuna, `%${busqueda}%`))
          : undefined
      )
    )
    .orderBy(asc(aprs.nombre))
    .limit(MAXIMO);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-7 py-5">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Logo className="size-6" />
            Facilapr
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-7 py-12">
        <span className="font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
          Para socios
        </span>
        <h1 className="mt-3 text-[clamp(1.7rem,3vw,2.2rem)] leading-tight font-semibold tracking-tight">
          Encuentra tu comité y paga tu boleta
        </h1>
        <p className="mt-3 text-[1rem] text-muted-foreground">
          Busca el nombre de tu comité de agua potable rural o tu comuna. Entras con tu RUT y tu clave, ves tus boletas
          y las pagas en línea si tu comité lo tiene activado.
        </p>

        <form action="/socios" className="mt-7 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={busqueda}
              placeholder="Nombre del comité o comuna"
              className="h-11 w-full rounded-lg border border-border bg-card pr-3 pl-10 text-[0.95rem] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Nombre del comité o comuna"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-primary px-5 text-[0.92rem] font-medium text-primary-foreground hover:bg-primary/90"
          >
            Buscar
          </button>
        </form>

        <ul className="mt-8 flex flex-col gap-3">
          {comites.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/${c.slug}/cuenta/entrar`}
                className="group flex items-center justify-between gap-4 rounded-xl border border-border p-5 transition-colors hover:border-primary/40"
              >
                <div>
                  <div className="font-semibold">{c.nombre.trim()}</div>
                  <div className="text-[0.85rem] text-muted-foreground">
                    {c.comuna}
                    {c.region ? ` · ${c.region}` : ""}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[0.88rem] font-medium text-primary">
                  Entrar a mi cuenta
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {comites.length === 0 && (
          <p className="mt-8 rounded-xl border border-dashed border-border px-5 py-8 text-center text-[0.92rem] text-muted-foreground">
            {busqueda
              ? "No encontramos un comité con ese nombre. Revisa cómo está escrito o pídele a tu comité el enlace a tu cuenta."
              : "Todavía no hay comités en el buscador. Pídele a tu comité el enlace a tu cuenta."}
          </p>
        )}

        <p className="mt-10 text-[0.85rem] text-muted-foreground">
          ¿Tu comité no aparece? No todos están en el buscador: pídele a la directiva el enlace directo a tu cuenta.{" "}
          <Link href="/ayuda/como-pagar-cuenta-agua-potable-rural-apr" className="font-medium text-primary hover:underline">
            Cómo pagar tu cuenta del APR
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
