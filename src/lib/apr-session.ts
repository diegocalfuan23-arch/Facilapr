import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { aprs } from "@/lib/db/schema";
import { session as sessionTable, user as userTable } from "@/lib/db/auth-schema";
import { basePortal } from "@/lib/portal-socio";

export type RolPanel = "ADMIN" | "OPERADOR";

/**
 * Devuelve la sesión y el APR al que pertenece el usuario. Redirige a /login
 * si no hay sesión, de modo que toda página del panel quede protegida. Un
 * socio (rol SOCIO) no entra al panel: se le lleva a su portal.
 *
 * Cada consulta del panel debe filtrar por el `aprId` que devuelve esta
 * función: es lo que impide que un comité vea los datos de otro.
 */
export async function requireApr() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const { user } = session;

  // Un técnico desactivado por la directiva: se cierran sus sesiones y vuelve al
  // inicio de sesión. Se revisa aquí porque toda página del panel pasa por aquí.
  if (user.rol === "DESACTIVADO") {
    await db.delete(sessionTable).where(eq(sessionTable.userId, user.id));
    redirect("/login?cuenta=desactivada");
  }

  if (user.aprId) {
    const apr = await db.query.aprs.findFirst({
      where: eq(aprs.id, user.aprId),
    });

    if (apr) {
      // Un socio inició sesión en el portal con este mismo navegador: el panel
      // de la directiva no es suyo. Sin esta barrera podía abrir pantallas que
      // solo piden "pertenecer al comité" (lecturas, modo terreno).
      if (user.rol === "SOCIO") {
        redirect(apr.slug ? await basePortal(apr.slug) : "/login");
      }
      return { user, apr };
    }
  }

  // Usuarios creados antes de que existiera la tabla Apr: los vinculamos
  // ahora usando los datos que declararon al registrarse.
  const existente = await db.query.aprs.findFirst({
    where: eq(aprs.rut, user.rutComite),
  });

  const apr =
    existente ??
    (
      await db
        .insert(aprs)
        .values({
          nombre: user.apr,
          rut: user.rutComite,
          comuna: user.comuna,
        })
        .returning()
    )[0];

  await db
    .update(userTable)
    .set({ aprId: apr.id })
    .where(eq(userTable.id, user.id));

  return { user, apr };
}

/**
 * Igual que requireApr(), pero además exige rol ADMIN. Úsala en cualquier
 * página que un OPERADOR no deba ver: socios, boletas, configuración, sitio
 * público y la aprobación de lecturas. Un operador que intente entrar por
 * URL directa queda igual bloqueado, no solo oculto en el menú.
 */
export async function requireAdmin() {
  const { user, apr } = await requireApr();

  if (user.rol !== "ADMIN") {
    redirect("/panel/lecturas");
  }

  return { user, apr };
}
