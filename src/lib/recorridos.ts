/**
 * Recorridos guiados del panel. Cada uno se muestra sobre la propia pantalla:
 * oscurece el resto y resalta, de a una, las partes que explica.
 *
 * Los pasos apuntan a elementos con data-tour="..." (o a un id), ver los
 * componentes del panel. Si un elemento no está en pantalla (por ejemplo el
 * menú en el celular), ese paso se omite solo.
 */

export type PasoRecorrido = {
  /** Selector CSS del elemento a resaltar. Sin selector, el paso va al centro. */
  selector?: string;
  /**
   * Selector de algo que hay que pulsar antes de mostrar el paso (por ejemplo
   * una pestaña), para que el elemento exista. Se hace solo, también al volver.
   */
  clic?: string;
  titulo: string;
  texto: string;
  lado?: "right" | "bottom" | "top" | "left";
};

export type Recorrido = {
  id: string;
  /** Pantalla donde ocurre. Si se pide desde otra, se navega primero. */
  ruta: string;
  titulo: string;
  resumen: string;
  minutos: number;
  pasos: PasoRecorrido[];
};

const enMenu = (ruta: string) => `[data-tour="${ruta}"]`;

export const RECORRIDOS: Recorrido[] = [
  {
    id: "resumen",
    ruta: "/panel",
    titulo: "Conoce el panel",
    resumen: "Un resumen de cada sección del menú, en el orden en que conviene usarlas.",
    minutos: 1,
    pasos: [
      {
        titulo: "Bienvenido a Facilapr 👋",
        texto:
          "Te mostramos para qué sirve cada sección. Es rápido: una frase por cada una.",
      },
      {
        selector: '[data-tour="primeros-pasos"]',
        titulo: "Tu avance y tu ayuda",
        texto:
          "Este botón te acompaña en todas las pantallas: muestra los pasos que te faltan y te vuelve a explicar el menú cuando quieras.",
        lado: "left",
      },
      {
        selector: enMenu("/panel/configuracion"),
        titulo: "Configuración",
        texto: "Tus tarifas y los datos de tu comité. Empieza por aquí.",
      },
      {
        selector: enMenu("/panel"),
        titulo: "Resumen",
        texto: "La vista general: cuántos socios tienes, cuánto se ha cobrado y quién debe.",
      },
      {
        selector: enMenu("/panel/socios"),
        titulo: "Socios",
        texto: "Tu padrón de socios y usuarios.",
      },
      {
        selector: enMenu("/panel/boletas"),
        titulo: "Boletas",
        texto: "Emitir boletas y enviar el recibo en PDF por WhatsApp.",
      },
      {
        selector: enMenu("/panel/pagos"),
        titulo: "Pagos",
        texto:
          "Registra lo que paga cada socio, con su comprobante: boletas, reposiciones y otros cobros. Ves quién está al día y quién es moroso.",
      },
      {
        selector: enMenu("/panel/lecturas"),
        titulo: "Lecturas",
        texto: "Las lecturas de los medidores, para revisar y aprobar.",
      },
      {
        selector: enMenu("/panel/lecturas/terreno"),
        titulo: "Modo terreno",
        texto: "Tomar lecturas desde el celular, incluso sin señal.",
      },
      {
        selector: enMenu("/panel/tecnicos"),
        titulo: "Técnicos",
        texto: "Quienes toman las lecturas en terreno.",
      },
      {
        selector: enMenu("/panel/conversaciones"),
        titulo: "Conversaciones",
        texto: "El chat con tus socios: te escriben desde su cuenta en línea y les respondes aquí.",
      },
      {
        selector: enMenu("/panel/socios/solicitudes"),
        titulo: "Solicitudes",
        texto: "Los socios que piden entrar a su cuenta en línea, o una clave nueva porque no pueden entrar.",
      },
      {
        selector: enMenu("/panel/cortes"),
        titulo: "Cortes",
        texto:
          "Los socios morosos, el aviso antes de cortar, los cortes y reposiciones con foto, los reclamos y pedidos de los socios, y los acuerdos de pago en cuotas.",
      },
      {
        selector: enMenu("/panel/ayuda"),
        titulo: "Ayuda",
        texto: "Los recorridos de cada pantalla, para repetirlos cuando quieras.",
      },
      {
        titulo: "Listo 🎉",
        texto:
          "En cada pantalla verás un botón «?» junto a este: púlsalo y te explica, parte por parte, qué muestra esa pantalla.",
      },
    ],
  },
  {
    id: "configuracion",
    ruta: "/panel/configuracion",
    titulo: "Configura tu comité y tus tarifas",
    resumen:
      "Tus datos, tu enlace, las tarifas y cómo se paga: lo que sale en cada boleta y recibo.",
    minutos: 2,
    pasos: [
      {
        selector: enMenu("cfg-nav"),
        titulo: "Cada tema, en su sección",
        texto:
          "La configuración está dividida por temas. Te mostramos los que necesitas para empezar: Comité y Facturación.",
        lado: "right",
      },
      {
        clic: enMenu("cfg-comite"),
        selector: enMenu("cfg-datos"),
        titulo: "Los datos de tu comité",
        texto:
          "Nombre, RUT, teléfono, dirección y correo. Aparecen en las boletas y en el recibo en PDF, así que conviene que estén al día. Cada bloque se guarda con su propio botón «Guardar».",
        lado: "top",
      },
      {
        clic: enMenu("cfg-comite"),
        selector: enMenu("cfg-enlace"),
        titulo: "Tu enlace en Facilapr",
        texto:
          "Es el nombre que va en el enlace de tu portal de socios (facilapr.cl/tu-nombre/cuenta). No es tu domicilio ni tu página web. Si lo cambias, los enlaces anteriores dejan de funcionar.",
        lado: "top",
      },
      {
        clic: enMenu("cfg-facturacion"),
        selector: "#tarifaCargoFijo",
        titulo: "Cargo fijo",
        texto:
          "Lo que paga cada arranque todos los meses, aunque no consuma agua. Por ejemplo, $3.000.",
        lado: "bottom",
      },
      {
        clic: enMenu("cfg-facturacion"),
        selector: "#tarifaMetroCubico",
        titulo: "Valor por m³",
        texto:
          "Se multiplica por el consumo del mes y se suma al cargo fijo. Con $3.000 de cargo fijo y $500 por m³, quien consumió 18 m³ paga $3.000 + 18 × $500 = $12.000.",
        lado: "bottom",
      },
      {
        clic: enMenu("cfg-facturacion"),
        selector: "#diaGeneracionBoletas",
        titulo: "Cuándo se emiten y cuánto tiempo hay para pagar",
        texto:
          "El día del mes en que se generan las boletas (del 1 al 28) y, al lado, cuántos días tiene el socio para pagar desde la emisión.",
        lado: "bottom",
      },
      {
        clic: enMenu("cfg-facturacion"),
        selector: "#infoPago",
        titulo: "Cómo y dónde pagar",
        texto:
          "Escribe el banco, el tipo y número de cuenta, a nombre de quién, y si también reciben efectivo en la oficina. Sale en cada recibo en PDF y en el mensaje de WhatsApp.",
        lado: "top",
      },
      {
        titulo: "Listo ✅",
        texto:
          "Recuerda pulsar «Guardar» en cada bloque que cambies. Con esto tu comité ya puede emitir boletas.",
      },
    ],
  },
  {
    id: "socios",
    ruta: "/panel/socios",
    titulo: "Carga y administra tus socios",
    resumen:
      "Importar el padrón, buscar, filtrar entre socios y usuarios, y qué se puede hacer con cada uno.",
    minutos: 2,
    pasos: [
      {
        selector: enMenu("socios-invitar"),
        titulo: "Invitar al portal",
        texto:
          "Manda por WhatsApp un enlace personal a cada socio con teléfono: abre su invitación, elige su clave y ya ve su cuenta, sus boletas y sus recibos. Sin pedir acceso ni esperar aprobación.",
        lado: "bottom",
      },
      {
        selector: enMenu("socios-importar"),
        titulo: "Importar tu padrón",
        texto:
          "Sube tu planilla (Excel, CSV o un PDF con texto) y se cargan todos de una vez. Antes de guardar te muestra una vista previa y marca las filas con problemas para que las corrijas.",
        lado: "bottom",
      },
      {
        selector: enMenu("socios-nuevo"),
        titulo: "Agregar uno a uno",
        texto:
          "Cada fila es un arranque con su medidor. Si una persona tiene dos medidores, repite su RUT en los dos: entrará una sola vez a su cuenta y verá las boletas de ambos.",
        lado: "bottom",
      },
      {
        selector: enMenu("socios-kpis"),
        titulo: "De un vistazo",
        texto:
          "Cuántos arranques tienes en total y cuántos están activos, y cuántos tienen teléfono o les falta la dirección. Sirven para ver qué datos te faltan por completar.",
        lado: "bottom",
      },
      {
        selector: enMenu("socios-buscar"),
        titulo: "Buscar",
        texto: "Encuentra a alguien por su nombre, su RUT o su teléfono.",
        lado: "bottom",
      },
      {
        selector: enMenu("socios-filtros"),
        titulo: "Filtros",
        texto:
          "Separa a los socios de los usuarios (quienes pagan pero no son miembros), o muestra solo los que no tienen teléfono, dirección o número de cliente.",
        lado: "bottom",
      },
      {
        selector: enMenu("socios-exportar"),
        titulo: "Importar y exportar",
        texto:
          "Desde aquí también importas, y exportas a CSV lo que estás viendo: con los filtros activos, se exporta solo eso.",
        lado: "bottom",
      },
      {
        selector: '[data-tour="socios-tabla"] tbody tr:first-child',
        titulo: "Tu padrón",
        texto:
          "Cada fila es un arranque con su medidor: el nombre y número, el RUT, el estado, el teléfono y la dirección. Marca varias casillas para desactivarlas o eliminarlas de una vez.",
        lado: "bottom",
      },
      {
        selector: '[aria-label^="Acciones para"]',
        titulo: "Qué puedes hacer con cada uno",
        texto:
          "Editar sus datos, invitarlo al portal, mandarle un enlace para elegir una clave nueva (si olvidó la suya, sin que tú la veas) o eliminarlo.",
        lado: "left",
      },
    ],
  },
  {
    id: "lecturas",
    ruta: "/panel/lecturas",
    titulo: "Lecturas de los medidores",
    resumen:
      "Cómo se cargan, se revisan y se aprueban las lecturas, y por qué solo las aprobadas generan boleta.",
    minutos: 2,
    pasos: [
      {
        selector: enMenu("lec-tecnicos"),
        titulo: "Técnicos",
        texto:
          "Quienes toman las lecturas en terreno. Desde aquí los invitas o ves quiénes tienen acceso: solo ven lecturas, nada más.",
        lado: "bottom",
      },
      {
        selector: enMenu("lec-terreno"),
        titulo: "Modo terreno",
        texto:
          "Para quien recorre los medidores con el celular: funciona incluso sin señal y envía las lecturas solas cuando vuelve la conexión.",
        lado: "bottom",
      },
      {
        selector: enMenu("lec-archivo"),
        titulo: "Cargar desde un archivo",
        texto:
          "Sube lecturas desde Excel. Sirve también para cargar de una vez las lecturas iniciales de todos los medidores.",
        lado: "bottom",
      },
      {
        selector: enMenu("lec-nueva"),
        titulo: "Nueva lectura",
        texto:
          "Registra una lectura a mano. La primera de cada medidor se marca como «Lectura inicial»: queda aprobada y no genera cobro, solo sirve de punto de partida.",
        lado: "bottom",
      },
      {
        selector: enMenu("lec-kpis"),
        titulo: "De un vistazo",
        texto:
          "Cuántas lecturas esperan tu revisión, cuántas ya están aprobadas y cuántas rechazaste.",
        lado: "bottom",
      },
      {
        selector: enMenu("lec-pestanas"),
        titulo: "Estados",
        texto:
          "Pendientes de tu revisión, aprobadas y rechazadas. El consumo es la lectura actual menos la última aprobada.",
        lado: "bottom",
      },
      {
        selector: '[data-tour="lec-tabla"] tbody tr:first-child',
        titulo: "Revisa y aprueba",
        texto:
          "Revisa que el consumo se vea razonable (un número muy alto o negativo es señal de error). Puedes corregir o eliminar una lectura mal digitada, y aprobar. Al aprobar se calcula la boleta.",
        lado: "top",
      },
    ],
  },
  {
    id: "boletas",
    ruta: "/panel/boletas",
    titulo: "Boletas, recibos y pagos",
    resumen:
      "Emitir una boleta, mandar el recibo en PDF por WhatsApp y registrar el pago.",
    minutos: 3,
    pasos: [
      {
        selector: enMenu("bol-nueva"),
        titulo: "Nueva boleta",
        texto:
          "Elige la cuenta con el buscador (por nombre, número de cliente o RUT) y Facilapr toma la última lectura aprobada y tus tarifas. Si el consumo sale en 0 m³, falta aprobar la lectura.",
        lado: "bottom",
      },
      {
        selector: enMenu("bol-whatsapp"),
        titulo: "Enviar por WhatsApp",
        texto:
          "Edita el mensaje una vez y se usa para todos: cada socio recibe el suyo, con un enlace a su recibo en PDF. Se abre WhatsApp con el chat ya elegido y solo falta enviar.",
        lado: "bottom",
      },
      {
        selector: enMenu("bol-imprimir"),
        titulo: "Imprimir recibos",
        texto:
          "Una hoja con los recibos del período para imprimir, por si entregas en papel.",
        lado: "bottom",
      },
      {
        selector: enMenu("bol-importar"),
        titulo: "Importar boletas",
        texto:
          "Si ya tienes las boletas en una planilla, súbelas en CSV en vez de crearlas una a una.",
        lado: "bottom",
      },
      {
        selector: enMenu("bol-kpis"),
        titulo: "De un vistazo",
        texto:
          "Cuántas boletas hay, cuánto falta por cobrar, cuánto ya cobraste y cuántas están vencidas.",
        lado: "bottom",
      },
      {
        selector: enMenu("bol-pestanas"),
        titulo: "Estados",
        texto:
          "Pendientes, vencidas y pagadas. Úsalas para ver quién te debe.",
        lado: "bottom",
      },
      {
        selector: '[data-tour="bol-tabla"] tbody tr:first-child',
        titulo: "Tus boletas",
        texto:
          "Cada fila es una boleta: el socio, el período, el consumo, el monto, lo pagado y el vencimiento. Si alguien abonó una parte, verás cuánto falta.",
        lado: "bottom",
      },
      {
        selector: '[aria-label^="Acciones para la boleta"]',
        titulo: "Acciones de cada boleta",
        texto:
          "Ver el recibo, descargarlo en PDF, enviarlo por WhatsApp, registrar un pago (el monto acumulado, o «Pagó el total»), editarla o anularla.",
        lado: "left",
      },
    ],
  },
  {
    id: "tecnicos",
    ruta: "/panel/tecnicos",
    titulo: "Invita a quien toma las lecturas",
    resumen: "Dale acceso solo a lecturas, desde su celular.",
    minutos: 1,
    pasos: [
      {
        selector: enMenu("tec-invitar"),
        titulo: "Invitar técnico",
        texto:
          "Escribe su nombre y copia el enlace de invitación para enviárselo (por WhatsApp, por ejemplo). Con ese enlace crea su propia contraseña.",
        lado: "bottom",
      },
      {
        selector: enMenu("tec-tabla"),
        titulo: "Tus técnicos",
        texto:
          "Quienes ya aceptaron y pueden entrar. Si alguien deja de trabajar con el comité, lo desactivas: pierde el acceso al instante y sus lecturas se conservan. Puedes reactivarlo cuando quieras.",
        lado: "top",
      },
      {
        selector: enMenu("tec-invitaciones"),
        titulo: "Invitaciones pendientes",
        texto:
          "Los enlaces que ya generaste y nadie ha usado. Vencen solos, y puedes cancelar uno si lo mandaste a la persona equivocada.",
        lado: "top",
      },
      {
        titulo: "Qué ve el técnico",
        texto:
          "Solo la sección de lecturas: no accede a socios, boletas ni configuración. Tú apruebas cada lectura antes de que cuente. Si deja de trabajar con el comité, lo desactivas desde esta misma pantalla.",
      },
    ],
  },
  {
    id: "solicitudes",
    ruta: "/panel/socios/solicitudes",
    titulo: "Accesos al portal de socios",
    resumen:
      "Cómo aprobar a un socio que pide entrar a su cuenta en línea.",
    minutos: 1,
    pasos: [
      {
        selector: enMenu("sol-tabla"),
        titulo: "Solicitudes de acceso",
        texto:
          "Cada socio que pide entrar con su RUT y una clave aparece aquí, con su estado. Las pendientes van primero.",
        lado: "top",
      },
      {
        selector: enMenu("sol-acciones"),
        titulo: "Aprobar, rechazar o eliminar",
        texto:
          "Aprueba solo si reconoces el RUT como parte del comité. Puedes rechazar con un motivo, o eliminar el registro. Al aprobar, el socio ya puede entrar con su RUT y su clave.",
        lado: "left",
      },
    ],
  },
];

