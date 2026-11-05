import type { Metadata } from "next";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { invitaciones } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/auth-schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { cuentasDelPanel, listarTrabajadores } from "@/lib/personal";
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

  // Las personas de Personal, tengan o no cuenta. Quien ya tiene cuenta (por su correo) se ve una sola vez.
  const [fichas, cuentas] = await Promise.all([listarTrabajadores(apr.id), cuentasDelPanel(apr.id)]);
  const conCuenta = new Set(cuentas.map((c) => c.email));
  const cargoPorCorreo = new Map(fichas.filter((f) => f.email).map((f) => [f.email!.toLowerCase(), f.cargo]));
  const sinCuenta = fichas.filter((f) => f.activo && !(f.email && conCuenta.has(f.email.toLowerCase())));

  return (
    <TecnicosPanel
      tecnicos={[
        ...tecnicos.map((t) => ({
          id: t.id,
          nombre: t.name,
          correo: t.email as string | null,
          cargo: cargoPorCorreo.get(t.email.toLowerCase()) ?? null,
          desde: t.createdAt as Date | null,
          activo: t.rol === "OPERADOR" || t.rol === "TESORERO",
          rol: (t.rol.endsWith("TESORERO") ? "TESORERO" : "OPERADOR") as "OPERADOR" | "TESORERO" | null,
        })),
        ...sinCuenta.map((f) => ({
          id: `ficha:${f.id}`,
          nombre: f.nombre,
          correo: f.email,
          cargo: f.cargo,
          desde: null as Date | null,
          activo: true,
          rol: null as "OPERADOR" | "TESORERO" | null,
        })),
      ]}
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
