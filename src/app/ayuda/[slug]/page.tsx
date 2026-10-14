import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { existsSync } from "node:fs";
import path from "node:path";
import { ArrowLeft, ArrowRight, Clock, Lightbulb } from "lucide-react";
import { AyudaLayout } from "@/components/ayuda/ayuda-layout";
import { VideoYoutube } from "@/components/ayuda/video-youtube";
import { ARTICULOS, articuloPorSlug } from "@/lib/ayuda";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return ARTICULOS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = articuloPorSlug(slug);
  if (!a) return {};
  // Corto y con la palabra clave primero: Google corta los títulos largos.
  return { title: a.tituloSeo ?? a.titulo, description: a.resumen };
}

/** Captura del paso, si el archivo existe en public/ayuda/<slug>/<n>.png. */
function capturaDelPaso(slug: string, n: number) {
  const ruta = `/ayuda/${slug}/${n}.png`;
  return existsSync(path.join(process.cwd(), "public", ruta)) ? ruta : null;
}

export default async function ArticuloAyudaPage({ params }: Props) {
  const { slug } = await params;
  const articulo = articuloPorSlug(slug);
  if (!articulo) notFound();

  const indice = ARTICULOS.findIndex((a) => a.slug === slug);

  // Datos estructurados: Google puede mostrar los pasos directamente en los resultados.
  const datosEstructurados = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: articulo.titulo,
    description: articulo.resumen,
    totalTime: `PT${articulo.minutos}M`,
    step: articulo.pasos.map((p, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: p.titulo,
      text: p.texto,
    })),
  };
  const siguiente = ARTICULOS[indice + 1];

  // Con video, Google puede mostrarlo en los resultados de búsqueda.
  const video = articulo.video;
  const datosVideo = video && {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: articulo.titulo,
    description: articulo.resumen,
    thumbnailUrl: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    embedUrl: `https://www.youtube.com/embed/${video.id}`,
    contentUrl: `https://www.youtube.com/watch?v=${video.id}`,
    duration: `PT${Math.floor(video.segundos / 60)}M${video.segundos % 60}S`,
  };

  return (
    <AyudaLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados) }}
      />
      {datosVideo && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(datosVideo) }}
        />
      )}
      <main className="mx-auto max-w-[760px] px-7 py-12">
        <Link
          href="/ayuda"
          className="inline-flex items-center gap-1.5 text-[0.88rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Todas las guías
        </Link>

        <span className="mt-8 block font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
          {articulo.categoria}
        </span>
        <h1 className="mt-3 text-[clamp(1.7rem,3vw,2.2rem)] leading-tight font-semibold tracking-tight">
          {articulo.titulo}
        </h1>
        <p className="mt-3 text-[1rem] text-muted-foreground">
          {articulo.resumen}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.72rem] tracking-[0.06em] text-muted-foreground uppercase">
          <span>Para: {articulo.para}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {articulo.minutos} min
          </span>
        </div>

        {video && (
          <div className="mt-8">
            <VideoYoutube id={video.id} titulo={articulo.titulo} />
            <p className="mt-2 text-[0.82rem] text-muted-foreground">
              Video de {Math.max(1, Math.round(video.segundos / 60))} min. Abajo
              tienes los mismos pasos por escrito.
            </p>
          </div>
        )}

        <ol className="mt-12 flex flex-col gap-12">
          {articulo.pasos.map((paso, i) => {
            const n = i + 1;
            const captura = capturaDelPaso(articulo.slug, n);
            return (
              <li key={n} className="flex gap-5">
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[0.9rem] font-semibold text-primary-foreground"
                >
                  {n}
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <h2 className="text-[1.1rem] font-semibold">{paso.titulo}</h2>
                  <p className="mt-2 text-[0.97rem] leading-relaxed text-foreground/80">
                    {paso.texto}
                  </p>

                  {paso.nota && (
                    <div className="mt-4 flex gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-[0.88rem] leading-relaxed">
                      <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{paso.nota}</span>
                    </div>
                  )}

                  {captura && (
                    <figure className="mt-5 overflow-hidden rounded-2xl border border-border bg-muted/40 shadow-sm">
                      <Image
                        src={captura}
                        alt={`Paso ${n}: ${paso.titulo}`}
                        width={1400}
                        height={900}
                        sizes="(max-width: 760px) 100vw, 680px"
                        className="h-auto w-full"
                      />
                    </figure>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-16 rounded-2xl border border-border bg-muted/40 p-6">
          <h2 className="text-[1.05rem] font-semibold">¿Pudiste hacerlo?</h2>
          <p className="mt-1.5 text-[0.92rem] text-muted-foreground">
            Si algún paso no coincide con lo que ves en tu pantalla, cuéntanos y
            lo corregimos.
          </p>
          <Link
            href="/#contacto"
            className="mt-4 inline-block text-[0.9rem] font-medium text-primary hover:underline"
          >
            Escribirnos
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 p-6">
          <h2 className="text-[1.05rem] font-semibold">
            Facilapr: software para comités de agua potable rural
          </h2>
          <p className="mt-1.5 text-[0.92rem] text-muted-foreground">
            Lecturas, boletas, pagos, cortes y la cuenta en línea de cada socio, en un solo lugar y desde 0,7 UF al mes, sin permanencia.
          </p>
          <Link
            href="/registro"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-[0.9rem] font-medium text-primary-foreground hover:bg-primary/90"
          >
            Crear la cuenta de mi comité
          </Link>
        </div>

        {siguiente && (
          <Link
            href={`/ayuda/${siguiente.slug}`}
            className="group mt-6 flex items-center justify-between gap-4 rounded-2xl border border-border p-5 transition-colors hover:border-primary/40"
          >
            <div>
              <div className="font-mono text-[0.7rem] tracking-[0.06em] text-muted-foreground uppercase">
                Siguiente guía
              </div>
              <div className="mt-1 font-semibold">{siguiente.titulo}</div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        )}
      </main>
    </AyudaLayout>
  );
}
