import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { solicitudesClave, socios } from "@/lib/db/schema";
import { normalizarRut } from "@/lib/formato";
import { cuentaDeSocio } from "@/lib/socios-acceso";

/**
 * Un socio que no puede entrar avisa a su comité. Es pública: quien la usa no
 * ha iniciado sesión, así que solo escribe un RUT, y la respuesta es la misma
 * exista o no (nunca se confirma quién es socio). La directiva recibe la
 * solicitud y es ella quien manda el enlace al teléfono que tiene registrado
 * del socio: eso es lo que confirma que es la persona.
 *
 * Solo se anota si el RUT es de un socio que ya tiene cuenta; el que todavía no
 * la tiene debe pedir acceso. Un socio no puede tener dos solicitudes pendientes.
 */
export async function pedirRestablecerClave({ aprId, rut }: { aprId: string; rut: string }): Promise<void> {
  const delRut = await db.query.socios.findMany({
    where: and(eq(socios.aprId, aprId), eq(socios.rut, normalizarRut(rut))),
    columns: { id: true, userId: true },
  });

  // Una persona con varios arranques comparte una sola cuenta.
  const conCuenta = delRut.find((s) => s.userId);
  if (!conCuenta) return;
  if (!(await cuentaDeSocio(conCuenta.id, aprId))) return;

  try {
    await db.insert(solicitudesClave).values({ aprId, socioId: conCuenta.id });
  } catch (e) {
    // El índice único: ya hay una pendiente de este socio. No es un error para quien la pide.
    const texto = `${e instanceof Error ? e.message : ""} ${(e as { cause?: Error }).cause?.message ?? ""}`;
    if (!/SolicitudClave_socio_pendiente_key|duplicate key/.test(texto)) throw e;
  }
}
