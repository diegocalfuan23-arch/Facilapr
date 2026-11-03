"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

/** La primera, la última y la actual con una a cada lado; los huecos van como "…". */
function paginasVisibles(actual: number, total: number): (number | "…")[] {
  const claves = new Set([1, total, actual - 1, actual, actual + 1]);
  const orden = [...claves].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const visibles: (number | "…")[] = [];
  orden.forEach((n, i) => {
    if (i > 0 && n - orden[i - 1] > 1) visibles.push("…");
    visibles.push(n);
  });
  return visibles;
}

/**
 * Paginador de las tablas del panel. Va a la izquierda, junto al contador: a la
 * derecha quedan los botones flotantes de ayuda. En el celular no caben los
 * números, así que ahí muestra solo «3 de 11».
 */
export function Paginador({
  pagina,
  total,
  onCambiar,
}: {
  pagina: number;
  total: number;
  onCambiar: (pagina: number) => void;
}) {
  if (total <= 1) return null;

  return (
    <Pagination className="mx-0 w-auto justify-start">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious disabled={pagina === 1} onClick={() => onCambiar(pagina - 1)} />
        </PaginationItem>

        {paginasVisibles(pagina, total).map((p, i) =>
          p === "…" ? (
            <PaginationItem key={`hueco-${i}`} className="hidden sm:block">
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p} className="hidden sm:block">
              <PaginationLink
                isActive={p === pagina}
                aria-label={`Página ${p}`}
                onClick={() => onCambiar(p)}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem className="px-2 text-[0.87rem] text-muted-foreground tabular-nums sm:hidden">
          {pagina} de {total}
        </PaginationItem>

        <PaginationItem>
          <PaginationNext disabled={pagina === total} onClick={() => onCambiar(pagina + 1)} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
