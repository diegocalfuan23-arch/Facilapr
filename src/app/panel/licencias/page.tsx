import { redirect } from "next/navigation";

/** Las licencias ahora se ven en Vacaciones, junto con los permisos: esta dirección antigua lleva allá, ya filtrada por licencias. */
export default function LicenciasPage() {
  redirect("/panel/vacaciones?tipo=LICENCIA");
}
