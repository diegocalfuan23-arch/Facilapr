import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { avisos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { NOMBRE_PLAN, planMinimoPara, puede, type Plan } from "@/lib/planes";
import { imagenesDelSitio } from "@/lib/sitio-imagenes";
import { SitioAdministrar } from "@/components/panel/sitio-administrar";

export const metadata: Metadata = { title: "Administrar sitio" };

const DOMINIO_RAIZ = process.env.NEXT_PUBLIC_DOMINIO_RAIZ ?? "facilapr.cl";

export default async function AdministrarSitioPage() {
  const { apr } = await requireAdmin();
  const plan = apr.plan as Plan;

  if (!puede(plan, "landing")) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-[0.95rem] text-muted-foreground">
        El sitio público está disponible desde el plan <strong className="font-semibold text-foreground">{NOMBRE_PLAN[planMinimoPara("landing")]}</strong>.
      </div>
    );
  }

  const [listado, imagenes] = await Promise.all([
    db.query.avisos.findMany({
      where: eq(avisos.aprId, apr.id),
      orderBy: [desc(avisos.createdAt)],
      columns: { id: true, tipo: true, titulo: true, cuerpo: true, sectores: true, inicia: true, termina: true, publicado: true },
    }),
    imagenesDelSitio(apr.id),
  ]);

  const url = apr.slug && apr.sitioPublicado ? `https://${apr.slug}.${DOMINIO_RAIZ}` : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-tight">Administrar sitio</h1>
          <p className="mt-1 text-[0.9rem] text-muted-foreground">Cambia las fotos y los anuncios de tu sitio público. Los cambios se ven al tiro.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/panel/sitio" className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-[0.9rem] font-medium transition-colors hover:bg-muted">
            Dirección y textos
          </Link>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-[0.9rem] font-medium transition-colors hover:bg-muted">
              <ExternalLink className="size-4" />
              Ver sitio
            </a>
          )}
        </div>
      </div>

      <SitioAdministrar imagenes={imagenes} avisos={listado} />
    </>
  );
}
