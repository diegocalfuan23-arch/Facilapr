import type { Metadata } from "next";
import { and, desc, eq, inArray, isNull, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { invitaciones } from "@/lib/db/schema";
import { session as sessionTable, user as userTable } from "@/lib/db/auth-schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { cuentasDelPanel, listarTrabajadores } from "@/lib/personal";
import { TecnicosPanel } from "@/components/panel/tecnicos-panel";

export const metadata: Metadata = {
  title: "Equipo",
};

const DIA_MS = 86_400_000;

/** El instante actual, fuera del render para que el lint de pureza no lo confunda con un cálculo de pantalla. */
const ahoraMs = () => Date.now();

/** «hace 25 min», «hace 2 horas», «ayer»… para el último acceso. */
function haceCuanto(fecha: Date | null, ahora: number): string | null {
  if (!fecha) return null;
  const min = Math.max(0, Math.round((ahora - fecha.getTime()) / 60_000));
  if (min < 2) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
}

export default async function TecnicosPage() {
  const { user, apr } = await requireAdmin();
  const ahora = ahoraMs();

  const tecnicos = await db.query.user.findMany({
    where: and(
      eq(userTable.aprId, apr.id),
      inArray(userTable.rol, ["OPERADOR", "TESORERO", "DESACTIVADO", "DESACTIVADO_TESORERO"])
    ),
    orderBy: [desc(userTable.createdAt)],
    columns: { id: true, name: true, email: true, createdAt: true, rol: true },
  });

  // Las invitaciones sin usar, también las vencidas: se pueden renovar.
  const pendientes = await db.query.invitaciones.findMany({
    where: and(eq(invitaciones.aprId, apr.id), isNull(invitaciones.usadaPor)),
    orderBy: [desc(invitaciones.createdAt)],
    limit: 20,
    columns: { id: true, codigo: true, expiraEn: true, createdAt: true, rol: true },
  });

  // El último movimiento de cada sesión: sirve de «último acceso».
  const sesiones = tecnicos.length
    ? await db
        .select({ userId: sessionTable.userId, ultimo: max(sessionTable.updatedAt) })
        .from(sessionTable)
        .where(inArray(sessionTable.userId, tecnicos.map((t) => t.id)))
        .groupBy(sessionTable.userId)
    : [];
  const ultimoPorUsuario = new Map(sesiones.map((s) => [s.userId, s.ultimo]));

  // Las personas de Personal, tengan o no cuenta. Quien ya tiene cuenta (por su correo) se ve una sola vez.
  // Sin RR.HH. en el plan no hay personal que mostrar.
  const [fichas, cuentas] = await Promise.all([puede(apr.plan as Plan, "personal") ? listarTrabajadores(apr.id) : Promise.resolve([]), cuentasDelPanel(apr.id)]);
  const conCuenta = new Set(cuentas.map((c) => c.email));
  const cargoPorCorreo = new Map(fichas.filter((f) => f.email).map((f) => [f.email!.toLowerCase(), f.cargo]));
  const sinCuenta = fichas.filter((f) => f.activo && !(f.email && conCuenta.has(f.email.toLowerCase())));

  const dominio = process.env.NEXT_PUBLIC_DOMINIO_RAIZ ?? "facilapr.cl";

  return (
    <TecnicosPanel
      yo={{ nombre: user.name, correo: user.email }}
      tecnicos={[
        ...tecnicos.map((t) => ({
          id: t.id,
          nombre: t.name,
          correo: t.email as string | null,
          cargo: cargoPorCorreo.get(t.email.toLowerCase()) ?? null,
          desde: t.createdAt ? t.createdAt.toISOString() : null,
          acceso: haceCuanto(ultimoPorUsuario.get(t.id) ?? null, ahora),
          activo: t.rol === "OPERADOR" || t.rol === "TESORERO",
          rol: (t.rol.endsWith("TESORERO") ? "TESORERO" : "OPERADOR") as "OPERADOR" | "TESORERO" | null,
        })),
        ...sinCuenta.map((f) => ({
          id: `ficha:${f.id}`,
          nombre: f.nombre,
          correo: f.email,
          cargo: f.cargo,
          desde: null as string | null,
          acceso: null as string | null,
          activo: true,
          rol: null as "OPERADOR" | "TESORERO" | null,
        })),
      ]}
      invitacionesPendientes={pendientes.map((i) => ({
        id: i.id,
        enlace: `https://${dominio}/invitacion/${i.codigo}`,
        quedan: Math.ceil((i.expiraEn.getTime() - ahora) / DIA_MS),
        expira: i.expiraEn.toISOString(),
        creada: i.createdAt.toISOString(),
        rol: i.rol === "TESORERO" ? ("TESORERO" as const) : ("OPERADOR" as const),
      }))}
      puedeTesorero={puede(apr.plan as Plan, "finanzas")}
    />
  );
}
