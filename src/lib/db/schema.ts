import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  date,
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
 * ESTANDAR → + chat, finanzas y gestión
 * PREMIUM  → + más capacidad
 */
export const planEnum = pgEnum("Plan", ["BASICO", "ESTANDAR", "PREMIUM"]);

export const frecuenciaLecturaEnum = pgEnum("FrecuenciaLectura", [
  "MENSUAL",
  "BIMENSUAL",
  "TRIMESTRAL",
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

    /** La dirección del comité en Facilapr: pitrelahue → su portal de socios en pitrelahue.facilapr.cl */
    slug: text("slug"),
    /** Horario de atención de la oficina, en texto libre. Lo usa la IA del chat con los socios. */
    horarioAtencion: text("horarioAtencion"),
    /** Tarifas en CLP. Enteros: en Chile no se usan decimales. */
    tarifaCargoFijo: integer("tarifaCargoFijo"),
    tarifaMetroCubico: integer("tarifaMetroCubico"),
    /** Tarifa de los arranques comerciales. Si falta alguna de las dos, se usa la general. */
    tarifaCargoFijoComercial: integer("tarifaCargoFijoComercial"),
    tarifaMetroCubicoComercial: integer("tarifaMetroCubicoComercial"),
    /** Dónde y cómo pagar, en texto libre: varía mucho entre comités. */
    infoPago: text("infoPago"),
    /**
     * Interruptor de la conexión con Mercado Pago (cobro en línea a los socios).
     * Se prende comité por comité; hasta entonces no se ve nada de esto.
     */
    mercadoPagoHabilitado: boolean("mercadoPagoHabilitado").notNull().default(false),
    /** WhatsApp automático: el comprobante sale solo al registrar un pago. Lo prende el comité. */
    whatsappComprobanteAuto: boolean("whatsappComprobanteAuto").notNull().default(false),
    /** WhatsApp automático: el aviso antes de cortar sale solo, una vez al día. Lo prende el comité. */
    whatsappAvisoCorteAuto: boolean("whatsappAvisoCorteAuto").notNull().default(false),
    /** Sale en el buscador público de socios (facilapr.cl/socios). Lo decide el comité; necesita slug. */
    apareceEnBuscador: boolean("apareceEnBuscador").notNull().default(false),
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
    /** Días que se le dan al socio, desde que se le avisa, para regularizar antes de cortar (va en el mensaje de aviso). */
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
    // Parcial: varios comités pueden tener slug en null sin chocar.
    uniqueIndex("Apr_slug_key")
      .on(table.slug)
      .where(sql`${table.slug} IS NOT NULL`),
  ]
);

