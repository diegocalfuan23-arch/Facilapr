import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export const estadoBoletaEnum = pgEnum("EstadoBoleta", [
  "PENDIENTE",
  "PAGADA",
  "VENCIDA",
  "ANULADA",
]);

/**
 * Plan contratado. Define qué puede hacer el comité:
 * BASICO   → panel
 * ESTANDAR → + landing pública en subdominio
 * PREMIUM  → + dominio propio
 */
export const planEnum = pgEnum("Plan", ["BASICO", "ESTANDAR", "PREMIUM"]);

export const frecuenciaLecturaEnum = pgEnum("FrecuenciaLectura", [
  "MENSUAL",
  "BIMENSUAL",
  "TRIMESTRAL",
]);

export const tipoAvisoEnum = pgEnum("TipoAviso", [
  "CORTE",
  "MANTENCION",
  "NOTICIA",
]);

export const estadoLecturaEnum = pgEnum("EstadoLectura", [
  "PENDIENTE",
  "APROBADA",
  "RECHAZADA",
]);

/**
 * Un APR/SSR: el comité dueño de los datos. Todo lo demás cuelga de aquí,
 * de modo que un comité nunca vea los socios ni boletas de otro.
 */
export const aprs = pgTable(
  "Apr",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    nombre: text("nombre").notNull(),
    rut: text("rut").notNull(),
    comuna: text("comuna").notNull(),
    region: text("region"),
    direccion: text("direccion"),
    telefono: text("telefono"),
    email: text("email"),
    activo: boolean("activo").notNull().default(true),

    plan: planEnum("plan").notNull().default("BASICO"),

    // --- Landing pública (planes ESTANDAR y PREMIUM) ---
    /** Subdominio: pitrelahue → pitrelahue.facilapr.cl */
    slug: text("slug"),
    /** Dominio propio, solo PREMIUM. Null hasta que se verifique. */
    dominioPropio: text("dominioPropio"),
    /** El comité decide cuándo publicarla; se genera antes de estar visible. */
    sitioPublicado: boolean("sitioPublicado").notNull().default(false),
    /** Texto libre de presentación. Si va vacío usamos uno por defecto. */
    sitioDescripcion: text("sitioDescripcion"),
    horarioAtencion: text("horarioAtencion"),
    /** Tarifas en CLP. Enteros: en Chile no se usan decimales. */
    tarifaCargoFijo: integer("tarifaCargoFijo"),
    tarifaMetroCubico: integer("tarifaMetroCubico"),
    /** Dónde y cómo pagar, en texto libre: varía mucho entre comités. */
    infoPago: text("infoPago"),
    /** IA dentro del chat (plan Grande): APAGADO · SIEMPRE (· SIN_RESPUESTA, próximamente). */
    iaChatModo: text("iaChatModo").notNull().default("APAGADO"),
    /** Tono y reglas propias del comité para la IA del chat. */
    iaChatInstrucciones: text("iaChatInstrucciones"),
    /** Minutos de espera antes de que responda la IA, en el modo SIN_RESPUESTA. */
    iaChatEsperaMin: integer("iaChatEsperaMin").notNull().default(10),

    // --- Datos del comité ---
    /** El nombre legal, que no siempre coincide con el de uso diario. */
    razonSocial: text("razonSocial"),
    sitioWeb: text("sitioWeb"),
    logoUrl: text("logoUrl"),

    // --- Regional ---
    /**
     * País, moneda y zona horaria del comité. Hoy los formatos de monto y
     * fecha siguen usando es-CL/CLP en ~27 lugares del código; estos campos
     * guardan la intención para cuando el producto salga de Chile, sin
     * bloquear eso en una migración futura.
     */
    pais: text("pais").notNull().default("CL"),
    moneda: text("moneda").notNull().default("CLP"),
    zonaHoraria: text("zonaHoraria").notNull().default("America/Santiago"),
    idioma: text("idioma").notNull().default("es"),

    // --- Facturación ---
    /** Día del mes en que el comité emite las boletas. */
    diaGeneracionBoletas: integer("diaGeneracionBoletas").notNull().default(1),
    /** Cuántos días desde la emisión hasta el vencimiento. */
    diasVencimiento: integer("diasVencimiento").notNull().default(15),
    /** Prefijo del número de boleta: BOL-000123. */
    prefijoBoleta: text("prefijoBoleta").notNull().default("BOL-"),
    /** Los APR suelen estar exentos, pero algunos facturan con IVA. */
    incluyeIva: boolean("incluyeIva").notNull().default(false),
    porcentajeIva: integer("porcentajeIva").notNull().default(19),

    // --- Medidores ---
    frecuenciaLectura: frecuenciaLecturaEnum("frecuenciaLectura")
      .notNull()
      .default("MENSUAL"),
    /**
     * Umbrales de consumo, en porcentaje sobre el promedio del socio.
     * El de fuga es el más útil: un salto grande casi siempre es una fuga,
     * y avisarlo a tiempo le ahorra plata al socio.
     */
    toleranciaConsumoAnormal: integer("toleranciaConsumoAnormal")
      .notNull()
      .default(50),
    alertaFugaConsumo: integer("alertaFugaConsumo").notNull().default(100),
    requiereFotoLectura: boolean("requiereFotoLectura")
      .notNull()
      .default(false),

    // --- Cortes por morosidad ---
    /** Días después del vencimiento antes de poder cortar. */
    diasGraciaCorte: integer("diasGraciaCorte").notNull().default(5),
    /** Con cuántos días de anticipación se avisa al socio. */
    diasAvisoCorte: integer("diasAvisoCorte").notNull().default(3),
    costoReconexion: integer("costoReconexion").notNull().default(0),

    // --- Cierre de cuenta (Ley 21.719) ---
    /**
     * Cuándo el comité pidió cerrar su cuenta. La política de privacidad
     * promete eliminar todo 90 días después de esa fecha; hasta entonces
     * puede arrepentirse y recuperar sus datos. Null = cuenta vigente.
     */
    cierreSolicitadoEn: timestamp("cierreSolicitadoEn", { precision: 3 }),

    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("Apr_rut_key").on(table.rut),
    // Parciales: varios comités pueden tener slug/dominio en null sin chocar.
    uniqueIndex("Apr_slug_key")
      .on(table.slug)
      .where(sql`${table.slug} IS NOT NULL`),
    uniqueIndex("Apr_dominioPropio_key")
      .on(table.dominioPropio)
      .where(sql`${table.dominioPropio} IS NOT NULL`),
  ]
);

