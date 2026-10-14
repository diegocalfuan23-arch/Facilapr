/**
 * Contenido del centro de ayuda. Cada artículo es una lista de pasos.
 *
 * Capturas: dejar el archivo en `public/ayuda/<slug>/<n>.png` (n = número de
 * paso, desde 1). Si existe, aparece solo en ese paso; no hay que tocar este
 * archivo. Mientras no exista, el paso se muestra sin imagen.
 */

export type Paso = {
  titulo: string;
  texto: string;
  /** Aviso corto bajo el paso (cuidado, atajo o aclaración). */
  nota?: string;
};

export type Categoria =
  | "Primeros pasos"
  | "Lecturas"
  | "Boletas y cobros"
  | "Portal de socios"
  | "Equipo"
  | "Tu plan";

export type Articulo = {
  slug: string;
  titulo: string;
  /** Título corto para Google (hasta unos 55 caracteres). Si falta, se usa el título normal. */
  tituloSeo?: string;
  resumen: string;
  categoria: Categoria;
  /** Quién necesita este artículo. */
  para: "Administrador" | "Técnico" | "Todos";
  /** Minutos aproximados que toma hacerlo. */
  minutos: number;
  pasos: Paso[];
  /**
   * Video tutorial de YouTube. `id` es lo que va después de «v=» en el enlace
   * (youtube.com/watch?v=ESTE_ID). `segundos` es la duración, para Google.
   */
  video?: { id: string; segundos: number };
};

export const CATEGORIAS: { nombre: Categoria; descripcion: string }[] = [
  {
    nombre: "Primeros pasos",
    descripcion: "Deja el comité listo para empezar a cobrar.",
  },
  {
    nombre: "Lecturas",
    descripcion: "Tomar, revisar y aprobar los medidores.",
  },
  {
    nombre: "Boletas y cobros",
    descripcion: "De la lectura aprobada a la boleta y el pago.",
  },
  {
    nombre: "Portal de socios",
    descripcion: "Que cada socio vea su cuenta, sus recibos y te escriba.",
  },
  {
    nombre: "Equipo",
    descripcion: "Invita a quienes toman las lecturas en terreno.",
  },
  {
    nombre: "Tu plan",
    descripcion: "Qué incluye cada plan y cuál le conviene a tu comité.",
  },
];