export const aprsRelations = relations(aprs, ({ many }) => ({
  socios: many(socios),
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
    /** Para qué se usa el agua: RESIDENCIAL o COMERCIAL. */
    uso: text("uso").$type<"RESIDENCIAL" | "COMERCIAL">().notNull().default("RESIDENCIAL"),
    /** E.164. Opcional, y se puede repetir: una persona con varios arranques
        usa el mismo número. */
    telefono: text("telefono"),
    direccion: text("direccion"),
    /** N.º de arranque dentro de su tipo (el socio 3 y el usuario 3 son distintos). */
    numeroCliente: text("numeroCliente"),
    activo: boolean("activo").notNull().default(true),
    /** La directiva pausó la IA del chat solo en la conversación de este arranque. */
    iaPausada: boolean("iaPausada").notNull().default(false),
    /**
     * El socio aceptó recibir WhatsApp automáticos de su comité (Meta lo exige).
     * Lo marca la directiva, que es quien tiene ese acuerdo con el socio.
     */
    whatsappConsentimiento: boolean("whatsappConsentimiento").notNull().default(false),
    whatsappConsentimientoAt: timestamp("whatsappConsentimientoAt", { precision: 3 }),
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

/**
 * Cada pago o abono que el comité registra. Lo normal es sobre una boleta
 * (Boleta.montoPagado es la suma de esos pagos: se recalcula cada vez que se
 * agrega o se quita uno). Los demás cobros (reposición o reconexión, reparación,
 * otros) no cuelgan de ninguna boleta: llevan el socio y un concepto.
 */
export const pagos = pgTable(
  "Pago",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    /** Null en los cobros que no son una boleta (concepto distinto de BOLETA). */
    boletaId: text("boletaId").references(() => boletas.id, { onDelete: "cascade" }),
    /** El socio al que corresponde el pago; en los de boleta, el de la boleta. */
    socioId: text("socioId").references(() => socios.id, { onDelete: "cascade" }),
    /** BOLETA | RECONEXION | REPARACION | OTRO. */
    concepto: text("concepto").notNull().default("BOLETA"),
    /** Qué se está cobrando, en palabras, cuando no es una boleta. */
    descripcion: text("descripcion"),
    /** La orden de trabajo a la que corresponde el cobro (la reposición, la reparación). */
    ordenId: text("ordenId").references(() => ordenes.id, { onDelete: "set null" }),
    /** El acuerdo de pago (repactación) del que es parte este pago, si lo es. */
    repactacionId: text("repactacionId").references(() => repactaciones.id, { onDelete: "set null" }),
    monto: integer("monto").notNull(),
    /** Cuándo se pagó (puede ser anterior a cuando se registró). */
    fecha: timestamp("fecha", { precision: 3 }).notNull().defaultNow(),
    /** EFECTIVO | TRANSFERENCIA | CAJA_VECINA | OTRO (y más adelante MERCADO_PAGO, FLOW). */
    medio: text("medio").notNull().default("OTRO"),
    /** N.º de operación, de transferencia o de comprobante, si lo hay. */
    referencia: text("referencia"),
    /** Quien puso la plata cuando no es el titular del arranque (un familiar, un arrendatario…). */
    pagadoPor: text("pagadoPor"),
    pagadoPorTelefono: text("pagadoPorTelefono"),
    registradoPorId: text("registradoPorId"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("Pago_boletaId_idx").on(table.boletaId),
    index("Pago_socioId_idx").on(table.socioId),
  ]
);

/**
 * Acuerdo con un socio moroso para pagar su deuda en cuotas mensuales
 * (repactación). `deudaTotal` es la deuda vencida del día del acuerdo. Cada
 * cuota que el socio paga se aplica a sus boletas más antiguas, y esos pagos
 * quedan ligados al acuerdo por Pago.repactacionId. Un socio tiene un solo
 * acuerdo ACTIVA a la vez (índice único parcial en la base).
 */
export const repactaciones = pgTable(
  "Repactacion",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    socioId: text("socioId")
      .notNull()
      .references(() => socios.id, { onDelete: "cascade" }),
    deudaTotal: integer("deudaTotal").notNull(),
    cuotas: integer("cuotas").notNull(),
    /** Lo que vale cada cuota; la última absorbe los pesos que sobran. */
    montoCuota: integer("montoCuota").notNull(),
    primerVencimiento: timestamp("primerVencimiento", { precision: 3 }).notNull(),
    /** ACTIVA | CUMPLIDA | CANCELADA. Si va atrasado o no, se calcula con las fechas. */
    estado: text("estado").notNull().default("ACTIVA"),
    nota: text("nota"),
    creadaPorId: text("creadaPorId"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("Repactacion_aprId_idx").on(table.aprId),
    index("Repactacion_socioId_idx").on(table.socioId),
    uniqueIndex("Repactacion_socio_activa_key")
      .on(table.socioId)
      .where(sql`${table.estado} = 'ACTIVA'`),
  ]
);

/**
 * Órdenes de trabajo en terreno sobre un arranque: cortes por morosidad,
 * reposiciones del servicio y reparaciones. Cada una pasa por EN_TRAMITE
 * (alguien tiene que ir), POR_CONFIRMAR (el operador subió la foto) y
 * COMPLETADA (el comité la dio de alta). Las que piden el socio o el operador
 * parten en SOLICITADA hasta que el comité las aprueba.
 */
export const ordenes = pgTable(
  "Orden",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    socioId: text("socioId")
      .notNull()
      .references(() => socios.id, { onDelete: "cascade" }),
    /** CORTE | REPOSICION | REPARACION */
    tipo: text("tipo").notNull(),
    /** SOLICITADA | EN_TRAMITE | POR_CONFIRMAR | COMPLETADA | RECHAZADA | CANCELADA */
    estado: text("estado").notNull(),
    /** Quién la originó: COMITE | TECNICO | SOCIO. */
    origen: text("origen").notNull(),
    /** Para qué es (en una reparación, qué falla); en un corte, la mora que lo motiva. */
    detalle: text("detalle"),
    /** Lo que debía el arranque al ordenar el corte, en CLP. */
    deudaAlOrdenar: integer("deudaAlOrdenar"),
    solicitadaPorId: text("solicitadaPorId"),
    ejecutadaPorId: text("ejecutadaPorId"),
    ejecutadaAt: timestamp("ejecutadaAt", { precision: 3 }),
    notaEjecucion: text("notaEjecucion"),
    confirmadaPorId: text("confirmadaPorId"),
    confirmadaAt: timestamp("confirmadaAt", { precision: 3 }),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("Orden_aprId_estado_idx").on(table.aprId, table.estado),
    index("Orden_socioId_idx").on(table.socioId),
  ]
);

/**
 * Fotos que respaldan una orden. Se guardan en la base (comprimidas en el
 * teléfono, unos 200 KB) para no depender de otro servicio de archivos; se
 * sirven por una ruta que comprueba que la orden es del comité.
 */
export const evidenciasOrden = pgTable(
  "EvidenciaOrden",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    ordenId: text("ordenId")
      .notNull()
      .references(() => ordenes.id, { onDelete: "cascade" }),
    mime: text("mime").notNull(),
    /** La imagen en base64, sin el prefijo data:. */
    datos: text("datos").notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [index("EvidenciaOrden_ordenId_idx").on(table.ordenId)]
);

/**
 * La cuenta de Mercado Pago que un comité conectó (OAuth). Con estos tokens
 * Facilapr cobra a nombre del comité: el dinero va a la cuenta del comité, no a
 * la de Facilapr. Los tokens se guardan cifrados (ver lib/mercadopago-token).
 */
export const mercadoPagoConexiones = pgTable("MercadoPagoConexion", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  aprId: text("aprId")
    .notNull()
    .unique()
    .references(() => aprs.id, { onDelete: "cascade" }),
  mpUserId: text("mpUserId").notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken").notNull(),
  expiraEn: timestamp("expiraEn", { precision: 3 }).notNull(),
  createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
});

/** CONECTADA: el comité puede enviar por su número. ERROR: algún paso de la conexión falló (ver ultimoError). */
export type EstadoConexionWhatsapp = "CONECTADA" | "ERROR";

/**
 * El WhatsApp que un comité conectó con el registro insertado de Meta. Con este
 * acceso Facilapr envía por el número del comité, que le paga a Meta sus propios
 * mensajes. El token y el PIN se guardan cifrados (ver lib/mercadopago, cifrar).
 */
export const whatsappConexiones = pgTable(
  "WhatsappConexion",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .unique()
      .references(() => aprs.id, { onDelete: "cascade" }),
    /** La cuenta de mensajes del comité (lo que Meta llama waba_id). */
    wabaId: text("wabaId").notNull(),
    phoneNumberId: text("phoneNumberId").notNull(),
    numeroMostrado: text("numeroMostrado"),
    nombreVerificado: text("nombreVerificado"),
    accessToken: text("accessToken").notNull(),
    tokenExpiraEn: timestamp("tokenExpiraEn", { precision: 3 }),
    pin: text("pin").notNull(),
    estado: text("estado").$type<EstadoConexionWhatsapp>().notNull().default("CONECTADA"),
    ultimoError: text("ultimoError"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    // Un número pertenece a un solo comité: el webhook de Meta llega con este id.
    uniqueIndex("WhatsappConexion_phoneNumberId_key").on(table.phoneNumberId),
    index("WhatsappConexion_wabaId_idx").on(table.wabaId),
  ]
);

/**
 * Cada pago que un comité hace de su plan de Facilapr (por Flow). Cuando Flow
 * confirma, el plan queda pagado hasta `vigenteHasta`. Es lo que el comité le paga
 * a Facilapr, no lo que sus socios le pagan al comité (eso es la tabla Pago).
 */
export const pagosPlan = pgTable(
  "PagoPlan",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(),
    /** MENSUAL | ANUAL */
    periodo: text("periodo").notNull(),
    /** Sin IVA y con IVA, en pesos, convertidos con la UF del día del cobro. */
    montoNeto: integer("montoNeto").notNull(),
    montoTotal: integer("montoTotal").notNull(),
    valorUf: doublePrecision("valorUf").notNull(),
    flowToken: text("flowToken"),
    flowOrder: text("flowOrder"),
    /** PENDIENTE | PAGADO | RECHAZADO */
    estado: text("estado").notNull().default("PENDIENTE"),
    creadoPorId: text("creadoPorId"),
    pagadoAt: timestamp("pagadoAt", { precision: 3 }),
    vigenteDesde: timestamp("vigenteDesde", { precision: 3 }),
    vigenteHasta: timestamp("vigenteHasta", { precision: 3 }),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("PagoPlan_aprId_idx").on(table.aprId),
    uniqueIndex("PagoPlan_flowToken_key").on(table.flowToken).where(sql`${table.flowToken} IS NOT NULL`),
  ]
);