export const aprsRelations = relations(aprs, ({ many }) => ({
  socios: many(socios),
  avisos: many(avisos),
}));

/**
 * Avisos de corte, mantención y noticias. Se publican en la landing y son
 * la misma fuente que responde el bot cuando preguntan por un corte.
 */
export const avisos = pgTable(
  "Aviso",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    tipo: tipoAvisoEnum("tipo").notNull().default("CORTE"),
    titulo: text("titulo").notNull(),
    cuerpo: text("cuerpo"),
    /** Sectores afectados, en texto libre. */
    sectores: text("sectores"),
    /** Null en noticias: solo los cortes tienen ventana horaria. */
    inicia: timestamp("inicia", { precision: 3 }),
    termina: timestamp("termina", { precision: 3 }),
    publicado: boolean("publicado").notNull().default(true),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("Aviso_aprId_idx").on(table.aprId),
    index("Aviso_aprId_publicado_idx").on(table.aprId, table.publicado),
  ]
);

export const avisosRelations = relations(avisos, ({ one }) => ({
  apr: one(aprs, {
    fields: [avisos.aprId],
    references: [aprs.id],
  }),
}));

export const socios = pgTable(
  "Socio",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    /**
     * Cada fila es una CUENTA COBRABLE: un arranque con su propio medidor y su
     * propia boleta. Una persona con dos arranques son dos filas con el mismo
     * RUT, y un usuario (no socio, pero que también paga) puede no tener RUT.
     */
    rut: text("rut"),
    /** SOCIO o USUARIO: el comité distingue a quien es socio de quien solo usa el agua. */
    tipo: text("tipo").$type<"SOCIO" | "USUARIO">().notNull().default("SOCIO"),
    /** E.164. Opcional, y se puede repetir: una persona con varios arranques
        usa el mismo número. */
    telefono: text("telefono"),
    direccion: text("direccion"),
    /** N.º de arranque dentro de su tipo (el socio 3 y el usuario 3 son distintos). */
    numeroCliente: text("numeroCliente"),
    activo: boolean("activo").notNull().default(true),
    /**
     * La cuenta de Better Auth del socio, si tiene panel propio. Sin FK
     * formal a propósito: `user` vive en auth-schema.ts, un módulo aparte
     * que este archivo no importa (mismo patrón que registradaPorId en
     * Lectura). Null hasta que se aprueba su SolicitudAcceso.
     */
    userId: text("userId"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    // RUT y teléfono ya no son únicos: varios arranques comparten dueño. Lo
    // único es el N.º de arranque dentro de su tipo y su comité.
    index("Socio_apr_rut_idx").on(table.aprId, table.rut),
    index("Socio_apr_telefono_idx").on(table.aprId, table.telefono),
    uniqueIndex("Socio_apr_tipo_numero_key")
      .on(table.aprId, table.tipo, table.numeroCliente)
      .where(sql`${table.numeroCliente} IS NOT NULL`),
    uniqueIndex("Socio_userId_key")
      .on(table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    index("Socio_aprId_idx").on(table.aprId),
  ]
);

export const sociosRelations = relations(socios, ({ many, one }) => ({
  apr: one(aprs, {
    fields: [socios.aprId],
    references: [aprs.id],
  }),
  boletas: many(boletas),
  lecturas: many(lecturas),
  mensajes: many(mensajesSocio),
}));

export const boletas = pgTable(
  "Boleta",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    socioId: text("socioId")
      .notNull()
      .references(() => socios.id),
    periodo: text("periodo").notNull(),
    montoTotal: integer("montoTotal").notNull(),
    montoPagado: integer("montoPagado").notNull().default(0),
    estado: estadoBoletaEnum("estado").notNull().default("PENDIENTE"),
    fechaEmision: timestamp("fechaEmision", { precision: 3 }).notNull(),
    fechaVencimiento: timestamp("fechaVencimiento", {
      precision: 3,
    }).notNull(),

    /**
     * Lecturas del medidor. Opcionales: un comité puede seguir calculando en
     * su planilla y cargar solo el monto. Si vienen las dos, guardamos también
     * el desglose para poder mostrarlo en la boleta y explicárselo al socio.
     */
    lecturaAnterior: integer("lecturaAnterior"),
    lecturaActual: integer("lecturaActual"),
    consumoM3: integer("consumoM3"),
    /** Tarifas con las que se calculó, congeladas: si suben, la boleta vieja
        no debe cambiar de monto. */
    cargoFijo: integer("cargoFijo"),
    valorM3: integer("valorM3"),

    observacion: text("observacion"),

    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("Boleta_socioId_idx").on(table.socioId),
    index("Boleta_socioId_estado_idx").on(table.socioId, table.estado),
    // Un socio no puede tener dos boletas del mismo período: es lo que evita
    // que reimportar un CSV duplique el mes completo.
    uniqueIndex("Boleta_socio_periodo_key").on(table.socioId, table.periodo),
    index("Boleta_periodo_idx").on(table.periodo),
  ]
);

