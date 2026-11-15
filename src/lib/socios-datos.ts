import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socios } from "@/lib/db/schema";
import { cortadosActuales, ordenesDelComite } from "@/lib/ordenes-datos";
import { urlInvitacionSocio } from "@/lib/invitacion-socio";
import type { SocioFila } from "@/components/panel/socios-tabla";

/** Las cuentas del comité tal como las muestra la pantalla de Socios. La usan la página y la consulta que la mantiene al día. */
export async function datosSocios(apr: { id: string; slug: string | null }): Promise<SocioFila[]> {
  const listado = await db.query.socios.findMany({
    where: eq(socios.aprId, apr.id),
    orderBy: [asc(socios.nombre)],
    columns: {
      id: true,
      nombre: true,
      rut: true,
      tipo: true,
      uso: true,
      telefono: true,
      direccion: true,
      numeroCliente: true,
      activo: true,
      userId: true,
      whatsappConsentimiento: true,
    },
  });

  // Quien tiene varios arranques comparte una sola cuenta (por RUT): todos sus
  // arranques cuentan como "con cuenta", aunque solo uno guarde el userId.
  const rutsConCuenta = new Set(listado.filter((s) => s.userId && s.rut).map((s) => s.rut as string));

  // Quiénes están cortados ahora (último corte completado sin reposición posterior).
  const cortados = new Set(
    cortadosActuales(await ordenesDelComite(apr.id, ["COMPLETADA"]).catch(() => [])).map((o) => o.socioId)
  );

  return listado.map(({ userId, ...s }) => {
    const conCuenta = Boolean(userId) || (s.rut !== null && rutsConCuenta.has(s.rut));
    return {
      ...s,
      conCuenta,
      cortado: cortados.has(s.id),
      // Enlace personal de invitación: solo a quien aún no tiene cuenta, tiene
      // RUT (la cuenta se arma con él) y el comité ya definió su enlace.
      invitacionUrl: apr.slug && !conCuenta && s.rut && s.telefono ? urlInvitacionSocio(apr.slug, s.id) : null,
    };
  });
}