/**
 * Lo que entra y sale de plata del comité, fuera de las boletas: egresos (luz,
 * reparaciones, insumos, sueldos…) e ingresos que no vienen de un socio (subsidios,
 * aportes). Los pagos de boletas y cobros NO se copian aquí: ya viven en la tabla
 * Pago y el libro los junta al mostrarlos, para que no haya dos versiones de lo mismo.
 */
export const movimientos = pgTable(
  "Movimiento",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    /** INGRESO | EGRESO */
    tipo: text("tipo").notNull(),
    /** El día en que ocurrió, sin hora (así no depende de la zona horaria). AAAA-MM-DD. */
    fecha: date("fecha", { mode: "string" }).notNull(),
    monto: integer("monto").notNull(),
    /** Una de las categorías de lib/finanzas. */
    categoria: text("categoria").notNull(),
    concepto: text("concepto").notNull(),
    /** EFECTIVO | TRANSFERENCIA | CHEQUE | OTRO */
    medio: text("medio").notNull().default("OTRO"),
    /** N.º de factura, boleta, transferencia o cheque, si lo hay. */
    referencia: text("referencia"),
    /** A quién se pagó o de quién vino (proveedor, institución). */
    contraparte: text("contraparte"),
    registradoPorId: text("registradoPorId"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [index("Movimiento_aprId_fecha_idx").on(table.aprId, table.fecha)]
);

/**
 * Materiales que el comité guarda en bodega (cloro, cañerías, medidores, repuestos de
 * bomba…): cuánto hay, desde cuánto avisar y cuánto cuesta cada uno. No se venden, así
 * que no llevan precio; el costo sirve para saber cuánto vale lo que hay guardado.
 */
export const insumos = pgTable(
  "Insumo",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    /** Interno o del proveedor. */
    codigo: text("codigo"),
    /** Una de las categorías de lib/inventario-comun. */
    categoria: text("categoria").notNull().default("OTROS"),
    /** UNIDAD | METRO | KILO | LITRO | SACO | CAJA */
    unidad: text("unidad").notNull().default("UNIDAD"),
    /** Con decimales: se guarda cloro por litros, tubería por metros. */
    stock: doublePrecision("stock").notNull().default(0),
    /** Se avisa cuando el stock llega a esta cantidad o menos. 0 = sin aviso. */
    stockMinimo: doublePrecision("stockMinimo").notNull().default(0),
    /** Costo por unidad, en pesos. */
    costo: integer("costo").notNull().default(0),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [index("Insumo_aprId_idx").on(table.aprId)]
);

/**
 * Categorías de inventario que crea el propio comité, además de las predeterminadas
 * (cloro, cañerías, medidores…). Un material guarda la suya como «p:<id>» en Insumo.categoria.
 */
export const categoriasInsumo = pgTable(
  "CategoriaInsumo",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("CategoriaInsumo_aprId_nombre_key").on(table.aprId, table.nombre)]
);