export const boletasRelations = relations(boletas, ({ one }) => ({
  socio: one(socios, {
    fields: [boletas.socioId],
    references: [socios.id],
  }),
}));

/**
 * Link de invitación para que un técnico se registre como OPERADOR de un
 * comité, sin tener que adivinar el RUT del APR (que es como hoy se une
 * un ADMIN nuevo). El admin genera el código desde el panel y lo comparte
 * por WhatsApp o correo; se consume una sola vez.
 */
export const invitaciones = pgTable(
  "Invitacion",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull().$defaultFn(() => createId()),
    rol: text("rol").notNull().default("OPERADOR"),
    usadaPor: text("usadaPor"),
    expiraEn: timestamp("expiraEn", { precision: 3 }).notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("Invitacion_codigo_key").on(table.codigo),
    index("Invitacion_aprId_idx").on(table.aprId),
  ]
);

export const invitacionesRelations = relations(invitaciones, ({ one }) => ({
  apr: one(aprs, {
    fields: [invitaciones.aprId],
    references: [aprs.id],
  }),
}));

/**
 * Lectura de terreno, previa a la boleta. El operador la registra al mirar
 * el medidor; queda PENDIENTE hasta que el admin la aprueba o rechaza. Solo
 * al aprobarse se usa para calcular una Boleta — así una lectura mal
 * tomada nunca llega a cobrarse sin que alguien la revise primero.
 */
