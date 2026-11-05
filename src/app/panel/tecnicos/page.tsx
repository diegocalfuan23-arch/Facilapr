import type { Metadata } from "next";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { invitaciones } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/auth-schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { TecnicosPanel } from "@/components/panel/tecnicos-panel";

export const metadata: Metadata = {
  title: "Equipo",
};

export default async function TecnicosPage() {
  const { apr } = await requireAdmin();

  const tecnicos = await db.query.user.findMany({
    where: and(
      eq(userTable.aprId, apr.id),
      inArray(userTable.rol, ["OPERADOR", "TESORERO", "DESACTIVADO", "DESACTIVADO_TESORERO"])
    ),
    orderBy: [desc(userTable.createdAt)],
    columns: { id: true, name: true, email: true, createdAt: true, rol: true },
  });

  const pendientes = await db.query.invitaciones.findMany({
    where: and(
      eq(invitaciones.aprId, apr.id),
      isNull(invitaciones.usadaPor),
      gt(invitaciones.expiraEn, new Date())
    ),
    orderBy: [desc(invitaciones.createdAt)],
    columns: { id: true, codigo: true, expiraEn: true, createdAt: true, rol: true },
  });

  return (
    <TecnicosPanel
      tecnicos={tecnicos.map((t) => ({
        id: t.id,
        nombre: t.name,
        correo: t.email,
        desde: t.createdAt,
        activo: t.rol === "OPERADOR" || t.rol === "TESORERO",
        rol: t.rol.endsWith("TESORERO") ? ("TESORERO" as const) : ("OPERADOR" as const),
      }))}
      invitacionesPendientes={pendientes.map((i) => ({
        id: i.id,
        codigo: i.codigo,
        expiraEn: i.expiraEn,
        creadaEn: i.createdAt,
        rol: i.rol === "TESORERO" ? ("TESORERO" as const) : ("OPERADOR" as const),
      }))}
      puedeTesorero={puede(apr.plan as Plan, "finanzas")}
    />
  );
}