export const ARTICULOS: Articulo[] = [
  {
    slug: "registrarse",
    titulo: "Crear la cuenta de tu comité",
    resumen:
      "Registra tu APR o SSR en Facilapr. Se hace una sola vez y toma un par de minutos.",
    categoria: "Primeros pasos",
    para: "Administrador",
    minutos: 3,
    pasos: [
      {
        titulo: "Entra a la página de registro",
        texto:
          "Abre facilapr.cl/registro, o pulsa el botón de crear cuenta en la página principal.",
      },
      {
        titulo: "Completa los datos del comité",
        texto:
          "Escribe el nombre del APR o SSR, el RUT del comité y la comuna.",
        nota: "Usa el RUT del comité, no el tuyo personal.",
      },
      {
        titulo: "Indica quién eres",
        texto:
          "Escribe tu nombre y apellido, y elige tu cargo en el comité: presidente/a, tesorero/a, secretario/a, administrador/a u otro.",
      },
      {
        titulo: "Elige el correo y la contraseña",
        texto:
          "El correo del comité será tu usuario para entrar. Para la contraseña puedes pulsar Sugerir una clave segura: genera una fácil de leer y copiar. Mínimo 8 caracteres.",
        nota: "Guarda la contraseña en un lugar seguro. Si la pierdes, se recupera con el correo (ver Recuperar el acceso a tu cuenta).",
      },
      {
        titulo: "Pulsa Crear cuenta del comité",
        texto:
          "Entras directo al panel. Lo siguiente es configurar las tarifas y cargar a tus socios.",
      },
    ],
  },
  {
    slug: "iniciar-sesion",
    titulo: "Iniciar sesión en el panel",
    resumen: "Entra al panel de tu comité con el correo y la contraseña.",
    categoria: "Primeros pasos",
    para: "Todos",
    minutos: 1,
    pasos: [
      {
        titulo: "Abre la página de acceso",
        texto:
          "Entra a facilapr.cl/login. En celular, conviene guardarla en la pantalla de inicio para llegar con un toque.",
      },
      {
        titulo: "Escribe tu correo y contraseña",
        texto:
          "Es el correo con que se creó tu cuenta o con que te invitaron. Con el icono del ojo puedes ver lo que escribes y evitar errores.",
      },
      {
        titulo: "Pulsa Entrar al panel",
        texto:
          "Verás el resumen del comité. Si eres técnico, entrarás directo a Lecturas.",
        nota: "Si aparece «Correo o contraseña incorrectos», revisa mayúsculas y espacios. Si no la recuerdas, usa ¿La olvidaste?",
      },
    ],
  },
  {
    slug: "recuperar-cuenta",
    titulo: "Recuperar el acceso a tu cuenta",
    resumen:
      "Si olvidaste la contraseña, crea una nueva con un enlace que llega a tu correo.",
    categoria: "Primeros pasos",
    para: "Todos",
    minutos: 3,
    pasos: [
      {
        titulo: "Pulsa ¿La olvidaste?",
        texto:
          "Está junto al campo de contraseña, en la pantalla de inicio de sesión.",
      },
      {
        titulo: "Escribe el correo de tu cuenta",
        texto:
          "Pulsa Enviar enlace de recuperación.",
      },
      {
        titulo: "Confirma que se envió",
        texto:
          "Verás un aviso verde que confirma que te enviamos el enlace. Si el correo no está registrado, en cambio aparece un aviso rojo: «No hay ninguna cuenta con ese correo». Revisa cómo lo escribiste.",
        nota: "El correo debería llegar en unos minutos. Si no lo ves, revisa la carpeta de spam.",
      },
      {
        titulo: "Abre el correo que te llega",
        texto:
          "Busca el mensaje de Facilapr y pulsa el enlace. Si no lo ves en unos minutos, revisa la carpeta de spam.",
        nota: "El enlace vence. Si ya no funciona, pide uno nuevo desde el paso 1.",
      },
      {
        titulo: "Crea la contraseña nueva",
        texto:
          "Escríbela dos veces (mínimo 8 caracteres) y pulsa Guardar contraseña. También puedes usar Sugerir una clave segura.",
      },
      {
        titulo: "Inicia sesión",
        texto:
          "Te llevamos a la pantalla de acceso: entra con tu correo y la contraseña nueva.",
      },
    ],
  },
  {
    slug: "completar-datos-comite",
    titulo: "Completar los datos del comité",
    resumen:
      "Teléfono, dirección y cómo se paga: salen en cada recibo que le llega a tus socios.",
    categoria: "Primeros pasos",
    para: "Administrador",
    minutos: 3,
    pasos: [
      {
        titulo: "Abre Configuración → Comité",
        texto:
          "En el menú entra a Configuración. La primera sección es Comité, con los datos de tu organización.",
      },
      {
        titulo: "Revisa tus datos",
        texto:
          "Nombre, RUT, teléfono, dirección y correo. Aparecen en las boletas y en el recibo en PDF, así que conviene que estén al día. Pulsa Guardar.",
        nota: "Cada bloque se guarda por separado: un cambio en uno no depende de los otros.",
      },
      {
        titulo: "Escribe cómo y dónde se paga",
        texto:
          "Ve a Configuración → Facturación y baja hasta «Cómo y dónde pagar». Escribe el banco, el tipo y número de cuenta, a nombre de quién, y si también reciben efectivo en la oficina.",
        nota: "Pídele a quien transfiera que escriba su número de cliente en el comentario: así es más fácil saber quién pagó.",
      },
      {
        titulo: "Guarda",
        texto:
          "Ese texto sale en cada recibo en PDF y en el mensaje de WhatsApp con el que envías la boleta.",
      },
    ],
  },
  {
    slug: "configurar-tarifas",
    titulo: "Configurar las tarifas del comité",
    resumen:
      "Define el cargo fijo y el valor del metro cúbico. Con eso se calcula cada boleta.",
    categoria: "Primeros pasos",
    para: "Administrador",
    minutos: 2,
    pasos: [
      {
        titulo: "Abre Configuración",
        texto:
          "En el menú de la izquierda entra a Configuración y luego a la pestaña Facturación.",
      },
      {
        titulo: "Ingresa el cargo fijo",
        texto:
          "Es el monto que paga cada cuenta todos los meses, sin importar cuánta agua consuma.",
      },
      {
        titulo: "Ingresa el valor del m³",
        texto:
          "Es lo que se cobra por cada metro cúbico consumido. La boleta suma el cargo fijo más el consumo por este valor.",
        nota: "La tarifa general se aplica a todos. Si cobras distinto a los arranques comerciales, define su tarifa en el recuadro «Tarifa comercial» y marca a esos socios como comerciales.",
      },
      {
        titulo: "Guarda los cambios",
        texto:
          "Las boletas que emitas desde ahora usarán estos valores. Las ya emitidas no cambian.",
      },
    ],
  },
  {
    slug: "cargar-socios",
    titulo: "Cargar el padrón de socios desde un archivo",
    resumen:
      "Importa de una vez todas las cuentas del comité desde tu planilla de Excel.",
    categoria: "Primeros pasos",
    para: "Administrador",
    minutos: 5,
    pasos: [
      {
        titulo: "Prepara tu planilla",
        texto:
          "Una fila por cuenta, con el número de cliente, el nombre y, si lo tienes, el RUT y el teléfono. Cada cuenta es un arranque con su propio medidor.",
        nota: "El RUT y el teléfono son opcionales: hay cuentas de personas sin teléfono, y está bien.",
      },
      {
        titulo: "Entra a Socios",
        texto: "Abre Socios en el menú y pulsa Importar desde archivo.",
      },
      {
        titulo: "Sube el archivo",
        texto:
          "Elige tu planilla. Facilapr detecta las columnas y te muestra una vista previa antes de guardar nada.",
      },
      {
        titulo: "Revisa el resultado",
        texto:
          "Las filas con problemas aparecen marcadas con la razón. Corrige la planilla y vuelve a subirla, o continúa con las filas válidas.",
      },
      {
        titulo: "Confirma la importación",
        texto:
          "Las cuentas quedan en el padrón. Si una cuenta ya no corresponde (fallecido, sin agua), puedes desactivarla desde Socios.",
      },
    ],
  },
  {
    slug: "portal-de-socios",
    titulo: "Que tus socios entren a su cuenta en línea",
    resumen:
      "Cada socio ve lo que debe, sus boletas y recibos en PDF, y puede escribirle al comité.",
    categoria: "Portal de socios",
    para: "Administrador",
    minutos: 5,
    pasos: [
      {
        titulo: "Revisa el enlace de tu comité",
        texto:
          "En Configuración → Comité encuentras «Tu enlace en Facilapr». El portal queda en facilapr.cl/tu-enlace/cuenta/entrar. Puedes cambiar el nombre del enlace si quieres uno más corto.",
        nota: "Si lo cambias, el enlace anterior deja de funcionar: avísale a tus socios.",
      },
      {
        titulo: "Invita a tus socios por WhatsApp",
        texto:
          "En Socios pulsa «Invitar al portal»: aparece la lista de los socios con teléfono que aún no tienen cuenta. Con «Invitar» se abre WhatsApp con un enlace personal; el socio lo abre, elige su clave y entra. El enlace vence en 14 días.",
        nota: "Los socios sin teléfono pueden pedir acceso con RUT desde el enlace general, y tú los apruebas en Solicitudes.",
      },
      {
        titulo: "El socio pide acceso",
        texto:
          "Entra al enlace, pulsa «Solicítala aquí» y escribe su RUT y una clave de su elección (mínimo 8 caracteres). Tiene que ser el RUT que está en tu padrón.",
        nota: "Quien no tiene RUT en el padrón no puede pedir acceso: agrégaselo en Socios.",
      },
      {
        titulo: "Tú apruebas la solicitud",
        texto:
          "En Solicitudes verás una tabla con cada pedido. Aprueba solo si reconoces el RUT como parte del comité; puedes rechazar con un motivo o eliminar el registro.",
      },
      {
        titulo: "El socio entra y ve su cuenta",
        texto:
          "Con su RUT y su clave ve cuánto debe, sus boletas, el recibo en PDF de cada una, y puede escribirle al comité por el chat.",
      },
    ],
  },
  {
    slug: "restablecer-clave-socio",
    titulo: "Restablecer la clave de un socio",
    resumen:
      "Si un socio olvidó su clave, le mandas un enlace y él elige la nueva. Tú nunca la ves.",
    categoria: "Portal de socios",
    para: "Administrador",
    minutos: 2,
    pasos: [
      {
        titulo: "Busca al socio",
        texto:
          "En Socios encuentra su fila y abre el menú de los tres puntos.",
      },
      {
        titulo: "Elige «Restablecer clave»",
        texto:
          "Solo está disponible para quien ya tiene cuenta en el portal. Si dice «Sin cuenta en el portal», todavía no ha creado su acceso: invítalo con «Invitar al portal».",
      },
      {
        titulo: "Mándale el enlace",
        texto:
          "Pulsa «Enviar por WhatsApp»: se abre el chat del socio con el mensaje y su enlace personal ya escritos. Si no tiene un teléfono válido, copia el enlace y hazlo llegar a su teléfono.",
        nota: "La clave nunca pasa por ti ni por ningún mensaje: el socio la escribe él en su celular.",
      },
      {
        titulo: "El socio elige su clave nueva",
        texto:
          "Abre el enlace, escribe la clave dos veces y entra a su cuenta. El enlace sirve una sola vez y vence en 2 días; al usarlo se cierran las sesiones que tuviera abiertas.",
      },
    ],
  },
  {
    slug: "invitar-tecnico",
    titulo: "Invitar a un técnico para tomar lecturas",
    resumen:
      "Dale acceso a quien recorre los medidores, solo para cargar lecturas.",
    categoria: "Equipo",
    para: "Administrador",
    minutos: 2,
    pasos: [
      {
        titulo: "Abre Técnicos",
        texto: "En el menú de la izquierda entra a Técnicos.",
      },
      {
        titulo: "Pulsa Invitar técnico",
        texto: "Se genera al tiro un enlace de invitación personal, que sirve una sola vez y vence en 7 días.",
      },
      {
        titulo: "Envíalo por WhatsApp",
        texto:
          "Si quieres, escribe el teléfono del técnico y pulsa «Enviar por WhatsApp»: se abre su chat con el mensaje y el enlace ya escritos. Si dejas el teléfono vacío, WhatsApp te deja elegir el contacto. También puedes copiar el enlace y mandarlo por otro medio. Con ese enlace la persona crea su propia contraseña.",
        nota: "El técnico solo ve la sección de lecturas: no accede a socios, boletas ni configuración.",
      },
      {
        titulo: "Desactívalo cuando ya no corresponda",
        texto:
          "Si alguien deja de trabajar con el comité, desactívalo desde la misma lista. Pierde el acceso al instante, sin borrar sus lecturas.",
      },
    ],
  },
  {
    slug: "tomar-lecturas-en-terreno",
    titulo: "Tomar lecturas en terreno (también sin señal)",
    resumen:
      "Usa Modo terreno desde el celular. Si no hay internet, las lecturas quedan guardadas y se envían solas después.",
    categoria: "Lecturas",
    para: "Técnico",
    minutos: 3,
    pasos: [
      {
        titulo: "Instala la app en el celular",
        texto:
          "Abre Facilapr en el navegador del teléfono y elige Agregar a la pantalla de inicio. Queda como una app más.",
        nota: "Haz este paso una vez, con señal, antes de salir a terreno.",
      },
      {
        titulo: "Abre Modo terreno con señal",
        texto:
          "Entra a Modo terreno antes de salir. Así el teléfono guarda el padrón y funciona sin internet.",
      },
      {
        titulo: "Busca la cuenta",
        texto:
          "Escribe el nombre, el número de cliente o el RUT. Aparece la última lectura para que compares.",
      },
      {
        titulo: "Ingresa la lectura del medidor",
        texto:
          "Escribe el número que marca el medidor y guarda. Verás el consumo estimado.",
      },
      {
        titulo: "Sincroniza al volver a tener señal",
        texto:
          "Las lecturas pendientes se envían solas cuando el teléfono recupera internet. Las que el servidor rechace quedan avisadas para que las corrijas.",
      },
    ],
  },
  {
    slug: "aprobar-lecturas",
    titulo: "Revisar y aprobar lecturas",
    resumen:
      "Antes de cobrar, el administrador revisa cada lectura. Solo las aprobadas generan boleta.",
    categoria: "Lecturas",
    para: "Administrador",
    minutos: 3,
    pasos: [
      {
        titulo: "Abre Lecturas",
        texto:
          "Verás las lecturas del mes con su estado: pendiente, aprobada o rechazada.",
      },
      {
        titulo: "Revisa el consumo",
        texto:
          "El consumo es la lectura actual menos la última aprobada. Si algo se ve raro (un número muy alto o negativo), revísalo antes de aprobar.",
      },
      {
        titulo: "Corrige o elimina si hay un error",
        texto:
          "Puedes editar una lectura mal digitada o eliminarla, mientras no tenga una boleta emitida.",
      },
      {
        titulo: "Aprueba",
        texto:
          "Aprueba una por una, o usa Aprobar y generar boletas para las que están listas.",
        nota: "La primera lectura de una cuenta no tiene anterior para comparar: ingrésala como Lectura inicial (sin boleta).",
      },
    ],
  },
  {
    slug: "lectura-inicial",
    titulo: "Cargar la lectura inicial de una cuenta",
    resumen:
      "La primera lectura de un medidor no genera cobro: sirve de punto de partida.",
    categoria: "Lecturas",
    para: "Administrador",
    minutos: 2,
    pasos: [
      {
        titulo: "Pulsa Nueva lectura",
        texto: "En Lecturas, elige la cuenta y escribe lo que marca el medidor.",
      },
      {
        titulo: "Marca Lectura inicial",
        texto:
          "Activa la opción Lectura inicial (sin boleta). Queda aprobada y no genera cobro.",
      },
      {
        titulo: "Desde el mes siguiente, lecturas normales",
        texto:
          "Las próximas lecturas se comparan con esta para calcular el consumo y la boleta.",
        nota: "Si el comité cobra desde cero para esa cuenta, se puede indicar al crear la boleta.",
      },
    ],
  },
  {
    slug: "emitir-boleta",
    titulo: "Emitir una boleta",
    resumen:
      "Genera la boleta de una cuenta a partir de su lectura aprobada.",
    categoria: "Boletas y cobros",
    para: "Administrador",
    minutos: 2,
    pasos: [
      {
        titulo: "Abre Boletas",
        texto: "En el menú de la izquierda entra a Boletas y pulsa Nueva boleta.",
      },
      {
        titulo: "Elige la cuenta",
        texto:
          "Usa el buscador por nombre, número de cliente o RUT. Facilapr toma la última lectura aprobada.",
      },
      {
        titulo: "Revisa el consumo y el monto",
        texto:
          "El consumo sale de la lectura; el monto, del cargo fijo más el consumo por el valor del m³.",
        nota: "Si el consumo aparece en 0 m³, falta aprobar la lectura de esa cuenta.",
      },
      {
        titulo: "Emite",
        texto:
          "La boleta queda disponible para compartir y para registrar su pago.",
      },
    ],
  },
  {
    slug: "registrar-pago",
    titulo: "Registrar el pago de una boleta",
    resumen: "Marca como pagada una boleta cuando el socio paga.",
    categoria: "Boletas y cobros",
    para: "Administrador",
    minutos: 1,
    pasos: [
      {
        titulo: "Encuentra la boleta",
        texto: "En Boletas, busca la cuenta o usa el filtro Pendientes.",
      },
      {
        titulo: "Abre el menú de la boleta",
        texto: "En la fila de la boleta pulsa los tres puntos y elige Registrar pago.",
      },
      {
        titulo: "Ingresa el monto pagado",
        texto:
          "Escribe cuánto pagó en total, o pulsa Pagó el total. Si pagó solo una parte, la boleta muestra cuánto falta.",
        nota: "El monto es el acumulado: si ya había abonado, escribe el total pagado hasta hoy.",
      },
      {
        titulo: "Guarda",
        texto: "Con el pago completo la boleta pasa a pagada y deja de aparecer como deuda.",
      },
    ],
  },
  {
    slug: "como-calcular-tarifa-agua-apr",
    titulo: "Cómo calcular la tarifa del agua en un APR (cargo fijo y valor del m³)",
    tituloSeo: "Cómo calcular la tarifa del agua en un APR",
    resumen:
      "Una forma simple de partir de los gastos del comité para definir el cargo fijo y el valor por metro cúbico, con un ejemplo.",
    categoria: "Boletas y cobros",
    para: "Administrador",
    minutos: 8,
    pasos: [
      {
        titulo: "Suma lo que cuesta mantener el servicio cada mes",
        texto:
          "Anota los gastos fijos mensuales del comité: electricidad de la bomba, cloración y análisis, sueldos o gratificaciones, reparaciones y mantención, seguros, gastos de oficina. Suma también un monto mensual para reservar plata para renovar equipos y cubrir imprevistos.",
        nota: "Es una guía práctica, no una norma. La tarifa la define tu directiva con la asamblea y, según tu caso, puede requerir revisión de la autoridad. Consulta con tu unidad municipal de APR o con la Dirección de Obras Hidráulicas.",
      },
      {
        titulo: "Divide el costo en una parte fija y una parte variable",
        texto:
          "La parte fija cubre lo que cuesta tener el sistema funcionando aunque nadie consuma (personal, mantención, reserva). La variable cubre lo que sube con el consumo (electricidad, cloro). Una forma común es repartir la parte fija entre todos los arranques, y la variable entre los metros cúbicos que se consumen.",
      },
      {
        titulo: "Calcula el cargo fijo",
        texto:
          "Cargo fijo = costos fijos mensuales ÷ número de arranques. Por ejemplo: $600.000 de costos fijos entre 120 arranques da un cargo fijo de $5.000.",
      },
      {
        titulo: "Calcula el valor del metro cúbico",
        texto:
          "Valor del m³ = costos variables mensuales ÷ metros cúbicos consumidos en un mes típico. Por ejemplo: $300.000 de costos variables entre 1.500 m³ da $200 por m³. Para saber el consumo típico, usa las lecturas de los últimos meses.",
      },
      {
        titulo: "Arma el monto de una boleta de prueba",
        texto:
          "Boleta = cargo fijo + (consumo en m³ × valor del m³). Con los números de arriba, un socio que consume 15 m³ paga $5.000 + (15 × $200) = $8.000. Revisa que ese monto se sienta justo para los socios que consumen poco, medio y mucho.",
      },
      {
        titulo: "Decide si habrá una tarifa distinta para comercios",
        texto:
          "Si algunos arranques usan el agua para un negocio, muchos comités les cobran más. En Facilapr marcas cada arranque como residencial o comercial, y defines una tarifa comercial opcional.",
      },
      {
        titulo: "Ingresa las tarifas en Facilapr",
        texto:
          "Entra a Configuración → Facturación, escribe el cargo fijo y el valor del m³ (y la tarifa comercial si corresponde) y guarda. Desde ese momento, las lecturas aprobadas generan la boleta solas con esos valores.",
      },
    ],
  },
  {
    slug: "cortes-por-morosidad-apr",
    titulo: "Cómo gestionar los cortes por morosidad en un APR",
    tituloSeo: "Cortes por morosidad en un APR: paso a paso",
    resumen:
      "Del aviso al socio moroso al corte con foto de respaldo y la reposición del servicio, todo registrado.",
    categoria: "Boletas y cobros",
    para: "Administrador",
    minutos: 6,
    pasos: [
      {
        titulo: "Define los días de gracia y de aviso",
        texto:
          "En Configuración → Cortes indica cuántos días de deuda vencida das antes de poder cortar, cuántos días de aviso se le dan al socio, y cuánto cuesta la reconexión si la cobras.",
      },
      {
        titulo: "Mira quiénes están morosos",
        texto:
          "En el menú Cortes, la pestaña Morosos lista los arranques con deuda vencida hace más que los días de gracia, con cuánto deben y hace cuántos días.",
      },
      {
        titulo: "Avisa antes de cortar",
        texto:
          "Con el botón «Avisar antes de cortar» se abre WhatsApp con el mensaje ya escrito: lo que debe, hace cuánto venció y el plazo que tiene para regularizar.",
      },
      {
        titulo: "Ordena el corte",
        texto:
          "Si no regulariza, pulsa «Ordenar corte». La orden queda en trámite y la ve quien sale a terreno.",
      },
      {
        titulo: "Sube la foto del medidor cortado",
        texto:
          "El técnico (o el presidente, si lo hace él) abre la orden en su celular, saca la foto del medidor con el servicio cortado y la envía. Sin foto no queda respaldo.",
      },
      {
        titulo: "Da de alta el corte",
        texto:
          "La directiva revisa la foto y la da de alta. El socio pasa a Cortados y en su cuenta en línea ve que su servicio está cortado.",
        nota: "Si la foto no sirve, usa «Pedir otra foto» y la orden vuelve a trámite.",
      },
      {
        titulo: "Repón el servicio cuando regularice",
        texto:
          "El socio puede pedir la reposición desde su cuenta, o tú la ordenas desde Cortados. La ficha «Ver situación» te muestra si ya pagó su deuda. La reposición también se respalda con foto.",
      },
    ],
  },
  {
    slug: "planilla-cobro-agua-rural",
    titulo: "Planilla para el cobro del agua rural: qué columnas necesitas para cargarla a Facilapr",
    tituloSeo: "Planilla en Excel para cobrar el agua rural (APR)",
    resumen:
      "Cómo ordenar tu planilla de socios y lecturas en Excel para subirla y emitir las primeras boletas.",
    categoria: "Primeros pasos",
    para: "Administrador",
    minutos: 6,
    pasos: [
      {
        titulo: "Arma una fila por cada arranque",
        texto:
          "Cada medidor es una fila, aunque una persona tenga varios. Si alguien tiene dos arranques, aparece dos veces con el mismo RUT.",
      },
      {
        titulo: "Agrega las columnas del padrón",
        texto:
          "Nombre, RUT, número de arranque, dirección y teléfono. El número de arranque es lo que permite distinguir a quien tiene varios medidores. Si algunos arranques son comerciales, agrega una columna «uso» con la palabra comercial o residencial.",
        nota: "Si todavía no tienes los RUT o los teléfonos, súbela igual: puedes completarlos después.",
      },
      {
        titulo: "Sube el padrón",
        texto:
          "En Socios pulsa Importar y elige tu archivo (Excel, CSV o PDF con texto). Antes de guardar, Facilapr te muestra qué entendió de cada fila para que corrijas lo que haga falta.",
      },
      {
        titulo: "Carga la última lectura de cada medidor",
        texto:
          "En Lecturas usa la carga masiva en modo «lectura inicial» con el número que marcaba cada medidor al último mes cobrado. Así la primera boleta cobra solo el consumo del mes, no todo lo acumulado.",
      },
      {
        titulo: "Carga las lecturas del mes",
        texto:
          "Cuando tomes las lecturas actuales, súbelas en modo mensual. Quedan por revisar y, al aprobarlas, Facilapr calcula cada boleta con tus tarifas.",
      },
      {
        titulo: "Revisa las boletas y envía los recibos",
        texto:
          "En Boletas puedes ver el recibo en PDF de cada socio, imprimirlo o enviarlo por WhatsApp con el mensaje ya escrito.",
      },
    ],
  },
  {
    slug: "registrar-pagos-comprobantes",
    titulo: "Cómo registrar el pago de un socio y enviarle el comprobante",
    tituloSeo: "Registrar el pago de un socio y su comprobante",
    resumen:
      "Anota pagos en efectivo, transferencia o Caja Vecina, admite abonos y manda el comprobante en PDF por WhatsApp.",
    categoria: "Boletas y cobros",
    para: "Administrador",
    minutos: 3,
    pasos: [
      {
        titulo: "Abre Pagos y pulsa Registrar pago",
        texto:
          "En el menú Pagos está el botón Registrar pago. No hace falta ir a Boletas: aquí mismo buscas al socio.",
      },
      {
        titulo: "Elige al socio y la boleta",
        texto:
          "Busca por nombre, RUT o número de arranque. Verás sus boletas con saldo; elige la que está pagando.",
      },
      {
        titulo: "Anota el monto, el medio y la fecha",
        texto:
          "Puede pagar todo o abonar una parte. Elige si fue efectivo, transferencia, Caja Vecina u otro, y la fecha real del pago. Si pagó otra persona (un familiar, un arrendatario), márcalo y anota su nombre.",
      },
      {
        titulo: "Envía el comprobante",
        texto:
          "Al guardar se genera un comprobante en PDF. Pulsa «Enviar comprobante por WhatsApp» y se abre el mensaje ya escrito. El socio también lo ve en su cuenta en línea.",
      },
      {
        titulo: "Corrige si te equivocaste",
        texto:
          "Desde el diálogo de la boleta puedes eliminar un pago anotado por error: la boleta vuelve a deber ese monto.",
      },
    ],
  },
  {
    slug: "dar-acceso-socios-cuenta-en-linea",
    titulo: "Cómo dar a tus socios acceso a su cuenta en línea",
    tituloSeo: "Cuenta en línea para los socios de un APR",
    resumen:
      "Invitaciones por WhatsApp, código QR en el recibo y aprobación de solicitudes, para que cada socio vea sus boletas y haga solicitudes.",
    categoria: "Portal de socios",
    para: "Administrador",
    minutos: 4,
    pasos: [
      {
        titulo: "Define la dirección de tu comité",
        texto:
          "Cada comité tiene su dirección propia, algo como facilapr.cl/tu-comite/cuenta. Se define al configurar el comité y es la que ven tus socios.",
      },
      {
        titulo: "Invita por WhatsApp a quien tiene teléfono",
        texto:
          "En Socios, el menú de cada socio tiene «Invitar al portal». Se abre WhatsApp con un enlace personal que le deja crear su clave.",
      },
      {
        titulo: "Para quien no tiene teléfono: el código QR del recibo",
        texto:
          "En los planes con chat, el recibo impreso trae un código QR. El socio lo escanea, pide su acceso con su RUT y tú lo apruebas desde Solicitudes.",
      },
      {
        titulo: "Aprueba los accesos",
        texto:
          "En Solicitudes ves quién pidió entrar. Aprueba solo si reconoces el RUT como parte del comité.",
      },
      {
        titulo: "Qué puede hacer el socio",
        texto:
          "Ver su deuda, sus boletas y pagos con comprobante, y hacer solicitudes: reclamos, reparación, reposición del servicio, baja o reanudación. Tú las resuelves desde Cortes → Solicitudes.",
      },
    ],
  },
  {
    slug: "sistema-para-administrar-un-apr",
    titulo: "Sistema para administrar un APR: qué debe tener y cómo elegirlo",
    tituloSeo: "Sistema para administrar un APR: qué debe tener",
    resumen:
      "Los ocho puntos que conviene revisar antes de elegir un sistema para tu comité de agua potable rural, desde las lecturas hasta el precio.",
    categoria: "Primeros pasos",
    para: "Administrador",
    minutos: 5,
    pasos: [
      {
        titulo: "Anota cómo cobras hoy",
        texto:
          "Antes de comparar sistemas, escribe lo que haces cada mes: quién toma las lecturas, dónde las anotas, cómo calculas cada boleta, cómo te enteras de quién pagó y a quién hay que cortar. Esa lista es tu vara para medir cualquier sistema.",
      },
      {
        titulo: "Que calcule la boleta con la tarifa de tu comité",
        texto:
          "El sistema tiene que usar tu cargo fijo y tu valor del metro cúbico, y calcular solo el consumo a partir de la lectura anterior y la actual. Si además cobras distinto a los comercios, que lo permita sin hacer cuentas aparte.",
      },
      {
        titulo: "Que sirva en terreno, aunque no haya internet",
        texto:
          "Muchas lecturas se toman donde no hay señal. Revisa que el técnico pueda anotarlas desde el celular y que se envíen solas cuando vuelva la conexión.",
      },
      {
        titulo: "Que registre pagos, abonos y morosidad",
        texto:
          "Debe aceptar pagos completos y parciales, anotar el medio (efectivo, transferencia, Caja Vecina) y mostrarte de un vistazo quién está al día y quién tiene boletas vencidas. Y entregar un comprobante al socio.",
      },
      {
        titulo: "Que ordene los cortes y las reposiciones",
        texto:
          "Un corte por morosidad conviene que quede con respaldo: a quién, cuándo y con una foto. Lo mismo la reposición cuando el socio regulariza.",
        nota: "Las reglas para cortar el servicio las fija tu normativa y tu unidad de APR: el sistema ordena el trabajo, no reemplaza esa revisión.",
      },
      {
        titulo: "Que cada socio pueda ver su cuenta",
        texto:
          "Un portal donde el socio vea su deuda, sus boletas y sus pagos le ahorra llamadas a tu oficina. Si además puede pedir una reparación o escribir al comité, mejor.",
      },
      {
        titulo: "Que puedas cargar lo que ya tienes",
        texto:
          "No deberías partir de cero. Pregunta si se puede importar el padrón desde Excel y revisar lo cargado antes de guardarlo.",
      },
      {
        titulo: "Mira el precio y la permanencia",
        texto:
          "Pide el precio completo, con IVA, y si hay contrato de permanencia. En Facilapr el plan Pequeño parte en 0,7 UF al mes más IVA y se puede dejar cuando el comité quiera, sin multas.",
      },
    ],
  },
  {
    slug: "chat-con-socios-asistente-ia",
    titulo: "Cómo funciona el chat con tus socios y el asistente de IA",
    tituloSeo: "Chat con socios y asistente de IA para un APR",
    resumen:
      "Responde a tus socios en tiempo real, activa el asistente de IA para lo repetitivo y controla cuándo habla él y cuándo hablas tú.",
    categoria: "Portal de socios",
    para: "Administrador",
    minutos: 5,
    pasos: [
      {
        titulo: "Entra a Conversaciones",
        texto:
          "En el menú de tu panel está Conversaciones. Cada socio que te escribe desde su cuenta aparece ahí, y los mensajes llegan en tiempo real. Elige un socio y respóndele como en cualquier chat.",
        nota: "El chat está en los planes Estándar y Grande.",
      },
      {
        titulo: "Activa el asistente de IA",
        texto:
          "Ve a Configuración → Asistente de chat. En «Cuándo responde» elige «Siempre responde primero» y guarda. Con «Apagado» solo responde la directiva.",
      },
      {
        titulo: "Escribe tus instrucciones",
        texto:
          "En «Instrucciones propias» puedes indicar el tono y las reglas del comité. Por ejemplo: «Háblales de usted. Si preguntan por cortes, que llamen a la oficina de 9 a 13 h». Admite hasta 1.500 caracteres.",
      },
      {
        titulo: "Qué hace y qué no hace",
        texto:
          "Sus mensajes salen marcados como «Asistente del comité · IA». Responde con los datos de la cuenta del socio y los de tu comité, y no promete plazos ni descuentos. Si es un reclamo, un corte o no sabe la respuesta, marca la conversación como «Necesita respuesta humana» para que entres tú.",
      },
      {
        titulo: "Toma el control cuando quieras",
        texto:
          "Si escribes tú en una conversación, la IA se pausa 10 minutos ahí y después vuelve a responder. También puedes pausarla a mano en una conversación puntual desde la misma pantalla.",
      },
      {
        titulo: "Mira cuánto has usado",
        texto:
          "En Configuración → Uso y consumo ves los tokens de IA del mes. Cuando se acaban, la IA deja de responder y las conversaciones quedan para la directiva. Si necesitas más, puedes pedir un pack adicional de 2.000.000 de tokens, unas 1.000 respuestas, desde el mismo diálogo del asistente.",
      },
    ],
  },
  {
    slug: "que-plan-elegir-apr",
    titulo: "Qué plan elegir para tu APR: Pequeño, Estándar o Grande",
    tituloSeo: "Qué plan elegir para tu APR: Pequeño, Estándar o Grande",
    resumen:
      "Qué incluye cada plan de Facilapr, cuántos socios y técnicos admite, cuánto cuesta y cuál le conviene a tu comité.",
    categoria: "Tu plan",
    para: "Administrador",
    minutos: 3,
    pasos: [
      {
        titulo: "Cuenta cuántos socios y técnicos tienes",
        texto:
          "El tamaño del comité define el plan. Cuenta los arranques con servicio, no a las personas, porque quien tiene dos medidores ocupa dos cuentas. Y piensa cuántas personas toman lecturas en terreno.",
      },
      {
        titulo: "Pequeño: hasta 200 socios",
        texto:
          "Para comités que parten o son chicos. Incluye 1 técnico, boletas, lecturas, pagos con comprobante, cortes y la cuenta en línea de cada socio. No incluye chat ni asistente de IA. Cuesta 0,7 UF al mes más IVA.",
      },
      {
        titulo: "Estándar: hasta 800 socios",
        texto:
          "Para comités medianos. Suma hasta 3 técnicos, el chat en tiempo real con los socios y el asistente de IA, que incluye 3 millones de tokens al mes (unas 1.500 respuestas). Si se acaban, puedes sumar packs de 2 millones. Cuesta 1,5 UF al mes más IVA.",
      },
      {
        titulo: "Grande: sin tope de socios",
        texto:
          "Para comités muy grandes o con varias sedes. El precio es a medida y parte desde 4 UF al mes más IVA, según tus socios y sedes.",
      },
      {
        titulo: "Cómo se calcula el precio",
        texto:
          "Los precios están en UF y se cobran en pesos con el valor de la UF del día, más IVA. Si pagas el año completo, pagas 11 meses.",
      },
      {
        titulo: "Ver tu plan o cambiarlo",
        texto:
          "Tu plan actual aparece en el menú de tu comité, en «Mi plan». Para cambiarlo, escríbenos a hola@facilapr.cl y lo dejamos listo.",
        nota: "Puedes cambiar de plan cuando el comité crezca o cambie. No hay permanencia mínima.",
      },
    ],
  },
];

export function articuloPorSlug(slug: string) {
  return ARTICULOS.find((a) => a.slug === slug);
}

/** Texto de búsqueda de un artículo, en minúsculas y sin tildes. */
export function textoBusqueda(a: Articulo) {
  return normalizar(
    [a.titulo, a.resumen, a.categoria, ...a.pasos.map((p) => `${p.titulo} ${p.texto}`)].join(" "),
  );
}

export function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