/**
 * Categorías de Caja que crea el propio comité, una lista para ingresos y otra para egresos.
 * Un movimiento guarda la suya como «p:<id>» en Movimiento.categoria; vacío es «sin categoría».
 */
export const categoriasMovimiento = pgTable(
  "CategoriaMovimiento",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    /** INGRESO | EGRESO */
    tipo: text("tipo").notNull(),
    nombre: text("nombre").notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("CategoriaMovimiento_aprId_tipo_nombre_key").on(table.aprId, table.tipo, table.nombre)]
);

/**
 * El historial del inventario: cada vez que cambia el stock de un material queda una línea con
 * cuánto cambió, cuánto quedó, por qué y quién lo hizo. Guarda el nombre del material para que
 * el historial se conserve aunque el material se borre después.
 */
export const movimientosStock = pgTable(
  "MovimientoStock",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    insumoId: text("insumoId").references(() => insumos.id, { onDelete: "set null" }),
    insumoNombre: text("insumoNombre").notNull(),
    unidad: text("unidad").notNull().default("UNIDAD"),
    /** Cuánto cambió: positivo si el stock subió, negativo si bajó. */
    cantidad: doublePrecision("cantidad").notNull(),
    /** Cuánto stock quedó después del cambio. */
    stockResultante: doublePrecision("stockResultante").notNull(),
    /** MANUAL | COMPRA | ANULACION | INICIAL | CORRECCION */
    origen: text("origen").notNull().default("MANUAL"),
    /** Para qué se sacó, de dónde vino, a qué compra corresponde. */
    motivo: text("motivo"),
    registradoPorId: text("registradoPorId"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("MovimientoStock_aprId_createdAt_idx").on(table.aprId, table.createdAt),
    index("MovimientoStock_insumoId_idx").on(table.insumoId),
  ]
);

/** A quién le compra el comité (cloro, cañerías, repuestos, servicios). */
export const proveedores = pgTable(
  "Proveedor",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    rut: text("rut"),
    email: text("email"),
    telefono: text("telefono"),
    direccion: text("direccion"),
    notas: text("notas"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [index("Proveedor_aprId_idx").on(table.aprId)]
);

/**
 * Una compra a un proveedor. El stock del inventario sube al REGISTRARLA (la mercadería ya
 * llegó), sin esperar a que se pague. Una compra pendiente es una cuenta por pagar; al pagarla
 * se crea su egreso en Caja (`movimientoId`), y al anularla se deshace el stock y el egreso.
 */
export const compras = pgTable(
  "Compra",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    /** Correlativo por comité: C-1, C-2… */
    numero: integer("numero").notNull(),
    proveedorId: text("proveedorId").references(() => proveedores.id, { onDelete: "set null" }),
    /** Se guarda el nombre aunque el proveedor se borre después. */
    proveedorNombre: text("proveedorNombre"),
    fecha: date("fecha", { mode: "string" }).notNull(),
    /** Hasta cuándo hay que pagarla, si se sabe. */
    vencimiento: date("vencimiento", { mode: "string" }),
    /** PENDIENTE | PAGADA | ANULADA */
    estado: text("estado").notNull().default("PENDIENTE"),
    /** N.° de la factura o boleta del proveedor. */
    folio: text("folio"),
    notas: text("notas"),
    subtotal: integer("subtotal").notNull().default(0),
    impuesto: integer("impuesto").notNull().default(0),
    total: integer("total").notNull().default(0),
    /** El egreso que se creó en Caja al pagarla, para poder deshacerlo si se anula. */
    movimientoId: text("movimientoId"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("Compra_aprId_fecha_idx").on(table.aprId, table.fecha),
    uniqueIndex("Compra_aprId_numero_key").on(table.aprId, table.numero),
  ]
);

/** Una línea de una compra: del inventario (suma stock), un material nuevo (lo crea) o solo un gasto. */
export const comprasItems = pgTable(
  "CompraItem",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    compraId: text("compraId")
      .notNull()
      .references(() => compras.id, { onDelete: "cascade" }),
    /** INVENTARIO | NUEVO | GASTO */
    origen: text("origen").notNull(),
    insumoId: text("insumoId").references(() => insumos.id, { onDelete: "set null" }),
    descripcion: text("descripcion").notNull(),
    cantidad: doublePrecision("cantidad").notNull().default(1),
    /** Sin IVA, en pesos. */
    costoUnitario: integer("costoUnitario").notNull().default(0),
  },
  (table) => [index("CompraItem_compraId_idx").on(table.compraId)]
);

/**
 * Pago automático del plan: la tarjeta del comité queda guardada en Flow y cada
 * período se le cobra el monto del día (la UF de ese día). Un comité, una fila.
 */
