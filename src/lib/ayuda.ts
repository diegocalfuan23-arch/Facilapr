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
  | "Equipo";

export type Articulo = {
  slug: string;
  titulo: string;
  resumen: string;
  categoria: Categoria;
  /** Quién necesita este artículo. */
  para: "Administrador" | "Técnico" | "Todos";
  /** Minutos aproximados que toma hacerlo. */
  minutos: number;
  pasos: Paso[];
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
        nota: "La tarifa es única para todo el comité: se aplica a socios y usuarios por igual.",
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
      "Si un socio olvidó su clave, le pones una nueva desde el panel y se la entregas.",
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
          "Solo está disponible para quien ya tiene cuenta en el portal. Si dice «Sin cuenta en el portal», todavía no ha pedido acceso.",
      },
      {
        titulo: "Revisa la clave nueva",
        texto:
          "Se propone una clave fácil de leer. Puedes generar otra con el botón de flechas, o escribir la que quieras (mínimo 8 caracteres).",
      },
      {
        titulo: "Guarda y entrégasela",
        texto:
          "Pulsa Guardar clave, cópiala y dásela al socio por teléfono, WhatsApp o en persona. Entra con su RUT.",
        nota: "La clave se muestra una sola vez, y se cierran las sesiones que tuviera abiertas.",
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
        texto: "Escribe el nombre y el correo de la persona.",
      },
      {
        titulo: "Comparte el enlace",
        texto:
          "Copia el enlace de invitación y envíaselo (por WhatsApp, por ejemplo). Con ese enlace la persona crea su propia contraseña.",
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
