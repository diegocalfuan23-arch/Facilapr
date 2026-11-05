import { urlImagenSitio } from "@/lib/sitio-imagenes-comun";
import type { SeccionSitio } from "@/lib/sitio-secciones-comun";
import { cn } from "@/lib/utils";

const eyebrow = "font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase";

function Titulo({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return <h2 className="mb-4 text-[clamp(1.5rem,2.5vw,1.9rem)] font-semibold text-balance">{texto}</h2>;
}

function Parrafo({ texto, className }: { texto: string | null; className?: string }) {
  if (!texto) return null;
  return <p className={cn("max-w-[62ch] text-[1rem] leading-relaxed whitespace-pre-line text-muted-foreground", className)}>{texto}</p>;
}

/** Un enlace de botón: los externos se abren en otra pestaña. */
function Boton({ texto, url }: { texto: string; url: string }) {
  const externo = /^https?:/i.test(url);
  return (
    <a
      href={url}
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-[0.95rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    >
      {texto}
    </a>
  );
}

/** Las secciones que el comité armó para su sitio, en el orden que les dio. Se alternan con fondo suave. */
export function SeccionesSitio({ secciones }: { secciones: SeccionSitio[] }) {
  return (
    <>
      {secciones.map((s, i) => {
        const fondo = i % 2 === 0 ? "py-16" : "border-y border-border bg-muted/40 py-16";

        if (s.tipo === "TEXTO") {
          return (
            <section key={s.id} className={fondo}>
              <div className="mx-auto max-w-[1180px] px-7">
                <Titulo texto={s.titulo} />
                <Parrafo texto={s.texto} />
              </div>
            </section>
          );
        }

        if (s.tipo === "IMAGEN") {
          return (
            <section key={s.id} className={fondo}>
              <div className={cn("mx-auto grid max-w-[1180px] items-center gap-10 px-7 lg:grid-cols-2", i % 4 >= 2 && "lg:[&>*:first-child]:order-2")}>
                {s.imagenId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urlImagenSitio(s.imagenId)} alt={s.titulo ?? ""} loading="lazy" className="aspect-[4/3] w-full rounded-2xl border border-border object-cover" />
                )}
                <div>
                  <Titulo texto={s.titulo} />
                  <Parrafo texto={s.texto} />
                </div>
              </div>
            </section>
          );
        }

        if (s.tipo === "BOTON") {
          return (
            <section key={s.id} className={fondo}>
              <div className="mx-auto flex max-w-[680px] flex-col items-center px-7 text-center">
                <Titulo texto={s.titulo} />
                <Parrafo texto={s.texto} className="mb-7" />
                {s.botonTexto && s.botonUrl && <Boton texto={s.botonTexto} url={s.botonUrl} />}
              </div>
            </section>
          );
        }

        return (
          <section key={s.id} className={fondo}>
            <div className="mx-auto max-w-[1180px] px-7">
              {s.titulo && <span className={eyebrow}>{s.titulo}</span>}
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {s.tarjetas.map((t, k) => (
                  <article key={k} className="rounded-2xl border border-border bg-card p-6">
                    <h3 className="text-[1.05rem] font-semibold">{t.titulo}</h3>
                    {t.texto && <p className="mt-2 text-[0.9rem] leading-relaxed whitespace-pre-line text-muted-foreground">{t.texto}</p>}
                  </article>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