export const tarjetasPlan = pgTable(
  "TarjetaPlan",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    flowCustomerId: text("flowCustomerId").notNull(),
    /** PENDIENTE (registrando la tarjeta) | ACTIVA | SUSPENDIDA (falló el cobro) | CANCELADA */
    estado: text("estado").notNull().default("PENDIENTE"),
    plan: text("plan").notNull(),
    /** MENSUAL | ANUAL */
    periodo: text("periodo").notNull(),
    registroToken: text("registroToken"),
    tarjetaTipo: text("tarjetaTipo"),
    tarjetaUltimos: text("tarjetaUltimos"),
    /** Cuándo toca el próximo cobro; null si no hay nada programado. */
    proximoCobro: timestamp("proximoCobro", { precision: 3 }),
    /** Cobros seguidos que fallaron; al tercero se suspende. */
    intentos: integer("intentos").notNull().default(0),
    autorizadoPorId: text("autorizadoPorId"),
    autorizadoAt: timestamp("autorizadoAt", { precision: 3 }),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("TarjetaPlan_aprId_key").on(table.aprId),
    index("TarjetaPlan_proximoCobro_idx").on(table.proximoCobro),
  ]
);

export const boletasRelations = relations(boletas, ({ one }) => ({
  socio: one(socios, {
    fields: [boletas.socioId],
    references: [socios.id],
  }),
}));

/**
 * Link de invitación para que un operador se registre como OPERADOR de un
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
    /** Qué endpoint originó la llamada: asistente-landing o el asistente del panel de socio. */
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

/**
 * Cada vez que la directiva avisa a un socio moroso que se le va a cortar el
 * servicio («Avisar antes de cortar»). Deja constancia de a quién se avisó, cuándo
 * y cuánto debía: con eso se sabe si ya se cumplió el plazo antes de cortar.
 * Se guarda cada aviso (no solo el último) como historial.
 */
export const avisosCorte = pgTable(
  "AvisoCorte",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    socioId: text("socioId")
      .notNull()
      .references(() => socios.id, { onDelete: "cascade" }),
    enviadoPorId: text("enviadoPorId"),
    /** Lo que debía el socio al avisarle. */
    deudaAlAvisar: integer("deudaAlAvisar"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("AvisoCorte_socioId_idx").on(table.socioId, table.createdAt),
    index("AvisoCorte_aprId_idx").on(table.aprId),
  ]
);

/** Qué mensaje automático de WhatsApp es. */
export type TipoMensajeWhatsapp = "BOLETA" | "COMPROBANTE" | "AVISO_CORTE";

/** Cómo va un mensaje: lo que Meta avisa por el webhook. */
export type EstadoMensajeWhatsapp = "ENVIADO" | "ENTREGADO" | "LEIDO" | "FALLIDO";

/**
 * Cada mensaje de WhatsApp que Facilapr envía por la API. Sirve para no repetir
 * un envío, para ver si llegó y para contar cuántos usó cada comité. No guarda
 * el teléfono: se llega al socio por `socioId`.
 */
export const mensajesWhatsapp = pgTable(
  "MensajeWhatsApp",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    socioId: text("socioId").references(() => socios.id, { onDelete: "set null" }),
    tipo: text("tipo").$type<TipoMensajeWhatsapp>().notNull(),
    /** La boleta, el pago o el aviso al que corresponde. */
    referenciaId: text("referenciaId"),
    plantilla: text("plantilla").notNull(),
    /** El identificador (wamid) que devuelve Meta: con él se cruza el estado del webhook. */
    metaId: text("metaId"),
    estado: text("estado").$type<EstadoMensajeWhatsapp>().notNull().default("ENVIADO"),
    error: text("error"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("MensajeWhatsApp_aprId_createdAt_idx").on(table.aprId, table.createdAt),
    index("MensajeWhatsApp_socioId_tipo_idx").on(table.socioId, table.tipo, table.createdAt),
    index("MensajeWhatsApp_metaId_idx").on(table.metaId),
    // Un pago manda un solo comprobante automático, aunque el aviso llegue dos veces.
    uniqueIndex("MensajeWhatsApp_comprobante_unico_key")
      .on(table.referenciaId)
      .where(sql`${table.tipo} = 'COMPROBANTE'`),
  ]
);

/**
 * Un socio que no puede entrar avisa a su comité (pantalla «No puedo entrar»,
 * sin sesión: solo escribe su RUT). La directiva la ve en Solicitudes y le manda
 * por WhatsApp el enlace para elegir una clave nueva. No guarda ninguna clave
 * ni dato sensible: solo quién pidió y cuándo. Un socio tiene una sola
 * pendiente a la vez (índice único parcial en la base).
 */
