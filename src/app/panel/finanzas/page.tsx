import { redirect } from "next/navigation";

/** Finanzas y Caja eran lo mismo: ahora todo vive en Caja. Se deja esta dirección para no romper enlaces. */
export default function FinanzasPage() {
  redirect("/panel/caja?vista=mes");
}
