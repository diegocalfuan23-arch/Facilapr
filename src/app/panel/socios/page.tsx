import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { cortadosActuales, ordenesDelComite } from "@/lib/ordenes-datos";
import { SociosTabla } from "@/components/panel/socios-tabla";
import { urlInvitacionSocio } from "@/lib/invitacion-socio";

export const metadata: Metadata = {
  title: "Socios",
};

export default async function SociosPage() {
  const { apr } = await requireAdmin();

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
    },
  });

  // Quien tiene varios arranques comparte una sola cuenta (por RUT): todos sus
  // arranques cuentan como "con cuenta", aunque solo uno guarde el userId.
  const rutsConCuenta = new Set(
    listado.filter((s) => s.userId && s.rut).map((s) => s.rut as string)
  );

  // Quiénes están cortados ahora (último corte completado sin reposición posterior).
  const cortados = new Set(
    cortadosActuales(await ordenesDelComite(apr.id, ["COMPLETADA"]).catch(() => [])).map((o) => o.socioId)
  );

  const filas = listado.map(({ userId, ...s }) => {
    const conCuenta =
      Boolean(userId) || (s.rut !== null && rutsConCuenta.has(s.rut));
    return {
      ...s,
      conCuenta,
      cortado: cortados.has(s.id),
      // Enlace personal de invitación: solo a quien aún no tiene cuenta, tiene
      // RUT (la cuenta se arma con él) y el comité ya definió su enlace.
      invitacionUrl:
        apr.slug && !conCuenta && s.rut && s.telefono
          ? urlInvitacionSocio(apr.slug, s.id)
          : null,
    };
  });

  const dominio = process.env.NEXT_PUBLIC_DOMINIO_RAIZ ?? "facilapr.cl";

  return (
    <SociosTabla
      socios={filas}
      comite={{ nombre: apr.nombre, slug: apr.slug }}
      urlSolicitud={apr.slug ? `https://${dominio}/${apr.slug}/cuenta/solicitar` : null}
    />
  );
}