export const RECORRIDOS_NUEVOS: Recorrido[] = [
  {
    id: "pagos",
    ruta: "/panel/pagos",
    titulo: "Registra los pagos de tus socios",
    resumen: "Cómo anotar un pago o abono y mandarle el comprobante.",
    minutos: 1,
    pasos: [
      {
        selector: enMenu("pag-registrar"),
        titulo: "Registrar pago",
        texto:
          "Busca al socio, elige la boleta que está pagando, anota cuánto pagó, cómo (efectivo, transferencia, Caja Vecina) y la fecha. Puede ser un abono: la boleta sigue debiendo lo que falta.",
        lado: "bottom",
      },
      {
        titulo: "El comprobante",
        texto:
          "Al guardar, se genera un comprobante en PDF y puedes mandárselo al socio por WhatsApp con el mensaje ya escrito. El socio también lo ve en su cuenta.",
      },
      {
        selector: enMenu("pag-lista"),
        titulo: "Todo lo que han pagado",
        texto:
          "El historial de pagos del comité, con búsqueda y filtro por medio de pago. Si anotaste uno por error, se elimina desde la boleta y la deuda vuelve a su lugar.",
        lado: "top",
      },
    ],
  },
  {
    id: "cortes",
    ruta: "/panel/cortes",
    titulo: "Cortes por morosidad y órdenes de terreno",
    resumen: "Del aviso al corte, la foto de respaldo y la reposición.",
    minutos: 2,
    pasos: [
      {
        selector: enMenu("cor-pestanas"),
        titulo: "El camino de cada orden",
        texto:
          "Morosos: quienes pasaron los días de gracia. En trámite: lo que alguien tiene que ir a hacer. Por dar de alta: ya hay foto y falta tu revisión. Solicitudes: lo que piden tus socios o el técnico. Cortados: quiénes tienen el servicio cortado ahora.",
        lado: "bottom",
      },
      {
        titulo: "Cómo se corta",
        texto:
          "Avisas al moroso por WhatsApp, ordenas el corte, el técnico (o el presidente) sube la foto del medidor ya cortado y tú das de alta. Sin foto, el corte no queda registrado.",
      },
      {
        selector: enMenu("cor-nueva"),
        titulo: "Nueva orden",
        texto:
          "Para ordenar a mano un corte, una reposición o una reparación a cualquier arranque del comité.",
        lado: "bottom",
      },
      {
        titulo: "Lo que piden los socios",
        texto:
          "Tus socios pueden pedir desde su cuenta un reclamo, una reposición, una reparación, la baja o la reanudación del servicio. Las ves en Solicitudes, las apruebas o las respondes, y el socio ve tu respuesta.",
      },
    ],
  },
];

export function recorridoPorId(id: string) {
  return [...RECORRIDOS, ...RECORRIDOS_NUEVOS].find((r) => r.id === id);
}
