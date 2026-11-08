import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/auth-schema";
import { aprs } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/auth-schema";
import { enviarCorreoResetPassword } from "@/lib/correo/reset-password";
import { slugUnico } from "@/lib/slug";
import { finDePrueba } from "@/lib/prueba";

/**
 * Orígenes aceptados. Sin esto, Better Auth solo confía en BETTER_AUTH_URL y
 * rechaza con "invalid origin" cualquier petición que llegue desde otra
 * variante del dominio: el sitio se sirve en www pero la variable apuntaba al
 * raíz, y el registro fallaba por esa diferencia.
 *
 * Todo sale del entorno para que cambiar de dominio no obligue a tocar código.
 */
function origenesConfiables(): string[] {
  const origenes: string[] = [];

  // El dominio propio. Si falta la variable, se deduce de BETTER_AUTH_URL, que
  // Better Auth necesita igual: así no hay ningún dominio escrito en el código.
  const dominio =
    process.env.NEXT_PUBLIC_DOMINIO_RAIZ ??
    (() => {
      const url = process.env.BETTER_AUTH_URL;
      if (!url) return null;
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    })();

  if (dominio) {
    origenes.push(
      `https://${dominio}`,
      `https://www.${dominio}`,
      // Los sitios de los comités viven en subdominios: pitrelahue.<dominio>.
      `https://*.${dominio}`
    );
  }

  // El dominio de producción que Vercel asigna al proyecto.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origenes.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  // La URL de este deploy: en previews cambia con cada push, y sin ella el
  // registro falla ahí aunque funcione en producción. Acotado a este deploy,
  // no a *.vercel.app, que aceptaría proyectos de terceros.
  if (process.env.VERCEL_URL) {
    origenes.push(`https://${process.env.VERCEL_URL}`);
  }

  return origenes;
}

export const auth = betterAuth({
  trustedOrigins: origenesConfiables(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    camelCase: true,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await enviarCorreoResetPassword({
        destinatario: user.email,
        nombre: user.name,
        url,
      });
    },
    // Si alguien pide un reset, es razonable cerrar cualquier sesión activa
    // que no sea la suya — evita que una sesión robada sobreviva al cambio.
    revokeSessionsOnPasswordReset: true,
  },
  user: {
    additionalFields: {
      apr: {
        type: "string",
        required: true,
      },
      rutComite: {
        type: "string",
        required: true,
      },
      comuna: {
        type: "string",
        required: true,
      },
      cargo: {
        type: "string",
        required: true,
      },
      aprId: {
        type: "string",
        required: false,
        // Lo asigna el servidor tras crear el APR, nunca el cliente.
        input: false,
      },
      rol: {
        type: "string",
        required: false,
        // Todo registro nace ADMIN; solo unirseConInvitacion() lo baja a
        // OPERADOR, nunca el propio usuario al registrarse.
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Al registrarse un dirigente creamos el comité y lo vinculamos,
        // de modo que sus socios y boletas queden aislados de otros APR.
        after: async (nuevoUsuario) => {
          const datos = nuevoUsuario as typeof nuevoUsuario & {
            apr: string;
            rutComite: string;
            comuna: string;
          };

          const existente = await db.query.aprs.findFirst({
            where: eq(aprs.rut, datos.rutComite),
          });

          const aprId =
            existente?.id ??
            (
              await db
                .insert(aprs)
                .values({
                  nombre: datos.apr,
                  // La dirección del comité (portal de socios) sale del nombre;
                  // no depende del plan ni de publicar el sitio.
                  slug: await slugUnico(datos.apr),
                  rut: datos.rutComite,
                  comuna: datos.comuna,
                  // Todo comité nuevo parte con una prueba gratuita: las funciones del plan Grande por 10 días.
                  plan: "PREMIUM",
                  pruebaHasta: finDePrueba(),
                  // El registro pide el "Correo del comité": además de ser el
                  // de ingreso, es el de contacto del comité (aparece en
                  // Configuración y en las boletas).
                  email: nuevoUsuario.email,
                })
                .returning()
            )[0].id;

          await db
            .update(userTable)
            .set({ aprId })
            .where(eq(userTable.id, nuevoUsuario.id));
        },
      },
    },
  },
});
