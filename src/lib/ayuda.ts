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
  | "Finanzas"
  | "RR.HH."
  | "Operación"
  | "Tu plan";

export type Articulo = {
  slug: string;
  titulo: string;
  /** Título corto para Google (hasta unos 55 caracteres). Si falta, se usa el título normal. */
  tituloSeo?: string;
  resumen: string;
  categoria: Categoria;
  /** Quién necesita este artículo. */
  para: "Administrador" | "Operador" | "Todos";
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
    nombre: "Finanzas",
    descripcion: "La plata del comité: caja, compras, bodega e informes. Desde el plan Estándar.",
  },
  {
    nombre: "RR.HH.",
    descripcion: "Personal, sueldos, vacaciones, licencias y asistencia. Desde el plan Estándar.",
  },
  {
    nombre: "Operación",
    descripcion: "Incidentes, activos fijos y labores con materiales del inventario. Desde el plan Estándar.",
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
          "Verás el resumen del comité. Si eres operador, entrarás directo a Lecturas.",
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
          "Verás un aviso verde que confirma que te enviamos el enlace y te dice a qué correo. Si no llegó o te equivocaste de correo, escribe otro en el mismo campo que queda debajo y pulsa «Enviar a otro correo». Puedes repetirlo las veces que haga falta. Si el correo no está registrado, en cambio aparece un aviso rojo: «No hay ninguna cuenta con ese correo». Revisa cómo lo escribiste.",
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
      "Si un socio olvidó su clave, pide ayuda desde su pantalla de ingreso, le mandas un enlace y él elige la nueva. Tú nunca la ves.",
    categoria: "Portal de socios",
    para: "Administrador",
    minutos: 2,
    pasos: [
      {
        titulo: "El socio avisa desde su pantalla de ingreso",
        texto:
          "En la pantalla donde entra con su RUT, el socio pulsa «Avisa a tu comité», escribe su RUT y listo. Ves la solicitud en Solicitudes, en la sección «Piden una clave nueva», con un número rojo en el menú. Desde ahí pulsa «Enviar enlace» y sigue con «Mándale el enlace».",
        nota: "El socio siempre ve el mismo mensaje, sea o no socio, para que nadie pueda averiguar quién pertenece al comité. Si no hay solicitud, también puedes hacerlo tú desde Socios.",
      },
      {
        titulo: "O búscalo tú en Socios",
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
    titulo: "Invitar a un operador para tomar lecturas",
    resumen:
      "Dale acceso a quien recorre los medidores, solo para cargar lecturas.",
    categoria: "Equipo",
    para: "Administrador",
    minutos: 2,
    pasos: [
      {
        titulo: "Abre Equipo",
        texto: "En el menú de la izquierda entra a Equipo.",
      },
      {
        titulo: "Pulsa Invitar operador",
        texto: "Se genera al tiro un enlace de invitación personal, que sirve una sola vez y vence en 7 días.",
      },
      {
        titulo: "Envíalo por WhatsApp",
        texto:
          "Si quieres, escribe el teléfono del operador y pulsa «Enviar por WhatsApp»: se abre su chat con el mensaje y el enlace ya escritos. Si dejas el teléfono vacío, WhatsApp te deja elegir el contacto. También puedes copiar el enlace y mandarlo por otro medio. Con ese enlace la persona crea su propia contraseña.",
        nota: "El operador solo ve la sección de lecturas: no accede a socios, boletas ni configuración.",
      },
      {
        titulo: "Desactívalo cuando ya no corresponda",
        texto:
          "Si alguien deja de trabajar con el comité, desactívalo desde la misma lista. Pierde el acceso al instante, sin borrar sus lecturas.",
      },
    ],
  },
  {
    slug: "invitar-tesorero",
    titulo: "Dar acceso a un tesorero para llevar las finanzas",
    resumen: "El tesorero entra al panel solo a las finanzas: pagos, caja, compras, reportes e inventario.",
    categoria: "Equipo",
    para: "Administrador",
    minutos: 2,
    pasos: [
      {
        titulo: "Abre Equipo",
        texto: "En Gestión → Equipo pulsa «Invitar tesorero». El botón aparece en los planes Estándar y Grande, que incluyen las finanzas.",
      },
      {
        titulo: "Envía el enlace",
        texto: "Se genera un enlace de un solo uso que vence en 7 días. Mándalo por WhatsApp o cópialo. La persona crea su propia clave.",
      },
      {
        titulo: "Qué ve el tesorero",
        texto: "Pagos, Caja, Compras, Reportes (con el informe para la asamblea) e Inventario. No ve Socios, Boletas, Configuración, Plan ni RR.HH.: los sueldos del personal quedan solo para el administrador.",
        nota: "El tesorero puede registrar, corregir y anular pagos y movimientos de esas pantallas: es quien maneja la plata del comité.",
      },
      {
        titulo: "Quítale el acceso cuando corresponda",
        texto: "Desde la misma lista, «Desactivar» le cierra la sesión al instante. Al reactivarlo vuelve como tesorero.",
      },
    ],
  },
  {
    slug: "tomar-lecturas-en-terreno",
    titulo: "Tomar lecturas en terreno (también sin señal)",
    tituloSeo: "Tomar lecturas de medidores de un APR sin internet",
    resumen:
      "Toma las lecturas de los medidores desde el celular, aunque no haya internet: quedan guardadas y se envían solas cuando vuelve la señal.",
    categoria: "Lecturas",
    para: "Operador",
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
          "En Configuración → Cortes indica cuántos días de deuda vencida das antes de poder cortar, cuántos días se le dan al socio, desde que se le avisa, para regularizar, y cuánto cuesta la reconexión si la cobras.",
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
          "El operador (o el presidente, si lo hace él) abre la orden en su celular, saca la foto del medidor con el servicio cortado y la envía. Sin foto no queda respaldo.",
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
    // La planilla descargable vive en /planilla-cobro-agua-potable-rural.
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
        titulo: "Elige qué paga, al socio y la boleta",
        texto:
          "Primero marca qué está pagando: una boleta, una reposición o reconexión, una reparación u otro cobro. Luego busca al socio por nombre, RUT o número de arranque. Si es una boleta, verás sus boletas con saldo y eliges la que está pagando.",
        nota: "La reposición, la reparación y los otros cobros no tienen boleta: se anotan con un monto y un detalle, y también dejan su comprobante. En la reposición el monto parte con el costo de reconexión que definiste en Configuración, y lo puedes cambiar.",
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
    slug: "repactar-deuda-socio",
    titulo: "Cómo repactar la deuda de un socio moroso en cuotas",
    tituloSeo: "Repactar la deuda de un socio moroso en un APR",
    resumen:
      "Crea un acuerdo para que un socio pague su deuda vencida en cuotas mensuales, registra cada pago y mira si va al día.",
    categoria: "Boletas y cobros",
    para: "Administrador",
    minutos: 4,
    pasos: [
      {
        titulo: "Abre Cortes y entra a Repactaciones",
        texto:
          "En el menú Cortes está la pestaña Repactaciones. Ahí aparecen los acuerdos activos y el botón Nueva repactación para crear uno.",
      },
      {
        titulo: "Elige al socio",
        texto:
          "Solo aparecen socios con deuda vencida y sin otro acuerdo activo. Verás cuánto debe hoy: esa es la deuda que se reparte.",
      },
      {
        titulo: "Define las cuotas y la primera fecha",
        texto:
          "Elige en cuántas cuotas mensuales (de 2 a 60) y cuándo vence la primera. Las siguientes vencen el mismo día de cada mes. Antes de guardar ves cuánto vale cada cuota; la última se ajusta para que el total cuadre.",
        nota: "Las boletas nuevas que se sigan emitiendo no entran al acuerdo: se pagan aparte, como siempre.",
      },
      {
        titulo: "Registra cada pago",
        texto:
          "Cuando el socio pague, pulsa Registrar pago de cuota en su tarjeta. El dinero se aplica a sus boletas más antiguas primero, así su deuda baja de verdad. Se genera un comprobante que puedes enviarle por WhatsApp.",
      },
      {
        titulo: "Sigue cómo va",
        texto:
          "Cada tarjeta muestra cuántas cuotas lleva, cuánto falta y si el socio va al día o atrasado. Cuando paga todo, el acuerdo pasa solo a cumplido. Si no va a seguir, pulsa Cancelar acuerdo: los pagos que ya hizo se mantienen.",
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
          "Muchas lecturas se toman donde no hay señal. Revisa que el operador pueda anotarlas desde el celular y que se envíen solas cuando vuelva la conexión.",
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
    slug: "caja-ingresos-egresos-apr",
    titulo: "Llevar la caja del comité: ingresos y egresos",
    resumen: "Anota lo que entra y sale de la plata del comité, y cierra la caja cada día.",
    categoria: "Finanzas",
    para: "Administrador",
    minutos: 4,
    pasos: [
      {
        titulo: "Abre Caja",
        texto:
          "En el grupo Finanzas del menú, entra a Caja. Ves el disponible, lo que entró y lo que salió, por día o por mes. Está en los planes Estándar y Grande.",
      },
      {
        titulo: "Indica con cuánta plata partes",
        texto:
          "Pulsa Saldo inicial y escribe cuánta plata tiene hoy el comité. Desde esa fecha, el disponible se calcula solo. Se hace una vez.",
      },
      {
        titulo: "Los pagos de los socios entran solos",
        texto:
          "Cada pago que registras en una boleta aparece como ingreso en la Caja. No hay que anotarlo dos veces.",
      },
      {
        titulo: "Anota los otros ingresos y los egresos",
        texto:
          "Pulsa Nuevo movimiento, elige si es ingreso o egreso, el monto, la fecha y una categoría. Las categorías las puedes crear y renombrar desde la misma pantalla.",
        nota: "Las compras que marcas como pagadas bajan solas a la Caja como egreso.",
      },
      {
        titulo: "Cierra la caja del día",
        texto:
          "Al terminar el día, pulsa Cerrar caja y, si quieres, deja un comentario. Un día cerrado no admite movimientos manuales ni compras hasta que lo reabras, así nada cambia por error.",
        nota: "Los pagos de socios sí pueden seguir entrando: son plata que de verdad llegó.",
      },
      {
        titulo: "Efectivo y banco: giros y depósitos",
        texto: "En «Saldo inicial» indica cuánto de la plata estaba en el banco. Desde entonces la Caja muestra cuánto hay en efectivo y cuánto en el banco: lo que entra o sale por transferencia, cheque o pago en línea va al banco, y lo demás a efectivo. Cuando saques plata de la cuenta, entra a Finanzas → Giros y anota un giro (del banco a efectivo); si llevas efectivo al banco, un depósito. Ahí también ves el historial.",
        nota: "Un giro o un depósito no es ingreso ni egreso: la plata solo cambia de lugar y el total no cambia. No deja mover más de lo que hay en el lugar de origen.",
      },
      {
        titulo: "Descarga o busca",
        texto: "Puedes buscar un movimiento y descargar el libro en Excel para tu tesorero o para la asamblea.",
      },
    ],
  },
  {
    slug: "compras-proveedores-apr",
    titulo: "Registrar compras y proveedores del comité",
    resumen: "Anota lo que compra el comité, a quién y si ya se pagó. Lo pagado baja a Caja.",
    categoria: "Finanzas",
    para: "Administrador",
    minutos: 4,
    pasos: [
      {
        titulo: "Abre Compras",
        texto: "En Finanzas → Compras ves tus compras, lo que se debe a proveedores y el total del mes. Está en los planes Estándar y Grande.",
      },
      {
        titulo: "Crea el proveedor",
        texto:
          "Al registrar una compra puedes elegir un proveedor o crear uno nuevo ahí mismo, con su nombre y datos de contacto.",
      },
      {
        titulo: "Registra la compra",
        texto:
          "Pulsa Nueva compra. Agrega cada ítem: un material de tu inventario, un servicio o mano de obra, o un gasto libre. Indica la fecha y el documento si lo tienes.",
        nota: "Si el ítem es de tu inventario, el stock sube al registrar la compra, aunque aún no la hayas pagado.",
      },
      {
        titulo: "Marca si está pagada",
        texto:
          "Una compra pagada genera un egreso en la Caja, en la fecha del pago. Una compra por pagar queda como deuda con el proveedor hasta que la pagues.",
      },
      {
        titulo: "Paga después",
        texto:
          "Abre el detalle de la compra y registra el pago con su medio de pago. Desde ese momento aparece en la Caja.",
      },
    ],
  },
  {
    slug: "inventario-bodega-apr",
    titulo: "Controlar el inventario de la bodega del comité",
    resumen: "Lleva el stock de cloro, repuestos y materiales, con categorías e historial.",
    categoria: "Finanzas",
    para: "Administrador",
    minutos: 3,
    pasos: [
      {
        titulo: "Abre Inventario",
        texto: "En Gestión → Inventario ves cada material con su stock. Está en los planes Estándar y Grande.",
      },
      {
        titulo: "Agrega un material",
        texto: "Registra su nombre, la unidad (litros, unidades, metros), el stock con que parte y su costo.",
      },
      {
        titulo: "Ordénalos en categorías",
        texto: "Crea tus propias categorías (cloro, tuberías, herramientas) para filtrar y encontrar rápido.",
      },
      {
        titulo: "Ajusta el stock",
        texto:
          "Con Ajustar stock registras una entrada o una salida, por ejemplo cuando se usa cloro o se pierde un repuesto. Cada ajuste queda guardado.",
        nota: "Las compras de materiales suman el stock automáticamente.",
      },
      {
        titulo: "Mira el historial",
        texto: "Pulsa Ver el historial de un material para saber cuándo y por qué cambió su stock.",
      },
    ],
  },
  {
    slug: "reportes-informe-asamblea-apr",
    titulo: "Reportes del año e informe para la asamblea",
    resumen: "Ve el año mes a mes y prepara un informe de caja para rendir cuentas a los socios.",
    categoria: "Finanzas",
    para: "Administrador",
    minutos: 3,
    pasos: [
      {
        titulo: "Abre Reportes",
        texto:
          "En Finanzas → Reportes ves el año completo: cuánto entró, cuánto salió y cuál fue el resultado, con un gráfico mes a mes. Está en los planes Estándar y Grande.",
      },
      {
        titulo: "Revisa en qué se gastó",
        texto: "Las categorías muestran qué parte de los egresos fue a cada gasto, y cuánto se debe aún a proveedores.",
      },
      {
        titulo: "Prepara el informe para la asamblea",
        texto:
          "Desde Caja, abre el informe del mes. Es un resumen ordenado que puedes imprimir o guardar como PDF para presentarlo a los socios.",
        nota: "Los reportes se arman con lo que anotaste en Caja y Compras: mientras más al día esté, más útil es el informe.",
      },
    ],
  },
  {
    slug: "personal-ficha-trabajadores-apr",
    titulo: "Registrar al personal del comité: ficha y sueldo",
    resumen: "Carga a las personas que trabajan para el comité con su cargo, contrato, sueldo bruto, AFP y salud.",
    categoria: "RR.HH.",
    para: "Administrador",
    minutos: 4,
    pasos: [
      {
        titulo: "Abre Personal",
        texto: "En el grupo RR.HH. del menú, entra a Personal. Aquí ves a todas las personas del comité con su cargo, su sueldo bruto, sus descuentos y su líquido. Está en los planes Estándar y Grande.",
      },
      {
        titulo: "Agrega a la persona",
        texto: "Pulsa «+ Nueva persona» y completa su nombre, RUT, cargo, teléfono, correo y la fecha en que ingresó.",
      },
      {
        titulo: "Elige el tipo de contrato",
        texto: "Sueldo, si está a contrato, u honorarios, si te emite boleta de honorarios. De eso depende cómo se calculan sus descuentos.",
      },
      {
        titulo: "Anota el sueldo bruto y los descuentos",
        texto: "Escribe el sueldo bruto, elige su AFP (queda cargada la tasa) y su salud, y revisa la cesantía. Abajo ves en vivo cuánto le descuentan y cuánto queda líquido.",
        nota: "Lo que ves en la ficha es una estimación para que cuadre con su liquidación. El cálculo real de cada mes se hace en Remuneraciones.",
      },
      {
        titulo: "Define su jornada y la hora extra",
        texto: "En «Jornada (horas por semana)» queda 42, la jornada legal desde el 26 de abril de 2026; cámbiala si trabaja menos. Con «Días a la semana» el sistema calcula cuánto dura su día, y eso sirve para descontar los permisos por horas. En «Valor de la hora extra» puedes fijar lo que el comité paga; vacío, se usa la hora ordinaria con el recargo legal del 50 %.",
        nota: "La hora ordinaria se calcula con la fórmula de la Dirección del Trabajo: sueldo mensual × 7 ÷ (30 × horas de la semana). Conviene que tu contador confirme el valor con el contrato de cada persona.",
      },
      {
        titulo: "Si se le paga por día trabajado",
        texto: "En «Cómo se le paga» elige «Por día trabajado» y escribe cuánto se le paga por día. No lleva sueldo mensual: cada mes se le paga según los días que trabajó, tomados de la asistencia. Si en cambio tiene sueldo mensual, el «Valor del día» opcional define cuánto se le descuenta por cada día que no trabaje; vacío, se usa el sueldo dividido en 30.",
      },
      {
        titulo: "Dale acceso al panel, si lo necesita",
        texto: "Al abrir su ficha, la sección «Acceso al panel» te dice si ya tiene cuenta. Si no, puedes invitarla como operador o como tesorero con un enlace de un solo uso. La ficha y la cuenta se ligan por el correo, así que usa el mismo. Quien ya tiene acceso pero no tiene ficha aparece en un aviso arriba, con un botón para crearla.",
      },
      {
        titulo: "Si la persona se va",
        texto: "Cámbiale el estado a «Inactivo» en vez de borrarla: deja de aparecer en las liquidaciones nuevas, pero se conserva todo lo anterior.",
      },
    ],
  },
  {
    slug: "remuneraciones-liquidaciones-apr",
    titulo: "Calcular y pagar los sueldos del mes",
    resumen: "Arma las liquidaciones con descuentos legales y ausencias, y paga: el egreso queda solo en la Caja.",
    categoria: "RR.HH.",
    para: "Administrador",
    minutos: 5,
    pasos: [
      {
        titulo: "Elige el mes",
        texto: "En RR.HH. → Remuneraciones, usa las flechas para elegir el mes. Arriba ves cuánto se paga en total, cuánto falta por pagar y cuánto ya se pagó.",
      },
      {
        titulo: "Arma el mes",
        texto: "Pulsa «Armar el mes». Se crea una liquidación por cada persona activa, con su sueldo base y los descuentos legales de su ficha (AFP, salud y cesantía, o la retención si es honorarios). Si después ingresas a alguien nuevo, usa «Agregar a quienes falten».",
      },
      {
        titulo: "Revisa los días que no se pagan",
        texto: "El sistema busca solo las faltas marcadas en Asistencia, los días de licencia y los permisos sin goce de ese mes. Las vacaciones sí se pagan. Cada día no pagado descuenta el sueldo dividido en 30. Al abrir una liquidación, el botón «Usar N» carga ese número de días.",
        nota: "Puedes cambiar los días a mano si algo no calza.",
      },
      {
        titulo: "Colación y movilización",
        texto: "En la ficha de la persona puedes indicar su colación y movilización mensual. No son imponibles: se suman al líquido sin descontar AFP ni salud. Se cargan solas en cada liquidación, y las puedes cambiar mes a mes.",
      },
      {
        titulo: "Anota las horas extras",
        texto: "En «Horas extras» escribe las del mes. Cada hora vale lo fijado en la ficha de la persona o, si no hay, su hora ordinaria con el 50 % de recargo; el monto se suma a lo que gana y sobre eso se calculan la AFP, la salud y lo demás. Si las anotaste día a día en Asistencia, se cargan solas al armar el mes y aparece el botón «Usar» con el total. Si no, las escribes aquí.",
      },
      {
        titulo: "Mira los días y horas que se pagan",
        texto: "La liquidación muestra «Días pagados» (de 30) y cuánto se descuenta por las ausencias: los días de falta, de licencia y de permiso sin goce, más las horas de permisos sin goce. En «Horas de permiso sin goce» aparece el total del mes y el botón «Usar» para cargarlo; puedes cambiarlo a mano.",
      },
      {
        titulo: "Cambia el valor del día, si hace falta",
        texto: "Junto a los días no pagados está el «Valor del día»: parte con el de la ficha de la persona (o el sueldo dividido en 30) y lo puedes cambiar solo para ese mes. A quien cobra por día, la liquidación muestra sus días trabajados según la asistencia, con el botón «Usar N» para cargarlos.",
      },
      {
        titulo: "Agrega bonos u otros descuentos",
        texto: "Edita la liquidación para sumar bonos o descuentos extra. Los descuentos legales se recalculan solos sobre lo que queda imponible.",
      },
      {
        titulo: "Págala",
        texto: "Pulsa Pagar, elige la fecha y el medio de pago. El líquido sale como egreso en la Caja, con categoría Remuneraciones.",
        nota: "Si te equivocas, «Deshacer pago» también quita el egreso de la Caja. Si el día de la Caja ya está cerrado, primero hay que reabrirlo.",
      },
    ],
  },
  {
    slug: "anticipos-prestamos-personal-apr",
    titulo: "Dar un anticipo o préstamo al personal y descontarlo en cuotas",
    resumen: "Registra lo que el comité adelanta a una persona y sus cuotas se descuentan solas del sueldo.",
    categoria: "RR.HH.",
    para: "Administrador",
    minutos: 3,
    pasos: [
      {
        titulo: "Abre Préstamos",
        texto: "En RR.HH. → Préstamos ves lo que falta por descontar, los que están vigentes y los ya saldados. Está en los planes Estándar y Grande.",
      },
      {
        titulo: "Registra el anticipo o el préstamo",
        texto: "Pulsa «+ Nuevo anticipo o préstamo». Elige a la persona y el tipo: un anticipo se descuenta de una vez; un préstamo, en las cuotas que indiques. Escribe el monto, el mes de la primera cuota y la fecha de entrega.",
      },
      {
        titulo: "Anótalo en la Caja",
        texto: "Deja marcado «Anotar la entrega como egreso en la Caja» si la plata sale ahora del comité. Si ya salió antes de usar Facilapr, desmárcalo.",
      },
      {
        titulo: "Las cuotas se descuentan solas",
        texto: "Al armar cada mes en Remuneraciones, la cuota del mes aparece dentro de «Otros descuentos» de esa persona. Nunca se descuenta más de lo que la persona gana ese mes: lo que no alcance queda para el siguiente.",
        nota: "Si borras una liquidación pendiente, su cuota vuelve al saldo del préstamo.",
      },
      {
        titulo: "Cierra o borra",
        texto: "«Cerrar» deja de descontar lo que falta (por ejemplo, si el comité lo condona); lo ya descontado se mantiene. «Borrar» solo se puede mientras no se haya descontado ninguna cuota, y también quita la entrega de la Caja.",
      },
    ],
  },
  {
    slug: "vacaciones-licencias-permisos-apr",
    titulo: "Gestionar vacaciones, licencias y permisos del personal",
    resumen: "Registra las ausencias en un tablero por estado, con el saldo de vacaciones de cada persona.",
    categoria: "RR.HH.",
    para: "Administrador",
    minutos: 4,
    pasos: [
      {
        titulo: "Abre Vacaciones o Licencias",
        texto: "En RR.HH. hay una pantalla para Vacaciones y otra para Licencias. Cada una es un tablero con tres columnas: Solicitadas, Aprobadas y Rechazadas.",
      },
      {
        titulo: "Mira el saldo",
        texto: "En Vacaciones, arriba ves el saldo de cada persona: se acumulan 1,25 días hábiles por mes trabajado, menos los días ya tomados.",
      },
      {
        titulo: "Registra una solicitud",
        texto: "Pulsa «+ Nuevas vacaciones o permiso» (o «+ Nueva licencia» en Licencias), elige a la persona y las fechas. Los días se cuentan solos, de lunes a viernes y sin los feriados nacionales (el sistema los conoce de 2026 y 2027; los feriados regionales no).",
      },
      {
        titulo: "Apruébala o recházala",
        texto: "Arrastra la tarjeta a Aprobadas o Rechazadas (en el celular, usa el botón de la tarjeta). Solo lo aprobado cuenta en el saldo y en Asistencia.",
      },
      {
        titulo: "Permisos por horas",
        texto: "Al registrar un permiso, en «Duración» elige «Unas horas de un solo día» y escribe cuántas (por ejemplo, 2,5). No gasta días de vacaciones ni marca el día completo como ausente en Asistencia. Si es sin goce, en la liquidación del mes se descuentan esas horas: una jornada son 8 horas, así que cada hora descuenta un octavo del valor del día.",
        nota: "Si el permiso es con goce, no se descuenta nada, sin importar cuántas horas sean.",
      },
      {
        titulo: "Permisos y licencias",
        texto: "Un permiso puede marcarse «sin goce de sueldo»: esos días se descuentan en la liquidación. Los días de licencia médica tampoco los paga el comité.",
        nota: "Las vacaciones aprobadas se pagan completas: no descuentan nada del sueldo.",
      },
    ],
  },
  {
    slug: "asistencia-calendario-apr",
    titulo: "Llevar la asistencia del personal en el calendario",
    resumen: "Marca quién llegó, quién se atrasó y quién faltó en un calendario mensual; las faltas bajan al sueldo.",
    categoria: "RR.HH.",
    para: "Administrador",
    minutos: 3,
    pasos: [
      {
        titulo: "Abre Asistencia",
        texto: "En RR.HH. → Asistencia ves el mes completo en un calendario. Cada día muestra con un punto de color quién tuvo algo. Las flechas cambian de mes y «Hoy» vuelve al día actual.",
      },
      {
        titulo: "Elige un día",
        texto: "Toca un día del calendario. A la derecha aparece cada persona con los botones Presente, Atraso, Ausente y Permiso.",
      },
      {
        titulo: "Marca a cada persona",
        texto: "Pulsa el botón que corresponda. Se guarda al tiro. Las vacaciones y licencias aprobadas aparecen solas, sin botones.",
      },
      {
        titulo: "Anota las horas extras del día",
        texto: "Bajo los botones de cada persona está «Horas extras»: escribe cuántas hizo ese día (por ejemplo, 2,5) y se guardan al salir del campo. Al armar el mes en Remuneraciones se suman solas y se pagan con el valor de la hora extra de su ficha.",
      },
      {
        titulo: "Las faltas llegan al sueldo",
        texto: "Los días marcados como Ausente se descuentan al armar la liquidación del mes en Remuneraciones. Los atrasos y los permisos con goce no descuentan.",
      },
    ],
  },
  {
    slug: "incidentes-sistema-agua-apr",
    titulo: "Registrar incidentes del sistema de agua y lo que costó repararlos",
    resumen: "Anota fugas, fallas y cortes en un tablero por estado, con su costo de reparación.",
    categoria: "Operación",
    para: "Administrador",
    minutos: 3,
    pasos: [
      {
        titulo: "Abre Incidentes",
        texto: "En el grupo Operación del menú, entra a Incidentes. Es un tablero con tres columnas: Abiertos, En reparación y Resueltos. Está en los planes Estándar y Grande.",
      },
      {
        titulo: "Registra lo que pasó",
        texto: "Pulsa Nuevo incidente. Escribe qué pasó, elige el tipo (fuga, falla de bomba, agua turbia, sin agua, corte de luz), el lugar y la prioridad.",
      },
      {
        titulo: "Muévelo mientras avanza",
        texto: "Arrastra la tarjeta de una columna a otra, o usa el botón de la tarjeta en el celular. Al pasarla a Resuelto se anota la fecha.",
      },
      {
        titulo: "Anota cuánto costó",
        texto: "Al editarlo, escribe el costo de la reparación y la solución. Si marcas «registrar el costo en Caja», queda como egreso con categoría Reparaciones.",
        nota: "Si después cambias el costo, el egreso de la Caja se ajusta solo.",
      },
    ],
  },
  {
    slug: "activos-fijos-valor-actual-apr",
    titulo: "Llevar los activos fijos del comité y su valor actual",
    resumen: "Registra la bomba, el estanque, el terreno y demás bienes, y ve cuánto valen hoy.",
    categoria: "Operación",
    para: "Administrador",
    minutos: 3,
    pasos: [
      {
        titulo: "Abre Activos fijos",
        texto: "En Operación → Activos fijos ves los bienes del comité con su costo y su valor actual. Está en los planes Estándar y Grande.",
      },
      {
        titulo: "Registra un bien",
        texto: "Pulsa «+ Nuevo bien». Escribe el nombre, la categoría (bomba, estanque, captación, red, terreno, vehículo…), la fecha de compra y el costo.",
      },
      {
        titulo: "Revisa la vida útil",
        texto: "Al elegir la categoría se propone una vida útil típica en años, y puedes cambiarla. Con 0 años el bien no se deprecia, como un terreno.",
      },
      {
        titulo: "Mira cuánto vale hoy",
        texto: "El valor actual baja parejo cada mes hasta cumplir la vida útil. Es una referencia para el comité, no una contabilidad tributaria.",
      },
      {
        titulo: "Anota el costo en la Caja, si corresponde",
        texto: "Marca «Anotar el costo como egreso en la Caja» solo si lo compraste con plata del comité y aún no lo registras. En un bien antiguo, déjalo sin marcar.",
        nota: "Cuando un bien deja de estar, márcalo como dado de baja en vez de borrarlo.",
      },
    ],
  },
  {
    slug: "labores-materiales-inventario-apr",
    titulo: "Registrar labores y descontar los materiales del inventario",
    resumen: "Anota los trabajos del comité y los materiales que usan: se descuentan solos al marcarlos hechos.",
    categoria: "Operación",
    para: "Administrador",
    minutos: 4,
    pasos: [
      {
        titulo: "Abre Labores",
        texto: "En Operación → Labores ves un tablero con Programadas, En curso y Hechas. Está en los planes Estándar y Grande, junto con el Inventario.",
      },
      {
        titulo: "Crea la labor",
        texto: "Pulsa Nueva labor. Escribe qué se hace (por ejemplo, cambio de medidores del sector norte), elige el tipo, la fecha, el lugar y quién es el responsable.",
      },
      {
        titulo: "Agrega los materiales",
        texto: "En «Materiales del inventario» pulsa Agregar material, elige el material y la cantidad. Junto a cada uno ves cuánto stock hay.",
      },
      {
        titulo: "Programa su hora y que avance sola",
        texto: "Ponle una «Hora de inicio» y, si quieres, cuándo «Termina». Cuando llega la hora de inicio, la labor pasa sola a En curso; y cuando llega la hora de término, pasa sola a Hecha y descuenta los materiales. Para posponerla, cámbiale la fecha u hora (no se puede devolver a Programada si su hora ya pasó).",
        nota: "El cambio se aplica cuando alguien abre Labores o Inventario, no justo a la hora. Si al terminar no alcanza el stock de un material, la labor queda En curso con el aviso «Ya debía terminar».",
      },
      {
        titulo: "Márcala como hecha",
        texto: "Cuando el trabajo termine, arrastra la tarjeta a Hechas. En ese momento los materiales se descuentan del inventario, y en el historial del material queda «Usado en una labor» con el número de la labor.",
        nota: "Si no alcanza el stock de algún material, no te deja marcarla como hecha y te dice cuál falta. Nada se descuenta a medias.",
      },
      {
        titulo: "Si te equivocas",
        texto: "Si sacas la labor de Hechas o la borras, los materiales vuelven al inventario. Si cambias los materiales de una labor ya hecha, primero se devuelve lo anterior y luego se descuenta lo nuevo.",
      },
    ],
  },
  {
    slug: "que-plan-elegir-apr",
    titulo: "Qué plan elegir para tu APR: Pequeño, Estándar o Grande",
    tituloSeo: "Qué plan elegir para tu APR: Pequeño, Estándar o Grande",
    resumen:
      "Qué incluye cada plan de Facilapr, cuántos socios y operadores admite, cuánto cuesta y cuál le conviene a tu comité.",
    categoria: "Tu plan",
    para: "Administrador",
    minutos: 3,
    pasos: [
      {
        titulo: "Cuenta cuántos socios y operadores tienes",
        texto:
          "El tamaño del comité define el plan. Cuenta los arranques con servicio, no a las personas, porque quien tiene dos medidores ocupa dos cuentas. Y piensa cuántas personas toman lecturas en terreno.",
      },
      {
        titulo: "Pequeño: hasta 200 socios",
        texto:
          "Para comités que parten o son chicos. Incluye 1 operador, boletas, lecturas, pagos con comprobante, cortes y la cuenta en línea de cada socio. No incluye finanzas, chat ni asistente de IA. Cuesta 0,7 UF al mes más IVA.",
      },
      {
        titulo: "Estándar: hasta 800 socios",
        texto:
          "Para comités medianos. Suma hasta 3 operadores, las finanzas del comité (Caja, Compras, Inventario y Reportes), el chat en tiempo real con los socios y el asistente de IA, que incluye 3 millones de tokens al mes (unas 1.500 respuestas). Si se acaban, puedes sumar packs de 2 millones. Cuesta 1,5 UF al mes más IVA.",
      },
      {
        titulo: "Grande: sin tope de socios",
        texto:
          "Para comités muy grandes o con varias sedes. El precio es a medida y parte desde 6 UF al mes más IVA, según tus socios y sedes.",
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
  {
    slug: "reclamos-solicitudes-socios-apr",
    titulo: "Reclamos y solicitudes de los socios en un APR: cómo recibirlos y resolverlos",
    tituloSeo: "Reclamos y solicitudes de socios en un APR",
    resumen:
      "Los socios piden reparaciones, reposiciones, bajas o presentan reclamos desde su cuenta. Así se reciben, se responden y quedan registrados.",
    categoria: "Portal de socios",
    para: "Administrador",
    minutos: 4,
    pasos: [
      {
        titulo: "El socio lo pide desde su cuenta",
        texto:
          "Desde su portal, el socio puede presentar un reclamo o pedir una reparación, la reposición del servicio, la baja o la reanudación del servicio. No necesita llamar ni ir a la oficina.",
        nota: "Para que lo haga, necesita tener acceso a su cuenta. Mira la guía «Cómo dar a tus socios acceso a su cuenta en línea».",
      },
      {
        titulo: "Mira lo que llegó en Cortes → Solicitudes",
        texto:
          "En el menú Cortes entra a la pestaña Solicitudes. Cada pedido muestra quién lo hizo, de qué tipo es y cuándo. El menú muestra un número rojo cuando hay algo esperando respuesta.",
      },
      {
        titulo: "Responde un reclamo",
        texto:
          "Pulsa Responder y escribe la respuesta: en un reclamo es obligatoria. El socio la ve en su portal, y puedes avisarle por WhatsApp con el botón Avisar respuesta.",
      },
      {
        titulo: "Aprueba o rechaza una reparación o una reposición",
        texto:
          "Pulsa Aprobar y el pedido pasa a En trámite: alguien tiene que ir a terreno. El operador sube la foto del trabajo y queda Por dar de alta, donde tú la confirmas. Si no corresponde, pulsa Rechazar y puedes explicarle el motivo.",
      },
      {
        titulo: "Da de baja o reanuda el servicio",
        texto:
          "Una baja se resuelve con Dar de baja, y una reanudación con Reanudar. Si el socio tiene deuda, el sistema te pide confirmarlo antes de dar de baja.",
      },
      {
        titulo: "Todo queda registrado",
        texto:
          "En la pestaña Historial queda cada solicitud con su estado y su respuesta, para revisarla cuando haga falta.",
      },
    ],
  },
  {
    slug: "cobrar-agua-apr-sin-excel",
    titulo: "Cobrar el agua en un APR sin planillas de Excel: el proceso completo",
    tituloSeo: "Cobrar el agua en un APR sin planillas de Excel",
    resumen:
      "Del padrón a la boleta y al pago: los pasos para cobrar el agua de tu comité cada mes sin llevar todo en planillas.",
    categoria: "Primeros pasos",
    para: "Administrador",
    minutos: 6,
    pasos: [
      {
        titulo: "Carga tus socios una sola vez",
        texto:
          "En Socios, usa Importar para subir tu planilla actual con el nombre, RUT, número de arranque, dirección y teléfono. Antes de guardar, el sistema te muestra cómo entendió cada fila para que corrijas lo que haga falta.",
        nota: "El RUT y el teléfono se pueden completar después. Más detalle en «Planilla en Excel para cobrar el agua rural».",
      },
      {
        titulo: "Define tus tarifas",
        texto:
          "En Configuración → Facturación pones el cargo fijo y el valor del metro cúbico. Con eso el sistema calcula cada boleta; ya no haces la cuenta a mano.",
      },
      {
        titulo: "Carga la lectura de partida",
        texto:
          "Cada medidor necesita una primera lectura, sin boleta, para poder calcular el consumo del mes siguiente. Se carga como lectura inicial.",
      },
      {
        titulo: "Toma las lecturas cada mes",
        texto:
          "El operador las anota desde el celular con Modo terreno, incluso sin señal, o las subes desde una planilla. El consumo sale de restar la lectura anterior.",
      },
      {
        titulo: "Revisa, aprueba y genera las boletas",
        texto:
          "En Lecturas revisas los consumos que se ven raros y apruebas. Con Aprobar y generar boletas, las que están listas se convierten en boletas con su monto ya calculado.",
      },
      {
        titulo: "Envía los recibos",
        texto:
          "En Boletas, Enviar por WhatsApp te lista a los socios con teléfono y abre cada chat con el mensaje y el recibo en PDF ya escritos. Solo tocas enviar. A quien no tiene teléfono le entregas el recibo impreso.",
      },
      {
        titulo: "Anota los pagos",
        texto:
          "Cuando un socio paga, entra a Pagos → Registrar pago: puede pagar todo o abonar una parte, en efectivo, transferencia o Caja Vecina. Se genera un comprobante que le puedes mandar.",
      },
      {
        titulo: "Mira quién está al día",
        texto:
          "En Pagos ves cuánto recaudaste y cuántos socios están al día o morosos. En Cortes ves quiénes llevan más tiempo sin pagar y puedes avisarles antes de cortar.",
      },
    ],
  },
  {
    slug: "como-pagar-cuenta-agua-potable-rural-apr",
    titulo: "Cómo pagar la cuenta del agua potable rural (APR): formas de pago",
    tituloSeo: "Cómo pagar tu cuenta del agua potable rural (APR)",
    resumen:
      "Si eres socio de un APR y quieres pagar tu boleta: qué revisar, cómo averiguar cómo paga tu comité y cómo asegurarte de que tu pago quede registrado.",
    categoria: "Portal de socios",
    para: "Todos",
    minutos: 3,
    pasos: [
      {
        titulo: "Revisa tu boleta o recibo",
        texto:
          "Mira el monto a pagar, la fecha de vencimiento y tu número de cliente o de arranque. Muchos comités anotan en la misma boleta cómo y dónde pagar.",
      },
      {
        titulo: "Averigua cómo paga tu comité",
        texto:
          "Cada APR define sus propias formas de pago: en efectivo con el tesorero o en la sede, por transferencia, en Caja Vecina u otro medio. Si tu boleta no lo dice, pregúntaselo a la directiva de tu comité por teléfono o por WhatsApp.",
        nota: "Tu pago va siempre al comité de tu sector. Facilapr es un sistema que usan algunos comités para administrar sus boletas, pero no recibe los pagos de los socios.",
      },
      {
        titulo: "Paga y guarda el comprobante",
        texto:
          "Sea cual sea el medio, guarda la prueba de tu pago: el voucher, la captura de la transferencia o el comprobante de la caja. Es tu respaldo si hay alguna duda.",
      },
      {
        titulo: "Avisa a tu comité si hace falta",
        texto:
          "Si pagaste por transferencia o en una caja, muchos comités piden que les envíes el comprobante, con tu nombre y tu número de arranque, para anotar el pago. Pregunta a quién y por dónde mandarlo.",
      },
      {
        titulo: "Comprueba que quedó registrado",
        texto:
          "En tu próxima boleta debería verse tu pago. Si el comité usa un sistema con cuenta en línea para los socios, como Facilapr, también puedes ver tus boletas, tus pagos y tus comprobantes ahí, con tu RUT y tu clave.",
      },
      {
        titulo: "Si tu comité aún no tiene cuenta en línea",
        texto:
          "Puedes proponerle a tu directiva que revise un sistema para administrar las boletas y los pagos. Con una cuenta en línea, cada socio ve cuánto debe y su comprobante sin llamar ni ir a la sede.",
      },
    ],
  },
  {
    slug: "software-para-apr",
    titulo: "Software para APR: qué es, qué hace y cuánto cuesta",
    tituloSeo: "Software para APR: qué hace, qué debe incluir y precios",
    resumen:
      "Qué es un software para comités de agua potable rural (APR/SSR), qué resuelve frente a la planilla de Excel, qué debe incluir y cuánto suele costar.",
    categoria: "Primeros pasos",
    para: "Administrador",
    minutos: 5,
    pasos: [
      {
        titulo: "Qué es un software para APR",
        texto:
          "Es un programa en línea que reemplaza el cuaderno y las planillas con las que un comité de agua potable rural lleva sus cuentas: el padrón de socios, las lecturas de los medidores, las boletas, los pagos y los cortes. Se usa desde el computador y el celular, sin instalar nada.",
      },
      {
        titulo: "Qué problemas resuelve",
        texto:
          "Evita calcular cada boleta a mano, perder el rastro de quién pagó, pelear por una lectura mal anotada y depender de una sola persona que sabe cómo funciona la planilla. Todo queda ordenado y a la vista de la directiva.",
      },
      {
        titulo: "Cuándo basta una planilla y cuándo no",
        texto:
          "Con pocos socios y una sola persona a cargo, una planilla bien hecha puede alcanzar. Cuando el comité pasa de unas decenas de arranques, hay más de una persona tomando lecturas, o los socios piden saber cuánto deben, la planilla empieza a fallar.",
        nota: "Si quieres partir con una, en Facilapr tienes una planilla gratis en Excel: facilapr.cl/planilla-cobro-agua-potable-rural.",
      },
      {
        titulo: "Qué debe incluir",
        texto:
          "Como mínimo: padrón de socios con importación desde Excel, lecturas desde el celular (también en terreno sin señal), boletas calculadas con tu tarifa, pagos y abonos con comprobante, control de morosidad y cortes, y una cuenta en línea para que cada socio vea su deuda.",
      },
      {
        titulo: "Qué más conviene mirar",
        texto:
          "Que ordene las solicitudes de los socios (reclamos, reparaciones, reposiciones), que permita roles distintos para la directiva y los operadores, y que se pueda dejar sin contrato de permanencia. Tus datos son del comité: pregunta si puedes exportarlos.",
      },
      {
        titulo: "Cuánto cuesta",
        texto:
          "Los softwares para APR se cobran como una suscripción mensual, que suele depender del número de socios. En Facilapr el plan Pequeño, hasta 200 socios, cuesta 0,7 UF al mes más IVA, y el Estándar, hasta 800 socios, 1,5 UF al mes más IVA. No hay permanencia mínima.",
      },
      {
        titulo: "Cómo probarlo antes de decidir",
        texto:
          "Crea la cuenta, carga unos cuantos socios y registra una lectura y un pago de ejemplo. Si te sirve para tu mes de cobro real, lo mantienes. Si no, lo dejas sin multa. Crear la cuenta de tu comité en Facilapr toma un par de minutos en facilapr.cl/registro.",
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