export const solicitudesClave = pgTable(
  "SolicitudClave",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    socioId: text("socioId")
      .notNull()
      .references(() => socios.id, { onDelete: "cascade" }),
    /** PENDIENTE | ATENDIDA | DESCARTADA. */
    estado: text("estado").notNull().default("PENDIENTE"),
    atendidaPorId: text("atendidaPorId"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("SolicitudClave_aprId_estado_idx").on(table.aprId, table.estado),
    uniqueIndex("SolicitudClave_socio_pendiente_key")
      .on(table.socioId)
      .where(sql`${table.estado} = 'PENDIENTE'`),
  ]
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
    /** Cuándo la directiva corrigió el texto; null si nunca se editó. */
    editadoAt: timestamp("editadoAt", { precision: 3 }),
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

/**
 * Las personas que trabajan para el comité (operador, tesorero, administrativo…), con su sueldo u
 * honorario. No es lo mismo que un usuario del panel: aquí va la ficha de quien cobra por su trabajo.
 */
export const trabajadores = pgTable(
  "Trabajador",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    rut: text("rut"),
    cargo: text("cargo").notNull(),
    telefono: text("telefono"),
    email: text("email"),
    /** SUELDO | HONORARIO */
    contrato: text("contrato").notNull().default("SUELDO"),
    /** Lo que se le paga cada mes, en pesos. */
    sueldo: integer("sueldo").notNull().default(0),
    /** Lo que vale un día de esta persona, para descontar los días no trabajados. Null = el sueldo dividido en 30. */
    valorDia: integer("valorDia"),
    /** Se le paga por los días que trabaja (valorDia por día), no un sueldo mensual fijo. */
    porDia: boolean("porDia").notNull().default(false),
    /** Horas de la jornada por semana (42 desde el 26-04-2026, Ley 21.561). */
    jornadaSemanal: doublePrecision("jornadaSemanal").notNull().default(42),
    /** Cuántos días a la semana trabaja (5 o 6): con eso se saca cuántas horas dura su día. */
    diasSemana: integer("diasSemana").notNull().default(5),
    /** Lo que se le paga por cada hora extra. Null = la hora ordinaria con el recargo legal del 50 %. */
    valorHoraExtra: integer("valorHoraExtra"),
    /** Colación y movilización mensuales: no son imponibles, se suman al líquido sin descuentos. */
    noImponible: integer("noImponible").notNull().default(0),
    fechaIngreso: date("fechaIngreso", { mode: "string" }),
    /** La AFP en que cotiza (solo informativa). */
    afp: text("afp"),
    /** Lo que se le descuenta por la AFP, en centésimas de % (1058 = 10,58 %): 10 % más la comisión. */
    afpTasa: integer("afpTasa").notNull().default(0),
    /** Lo que se le descuenta por salud, en centésimas de % (700 = 7 %). */
    saludTasa: integer("saludTasa").notNull().default(700),
    /** Si paga el aporte del trabajador al seguro de cesantía (0,6 %). */
    cesantia: boolean("cesantia").notNull().default(true),
    activo: boolean("activo").notNull().default(true),
    notas: text("notas"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [index("Trabajador_aprId_idx").on(table.aprId)]
);

/** Un pago a un trabajador. Deja su egreso en Caja (`movimientoId`); al anularlo, el egreso se borra. */
export const pagosTrabajador = pgTable(
  "PagoTrabajador",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    trabajadorId: text("trabajadorId")
      .notNull()
      .references(() => trabajadores.id, { onDelete: "cascade" }),
    /** El mes que se paga, AAAA-MM. */
    periodo: text("periodo").notNull(),
    fecha: date("fecha", { mode: "string" }).notNull(),
    monto: integer("monto").notNull(),
    medio: text("medio").notNull().default("TRANSFERENCIA"),
    nota: text("nota"),
    movimientoId: text("movimientoId"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [index("PagoTrabajador_aprId_periodo_idx").on(table.aprId, table.periodo)]
);

/** Una falla o evento del sistema de agua (fuga, corte de bomba, turbiedad…) y cómo se resolvió. */
export const incidentes = pgTable(
  "Incidente",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    /** Correlativo por comité: I-1, I-2… */
    numero: integer("numero").notNull(),
    titulo: text("titulo").notNull(),
    descripcion: text("descripcion"),
    /** FUGA | BOMBA | TURBIEDAD | PRESION | ELECTRICO | OTRO */
    tipo: text("tipo").notNull().default("OTRO"),
    lugar: text("lugar"),
    /** BAJA | MEDIA | ALTA */
    prioridad: text("prioridad").notNull().default("MEDIA"),
    /** ABIERTO | EN_REPARACION | RESUELTO */
    estado: text("estado").notNull().default("ABIERTO"),
    fecha: date("fecha", { mode: "string" }).notNull(),
    fechaResolucion: date("fechaResolucion", { mode: "string" }),
    responsable: text("responsable"),
    solucion: text("solucion"),
    costo: integer("costo").notNull().default(0),
    /** El egreso de Caja con el costo de la reparación, si se registró. */
    movimientoId: text("movimientoId"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("Incidente_aprId_fecha_idx").on(table.aprId, table.fecha),
    uniqueIndex("Incidente_aprId_numero_key").on(table.aprId, table.numero),
  ]
);

/**
 * Una labor de operación del comité (cambiar un medidor, limpiar el estanque, clorar, reparar una
 * matriz…) y los materiales del inventario que usa. Los materiales se descuentan del stock cuando la
 * labor pasa a HECHA (`descontada`), y vuelven si se reabre o se borra.
 */
export const labores = pgTable(
  "Labor",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    /** Correlativo por comité: L-1, L-2… */
    numero: integer("numero").notNull(),
    titulo: text("titulo").notNull(),
    descripcion: text("descripcion"),
    /** MANTENCION | REPARACION | INSTALACION | LIMPIEZA | CLORACION | OTRO */
    tipo: text("tipo").notNull().default("MANTENCION"),
    lugar: text("lugar"),
    /** PROGRAMADA | EN_CURSO | HECHA */
    estado: text("estado").notNull().default("PROGRAMADA"),
    fecha: date("fecha", { mode: "string" }).notNull(),
    /** La hora de inicio programada (HH:MM, hora de Chile). Sin hora, la labor parte a las 00:00 de su fecha. */
    hora: text("hora"),
    /** Cuándo termina: la fecha programada (o, ya hecha, la real) y su hora. Si está definida, la labor pasa sola a Hecha. */
    fechaTermino: date("fechaTermino", { mode: "string" }),
    horaFin: text("horaFin"),
    responsable: text("responsable"),
    /** true si los materiales ya se descontaron del inventario. */
    descontada: boolean("descontada").notNull().default(false),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("Labor_aprId_fecha_idx").on(table.aprId, table.fecha),
    uniqueIndex("Labor_aprId_numero_key").on(table.aprId, table.numero),
  ]
);

/** Un material del inventario que usa una labor. Guarda el nombre y el costo del momento para conservar el registro. */
export const laborInsumos = pgTable(
  "LaborInsumo",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    laborId: text("laborId")
      .notNull()
      .references(() => labores.id, { onDelete: "cascade" }),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    insumoId: text("insumoId").references(() => insumos.id, { onDelete: "set null" }),
    insumoNombre: text("insumoNombre").notNull(),
    unidad: text("unidad").notNull().default("UNIDAD"),
    cantidad: doublePrecision("cantidad").notNull(),
    /** Costo por unidad en el momento de usarlo, en pesos. */
    costoUnitario: integer("costoUnitario").notNull().default(0),
  },
  (table) => [index("LaborInsumo_laborId_idx").on(table.laborId)]
);

/**
 * Los bienes de largo plazo del comité (bomba, estanque, terreno, vehículo, medidores…): qué son,
 * cuándo y en cuánto se compraron, y cuánto valen hoy según su vida útil (depreciación lineal).
 */
export const activosFijos = pgTable(
  "ActivoFijo",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    /** Código interno o inventario del comité, si lo usan. */
    codigo: text("codigo"),
    /** BOMBA | ESTANQUE | CAPTACION | RED | TERRENO | EDIFICIO | VEHICULO | EQUIPO | MEDIDORES | OTRO */
    categoria: text("categoria").notNull().default("OTRO"),
    ubicacion: text("ubicacion"),
    fechaAdquisicion: date("fechaAdquisicion", { mode: "string" }).notNull(),
    costo: integer("costo").notNull().default(0),
    /** Años que dura útil. 0 = no se deprecia (un terreno). */
    vidaUtilAnios: integer("vidaUtilAnios").notNull().default(0),
    /** OPERATIVO | EN_REPARACION | BAJA */
    estado: text("estado").notNull().default("OPERATIVO"),
    responsable: text("responsable"),
    notas: text("notas"),
    /** El egreso de Caja con el costo de adquisición, si se anotó al registrarlo. */
    movimientoId: text("movimientoId"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [index("ActivoFijo_aprId_idx").on(table.aprId)]
);

/** La liquidación de un mes de una persona: sueldo base, bonos y descuentos. Al pagarla deja su egreso en Caja. */
export const remuneraciones = pgTable(
  "Remuneracion",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    trabajadorId: text("trabajadorId")
      .notNull()
      .references(() => trabajadores.id, { onDelete: "cascade" }),
    /** El mes, AAAA-MM. */
    periodo: text("periodo").notNull(),
    sueldoBase: integer("sueldoBase").notNull().default(0),
    /** Días del mes que no se pagan (faltas, licencias, permisos sin goce). Las vacaciones sí se pagan. */
    diasDescontados: integer("diasDescontados").notNull().default(0),
    /** Lo que se descuenta del sueldo por esos días: base / 30 por cada día. */
    descAusencias: integer("descAusencias").notNull().default(0),
    /** Horas de permiso sin goce que se descontaron (además de los días). */
    horasDescontadas: doublePrecision("horasDescontadas").notNull().default(0),
    /** Horas extras del mes y lo que se paga por ellas. */
    horasExtra: doublePrecision("horasExtra").notNull().default(0),
    montoHorasExtra: integer("montoHorasExtra").notNull().default(0),
    /** Colación y movilización de este mes (no imponibles). */
    noImponible: integer("noImponible").notNull().default(0),
    bonos: integer("bonos").notNull().default(0),
    /** El desglose de lo que se descuenta; `descuentos` es la suma de todo. */
    descAfp: integer("descAfp").notNull().default(0),
    descSalud: integer("descSalud").notNull().default(0),
    descCesantia: integer("descCesantia").notNull().default(0),
    /** La retención de la boleta de honorarios (solo si se paga a honorarios). */
    retencion: integer("retencion").notNull().default(0),
    otrosDescuentos: integer("otrosDescuentos").notNull().default(0),
    descuentos: integer("descuentos").notNull().default(0),
    /** Lo que se le paga: base + bonos - descuentos. */
    liquido: integer("liquido").notNull().default(0),
    /** PENDIENTE | PAGADA */
    estado: text("estado").notNull().default("PENDIENTE"),
    fechaPago: date("fechaPago", { mode: "string" }),
    medio: text("medio"),
    nota: text("nota"),
    movimientoId: text("movimientoId"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("Remuneracion_trabajador_periodo_key").on(table.trabajadorId, table.periodo)]
);

/** Vacaciones, licencias médicas y permisos de una persona, con sus fechas. */
export const ausencias = pgTable(
  "Ausencia",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    trabajadorId: text("trabajadorId")
      .notNull()
      .references(() => trabajadores.id, { onDelete: "cascade" }),
    /** VACACIONES | LICENCIA | PERMISO */
    tipo: text("tipo").notNull(),
    desde: date("desde", { mode: "string" }).notNull(),
    hasta: date("hasta", { mode: "string" }).notNull(),
    /** Vacaciones y permisos: días hábiles. Licencias: días corridos. */
    dias: integer("dias").notNull().default(0),
    /** SOLICITADA | APROBADA | RECHAZADA */
    estado: text("estado").notNull().default("APROBADA"),
    /** En una licencia: el motivo o el N.° de folio. */
    detalle: text("detalle"),
    /** Solo en un permiso: true si no se paga ese día (sin goce de sueldo). */
    sinGoce: boolean("sinGoce").notNull().default(false),
    /** Solo en un permiso por horas (de un solo día): cuántas horas. Null = el permiso es por días. */
    horas: doublePrecision("horas"),
    nota: text("nota"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [index("Ausencia_aprId_desde_idx").on(table.aprId, table.desde)]
);

/**
 * Un anticipo o préstamo del comité a una persona del personal. Sus cuotas se descuentan solas al armar
 * cada mes en Remuneraciones; cada descuento queda en PrestamoDescuento, y de ahí sale lo que falta.
 */
export const prestamos = pgTable(
  "Prestamo",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    trabajadorId: text("trabajadorId")
      .notNull()
      .references(() => trabajadores.id, { onDelete: "cascade" }),
    /** ANTICIPO | PRESTAMO */
    tipo: text("tipo").notNull().default("PRESTAMO"),
    monto: integer("monto").notNull(),
    cuotas: integer("cuotas").notNull().default(1),
    cuotaMonto: integer("cuotaMonto").notNull(),
    /** AAAA-MM: el mes de la primera cuota. */
    primerPeriodo: text("primerPeriodo").notNull(),
    /** El día en que se entregó la plata. */
    fecha: date("fecha", { mode: "string" }).notNull(),
    /** ACTIVO | CERRADO */
    estado: text("estado").notNull().default("ACTIVO"),
    nota: text("nota"),
    /** El egreso de Caja con la entrega, si se anotó. */
    movimientoId: text("movimientoId"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [index("Prestamo_aprId_idx").on(table.aprId), index("Prestamo_trabajadorId_idx").on(table.trabajadorId)]
);

/** Lo descontado de un préstamo en una liquidación. Si se borra la liquidación, el descuento se va con ella. */
export const prestamoDescuentos = pgTable(
  "PrestamoDescuento",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    prestamoId: text("prestamoId")
      .notNull()
      .references(() => prestamos.id, { onDelete: "cascade" }),
    remuneracionId: text("remuneracionId")
      .notNull()
      .references(() => remuneraciones.id, { onDelete: "cascade" }),
    periodo: text("periodo").notNull(),
    monto: integer("monto").notNull(),
  },
  (table) => [uniqueIndex("PrestamoDescuento_prestamo_periodo_key").on(table.prestamoId, table.periodo)]
);

/** Las horas extras que trabajó una persona en un día. Se suman solas al armar la liquidación del mes. */
export const horasExtras = pgTable(
  "HoraExtra",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    trabajadorId: text("trabajadorId")
      .notNull()
      .references(() => trabajadores.id, { onDelete: "cascade" }),
    fecha: date("fecha", { mode: "string" }).notNull(),
    horas: doublePrecision("horas").notNull(),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("HoraExtra_trabajador_fecha_key").on(table.trabajadorId, table.fecha), index("HoraExtra_aprId_fecha_idx").on(table.aprId, table.fecha)]
);

/** El registro diario de asistencia: un estado por persona y por día. */
export const asistencias = pgTable(
  "Asistencia",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    trabajadorId: text("trabajadorId")
      .notNull()
      .references(() => trabajadores.id, { onDelete: "cascade" }),
    fecha: date("fecha", { mode: "string" }).notNull(),
    /** PRESENTE | ATRASO | AUSENTE | PERMISO */
    estado: text("estado").notNull(),
    nota: text("nota"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("Asistencia_trabajador_fecha_key").on(table.trabajadorId, table.fecha)]
);

/** Un arranque del comité: un punto de conexión a la red que abastece a uno o más socios. */
export const arranques = pgTable(
  "Arranque",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    aprId: text("aprId")
      .notNull()
      .references(() => aprs.id, { onDelete: "cascade" }),
    /** Cómo lo nombra el comité: «Arranque 12», «Pasaje Los Aromos», etc. */
    nombre: text("nombre").notNull(),
    ubicacion: text("ubicacion"),
    notas: text("notas"),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (table) => [index("Arranque_aprId_idx").on(table.aprId)]
);

/** Qué socios abastece cada arranque. Un socio pertenece a un solo arranque. */
export const arranqueSocios = pgTable(
  "ArranqueSocio",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    arranqueId: text("arranqueId")
      .notNull()
      .references(() => arranques.id, { onDelete: "cascade" }),
    socioId: text("socioId")
      .notNull()
      .references(() => socios.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("ArranqueSocio_socioId_key").on(table.socioId), index("ArranqueSocio_arranqueId_idx").on(table.arranqueId)]
);
