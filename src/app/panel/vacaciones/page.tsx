import { redirect } from "next/navigation";

/** El módulo se llama Ausencias: esta dirección antigua (enlaces y favoritos) lleva allá, conservando el filtro. */
export default async function VacacionesPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  redirect(tipo === "LICENCIA" ? "/panel/ausencias?tipo=LICENCIA" : "/panel/ausencias");
}