export const lecturas = pgTable(
  "Lectura",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    socioId: text("socioId")
      .notNull()
      .references(() => socios.id, { onDelete: "cascade" }),
    valor: integer("valor").notNull(),
    periodo: text("periodo").notNull(),
    foto: text("foto"),
    observacion: text("observacion"),
    estado: estadoLecturaEnum("estado").notNull().default("PENDIENTE"),
    /** Quién la registró en terreno (el operador) y quién la aprobó/rechazó. */
    registradaPorId: text("registradaPorId").notNull(),
    revisadaPorId: text("revisadaPorId"),
    motivoRechazo: text("motivoRechazo"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("Lectura_socioId_idx").on(table.socioId),
    index("Lectura_estado_idx").on(table.estado),
    // Un socio no puede tener dos lecturas pendientes del mismo período: si el
    // operador se equivoca, primero hay que resolver la que ya está en cola.
    uniqueIndex("Lectura_socio_periodo_pendiente_key")
      .on(table.socioId, table.periodo)
      .where(sql`${table.estado} = 'PENDIENTE'`),
  ]
);

export const lecturasRelations = relations(lecturas, ({ one }) => ({
  socio: one(socios, {
    fields: [lecturas.socioId],
    references: [socios.id],
  }),
}));

export const estadoConsultaEnum = pgEnum("EstadoConsulta", [
  "NUEVA",
  "RESPONDIDA",
  "DESCARTADA",
]);

/**
 * Consulta desde el formulario público de facilapr.cl. No cuelga de ningún
 * Apr: quien escribe todavía no es cliente, es un comité evaluando el
 * producto. Se guarda en vez de mandarse por correo para no perder ninguna
 * si el envío falla, y para poder darles seguimiento con un estado.
 */
export const consultas = pgTable(
  "Consulta",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    nombre: text("nombre").notNull(),
    apr: text("apr").notNull(),
    /** Un solo campo: el formulario acepta correo o teléfono indistintamente. */
    contacto: text("contacto").notNull(),
    mensaje: text("mensaje"),
    /**
     * De dónde vino la visita: document.referrer del navegador (ej.
     * "https://www.google.com/"), o "directo" si escribió la URL a mano o
     * venía de WhatsApp/una app que no manda referrer. Sirve para saber qué
     * canal trae consultas reales, no solo visitas.
     */
    origen: text("origen"),
    estado: estadoConsultaEnum("estado").notNull().default("NUEVA"),
    /** Notas internas al hacer seguimiento; no las ve quien consulta. */
    notas: text("notas"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("Consulta_estado_idx").on(table.estado),
    index("Consulta_createdAt_idx").on(table.createdAt),
  ]
);

export const proveedorIaEnum = pgEnum("ProveedorIA", [
  "anthropic",
  "openai",
  "enlatada",
]);

/**
 * Una fila por cada llamada a un modelo de IA. Existe para poder ver costo
 * real de IA, algo que hoy no se registra en ningún lado: `max_tokens` es
 * solo el tope que se pide, no lo que se gastó.
 *
 * aprId es nullable porque el asistente de la landing (quien evalúa
 * contratar Facilapr) no pertenece a ningún comité todavía.
 */
