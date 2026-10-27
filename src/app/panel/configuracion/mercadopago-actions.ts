"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/apr-session";
import { desconectarCuenta } from "@/lib/mercadopago";

/** Quita la cuenta de Mercado Pago del comité: deja de poder cobrar en línea hasta que la conecte otra vez. */
export async function desconectarMercadoPago() {
  const { apr } = await requireAdmin();
  await desconectarCuenta(apr.id);
  revalidatePath("/panel/pagos");
}
