import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updatedAt")
    .$defaultFn(() => new Date())
    .notNull(),
  // Datos que el usuario declara al registrarse. Better Auth los escribe
  // directamente, y a partir de ellos se crea el APR asociado.
  apr: text("apr").notNull(),
  rutComite: text("rutComite").notNull(),
  comuna: text("comuna").notNull(),
  cargo: text("cargo").notNull(),
  // WhatsApp o teléfono de contacto que dejó al registrarse (las cuentas anteriores no lo traen).
  telefono: text("telefono"),
  // De dónde llegó al sitio la primera vez: buscador o página que lo trajo, y la primera página que abrió.
  origen: text("origen"),
  // Comité al que pertenece el usuario. Determina qué datos puede ver.
  aprId: text("aprId"),
  /**
   * ADMIN: quien registra el comité, ve todo el panel.
   * OPERADOR: operador de terreno, solo carga lecturas para que el admin
   * las apruebe. Se une siempre a través de una invitación (ver Invitacion).
   * SOCIO: un socio del comité, solo ve su propio panel (Socio en
   * schema.ts). Se une a través de una SolicitudAcceso aprobada por la
   * directiva, nunca se autoasigna este rol al registrarse.
   */
  rol: text("rol").notNull().default("ADMIN"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").$defaultFn(() => new Date()),
  updatedAt: timestamp("updatedAt").$defaultFn(() => new Date()),
});