export const usosIa = pgTable(
  "UsoIA",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId").references(() => aprs.id, { onDelete: "set null" }),
    /** Qué endpoint originó la llamada: asistente-landing, asistente-sitio, generar-sitio. */
    origen: text("origen").notNull(),
    proveedor: proveedorIaEnum("proveedor").notNull(),
    modelo: text("modelo").notNull(),
    tokensEntrada: integer("tokensEntrada").notNull().default(0),
    tokensSalida: integer("tokensSalida").notNull().default(0),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("UsoIA_aprId_idx").on(table.aprId),
    index("UsoIA_createdAt_idx").on(table.createdAt),
  ]
);

export const estadoSolicitudEnum = pgEnum("EstadoSolicitud", [
  "PENDIENTE",
  "APROBADA",
  "RECHAZADA",
]);

/**
 * Pedido de un socio para acceder a su panel. No crea la cuenta todavía:
 * el socio define su RUT y clave, pero la directiva tiene que aprobar antes
 * de que quede activa. Sin esto, cualquiera que sepa el RUT de un socio real
 * (no es secreto, sale en cualquier boleta) podría autoasignarse acceso a
 * su deuda, que la Ley 21.719 trata como dato sensible.
 */
export const solicitudesAcceso = pgTable(
  "SolicitudAcceso",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    socioId: text("socioId")
      .notNull()
      .references(() => socios.id, { onDelete: "cascade" }),
    /**
     * La clave que el socio definió, ya hasheada por Better Auth (nunca en
     * texto plano). Se copia a la cuenta real recién al aprobar; hasta
     * entonces vive aquí y no hay ninguna cuenta que permita iniciar sesión.
     */
    claveHash: text("claveHash").notNull(),
    estado: estadoSolicitudEnum("estado").notNull().default("PENDIENTE"),
    motivoRechazo: text("motivoRechazo"),
    /** Quién de la directiva la resolvió. */
    revisadaPorId: text("revisadaPorId"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("SolicitudAcceso_socioId_idx").on(table.socioId),
    index("SolicitudAcceso_estado_idx").on(table.estado),
    // Un socio no puede tener dos solicitudes pendientes a la vez.
    uniqueIndex("SolicitudAcceso_socio_pendiente_key")
      .on(table.socioId)
      .where(sql`${table.estado} = 'PENDIENTE'`),
  ]
);

export const solicitudesAccesoRelations = relations(
  solicitudesAcceso,
  ({ one }) => ({
    socio: one(socios, {
      fields: [solicitudesAcceso.socioId],
      references: [socios.id],
    }),
  })
);

export const remitenteMensajeEnum = pgEnum("RemitenteMensaje", [
  "SOCIO",
  "DIRECTIVA",
  /** El asistente de IA del chat (plan Grande). */
  "IA",
]);

/**
 * Chat directo entre un socio y la directiva de su comité — reemplaza al
 * bot de WhatsApp que se eliminó del producto. Un socio tiene un único
 * hilo con su comité (no hace falta una tabla de "conversación" aparte:
 * el hilo completo es "los mensajes de este socioId"). Cualquiera de la
 * directiva (ADMIN) puede responder; no hay IA de por medio en este canal,
 * a diferencia del asistente del panel de socio.
 */
export const mensajesSocio = pgTable(
  "MensajeSocio",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    socioId: text("socioId")
      .notNull()
      .references(() => socios.id, { onDelete: "cascade" }),
    remitente: remitenteMensajeEnum("remitente").notNull(),
    /** Quién de la directiva escribió, si remitente = DIRECTIVA. Null si es el socio. */
    autorId: text("autorId"),
    contenido: text("contenido").notNull(),
    leidoPorSocio: boolean("leidoPorSocio").notNull().default(false),
    leidoPorDirectiva: boolean("leidoPorDirectiva").notNull().default(false),
    /** La IA no pudo resolverlo y le pasó la conversación a una persona. */
    requiereHumano: boolean("requiereHumano").notNull().default(false),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("MensajeSocio_socioId_idx").on(table.socioId),
    index("MensajeSocio_createdAt_idx").on(table.createdAt),
  ]
);

export const mensajesSocioRelations = relations(mensajesSocio, ({ one }) => ({
  socio: one(socios, {
    fields: [mensajesSocio.socioId],
    references: [socios.id],
  }),
}));
