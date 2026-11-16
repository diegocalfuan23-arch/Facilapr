import { redirect } from "next/navigation";

/** Las licencias se ven en Ausencias, junto con las vacaciones y los permisos: esta dirección antigua lleva allá, ya filtrada por licencias. */
export default function LicenciasPage() {
  redirect("/panel/ausencias?tipo=LICENCIA");
}
