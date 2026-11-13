/**
 * Recorridos guiados del panel. Cada uno se muestra sobre la propia pantalla:
 * oscurece el resto y resalta, de a una, las partes que explica.
 *
 * Los pasos apuntan a elementos con data-tour="..." (o a un id), ver los
 * componentes del panel. Si un elemento no está en pantalla (por ejemplo el
 * menú en el celular), ese paso se omite solo.
 */

import type { Capacidad } from "@/lib/planes";

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
  /** El módulo que hace falta en el plan para ver este recorrido. Sin él, es para todos los planes. */
  capacidad?: Capacidad;
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
        titulo: "Operadores",
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
        titulo: "Operadores",
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
        titulo: "Invitar operador",
        texto:
          "Escribe su nombre y copia el enlace de invitación para enviárselo (por WhatsApp, por ejemplo). Con ese enlace crea su propia contraseña.",
        lado: "bottom",
      },
      {
        selector: enMenu("tec-tabla"),
        titulo: "Tus operadores",
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
        titulo: "Qué ve el operador",
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
    id: "compras",
    capacidad: "finanzas",
    ruta: "/panel/compras",
    titulo: "Compras y proveedores",
    resumen: "Registrar lo que compras, saber cuánto debes y a quién.",
    minutos: 2,
    pasos: [
      {
        selector: enMenu("com-kpis"),
        titulo: "Cuánto debes",
        texto:
          "Por pagar es lo que todavía no has pagado, y debajo ves cuánto de eso ya venció. También ves cuánto compraste este mes y cuántos proveedores tienes, con un aviso si hay compras sin proveedor asignado.",
        lado: "bottom",
      },
      {
        selector: enMenu("com-nueva"),
        titulo: "Registrar una compra",
        texto:
          "Eliges el proveedor y el documento, y agregas los ítems. Cada ítem puede venir del inventario (suma stock), ser un material nuevo (se crea y suma stock) o ser solo un gasto. Si se paga al contado queda pagada; si tiene plazo, queda por pagar con su fecha de vencimiento.",
        lado: "bottom",
      },
      {
        selector: enMenu("com-pestanas"),
        titulo: "Compras y proveedores",
        texto:
          "En Compras ves cada compra con su estado: por pagar, pagada o anulada. En Proveedores llevas tus contactos y el plazo de pago de cada uno, para que el vencimiento se calcule solo.",
        lado: "bottom",
      },
      {
        titulo: "Pagar o anular",
        texto:
          "Abre una compra para marcarla como pagada: eso anota el egreso en la Caja. Si la anulas, el stock que había sumado vuelve a lo que era. El stock sube al registrar la compra, no al pagarla.",
      },
    ],
  },
  {
    id: "inventario",
    capacidad: "inventario",
    ruta: "/panel/inventario",
    titulo: "Inventario de bodega",
    resumen: "Materiales, stock, avisos de stock bajo e historial de movimientos.",
    minutos: 2,
    pasos: [
      {
        selector: enMenu("inv-kpis"),
        titulo: "Lo que tienes en bodega",
        texto:
          "El valor total del inventario, cuántos materiales hay y cuántos están con stock bajo. Si un material no tiene aviso definido, el resumen te lo indica.",
        lado: "bottom",
      },
      {
        selector: enMenu("inv-acciones"),
        titulo: "Crear materiales y categorías",
        texto:
          "Nuevo material: nombre, unidad, stock, costo y el stock mínimo desde el que quieres que te avise. Con Categorías los ordenas, por ejemplo cloro, cañerías o repuestos.",
        lado: "bottom",
      },
      {
        titulo: "Ajustar el stock",
        texto:
          "En la fila de cada material puedes registrar una entrada (una donación o una devolución) o una salida (una reparación o la cloración), y anotas el motivo. La cantidad no puede pasar de lo que hay.",
      },
      {
        selector: enMenu("inv-pestanas"),
        titulo: "El historial",
        texto:
          "En Historial queda cada movimiento: quién lo hizo, cuándo y por qué. Así sabes adónde se fue un material. Las compras y las labores también mueven el stock y quedan anotadas ahí.",
        lado: "bottom",
      },
    ],
  },
  {
    id: "activos",
    capacidad: "activos",
    ruta: "/panel/activos",
    titulo: "Activos fijos",
    resumen: "Los bienes del comité, con su costo y cuánto valen hoy.",
    minutos: 1,
    pasos: [
      {
        selector: enMenu("act-kpis"),
        titulo: "El patrimonio del comité",
        texto:
          "Cuántos bienes tienes, cuánto costaron, cuánto valen hoy y cuántos están en reparación. Sirve para mostrarlo en la asamblea.",
        lado: "bottom",
      },
      {
        selector: enMenu("act-nuevo"),
        titulo: "Registrar un bien",
        texto:
          "Una bomba, el estanque, un medidor, un terreno. Anotas el costo, la fecha de compra y la vida útil en años. Un terreno se registra con vida útil 0 y no se deprecia.",
        lado: "bottom",
      },
      {
        titulo: "Cómo se calcula el valor de hoy",
        texto:
          "El valor baja en partes iguales, mes completo a mes completo, hasta agotar la vida útil. Es una referencia para el comité y no reemplaza la contabilidad de un contador.",
      },
      {
        selector: enMenu("act-buscar"),
        titulo: "Buscar y filtrar",
        texto: "Busca por nombre, código o ubicación, o filtra por categoría para ver solo un tipo de bien.",
        lado: "bottom",
      },
    ],
  },
  {
    id: "giros",
    capacidad: "finanzas",
    ruta: "/panel/giros",
    titulo: "Giros y depósitos",
    resumen: "Mover plata entre el banco y el efectivo sin que cuente como ingreso ni gasto.",
    minutos: 1,
    pasos: [
      {
        selector: enMenu("gir-saldos"),
        titulo: "Cuánto hay en cada lugar",
        texto:
          "Aquí ves cuánta plata hay en efectivo y cuánta en el banco, calculado desde el saldo inicial que definiste en Caja. Si todavía no lo defines, no se puede saber, y los botones quedan apagados.",
        lado: "bottom",
      },
      {
        selector: enMenu("gir-acciones"),
        titulo: "Giro y depósito",
        texto:
          "Giro: sacaste plata del banco y ahora la tienes en efectivo. Depósito: llevaste efectivo al banco. La plata total del comité no cambia, solo dónde está, por eso no cuentan como ingreso ni como gasto.",
        lado: "bottom",
      },
      {
        titulo: "El historial",
        texto:
          "Debajo queda la lista de giros y depósitos, con cuánto se giró y cuánto se depositó en total. Uno anotado por error se borra desde su fila y los saldos se recalculan.",
      },
    ],
  },
  {
    id: "reportes",
    capacidad: "finanzas",
    ruta: "/panel/reportes",
    titulo: "Reportes del año",
    resumen: "Cuánto entró y salió mes a mes, y si la plata cuadra con la Caja.",
    minutos: 2,
    pasos: [
      {
        selector: enMenu("rep-totales"),
        titulo: "Los totales del año",
        texto:
          "Lo que entró, lo que salió y lo que quedó. Con las flechas de arriba cambias de año.",
        lado: "bottom",
      },
      {
        titulo: "Mes a mes",
        texto:
          "El gráfico compara los ingresos y los egresos de cada mes, para ver en cuáles se gastó más de lo que entró.",
      },
      {
        selector: enMenu("rep-cuadre"),
        titulo: "Cuadre con Caja",
        texto:
          "Parte del saldo inicial, suma los ingresos y resta los egresos para decirte cuánta plata debería haber. Lo compara con la que hay en la Caja. Si no coinciden, algo quedó sin anotar o se anotó de más.",
        lado: "left",
      },
      {
        selector: enMenu("rep-detalle"),
        titulo: "Detalle y informe de cada mes",
        texto:
          "Cada mes con sus números, y un enlace al informe de ese mes para presentarlo en la asamblea.",
        lado: "top",
      },
      {
        selector: enMenu("rep-descargar"),
        titulo: "Descargar",
        texto: "Baja los movimientos en Excel o el informe del período en PDF.",
        lado: "bottom",
      },
    ],
  },
  {
    id: "labores",
    capacidad: "inventario",
    ruta: "/panel/labores",
    titulo: "Labores y materiales",
    resumen: "Los trabajos del comité, y los materiales que gastan del inventario.",
    minutos: 2,
    pasos: [
      {
        selector: enMenu("lab-kpis"),
        titulo: "El estado de los trabajos",
        texto:
          "Cuántas labores hay programadas, cuántas en curso, cuántas se hicieron este mes y cuánto costaron los materiales que usaron.",
        lado: "bottom",
      },
      {
        selector: enMenu("lab-nueva"),
        titulo: "Registrar una labor",
        texto:
          "Le pones título, lugar, responsable y fecha, y agregas los materiales que va a usar, elegidos desde tu inventario.",
        lado: "bottom",
      },
      {
        titulo: "Programadas, en curso y hechas",
        texto:
          "Cada labor avanza por tres columnas. Al marcarla como Hecha, los materiales se descuentan solos del inventario y quedan anotados en su historial. Si la devuelves a una etapa anterior, el stock vuelve a lo que era.",
      },
    ],
  },
  {
    id: "incidentes",
    capacidad: "incidentes",
    ruta: "/panel/incidentes",
    titulo: "Incidentes del sistema de agua",
    resumen: "Fugas, fallas y cortes: de que se abren a que se resuelven, y cuánto costó.",
    minutos: 2,
    pasos: [
      {
        selector: enMenu("inc-nuevo"),
        titulo: "Registrar un incidente",
        texto:
          "Anotas qué pasó, de qué tipo es, su prioridad, la fecha, el lugar y una descripción. Si el incidente fue de un bien del comité, por ejemplo una bomba, puedes asociarlo a ese activo fijo.",
        lado: "bottom",
      },
      {
        selector: enMenu("inc-kpis"),
        titulo: "Cómo vas",
        texto:
          "Cuántos incidentes hay sin resolver y cuántos son de prioridad alta, el más antiguo que sigue abierto, cuántos se resolvieron este mes y en cuántos días en promedio, y cuánto costó arreglarlos.",
        lado: "bottom",
      },
      {
        selector: enMenu("inc-pestanas"),
        titulo: "Las tres etapas",
        texto:
          "Abierto, En reparación y Resuelto. Abre un incidente para ver su detalle y pasarlo a la etapa siguiente con el botón que aparece abajo.",
        lado: "bottom",
      },
      {
        titulo: "El costo llega a la Caja",
        texto:
          "Si anotas lo que costó la reparación, queda como egreso en la Caja. Si después cambias el costo, el egreso se ajusta solo.",
      },
    ],
  },
  {
    id: "arranques",
    capacidad: "arranques",
    ruta: "/panel/arranques",
    titulo: "Arranques de la red",
    resumen: "Las conexiones de tu red y los socios que abastece cada una.",
    minutos: 2,
    pasos: [
      {
        selector: enMenu("arr-acciones"),
        titulo: "Crear y asignar",
        texto:
          "Nuevo arranque: un punto de tu red, con su nombre y ubicación. Asignar socios: eliges qué socios abastece cada arranque. El botón se apaga si todavía no hay arranques o si todos los socios ya tienen uno.",
        lado: "bottom",
      },
      {
        titulo: "Cuántos socios tienen arranque",
        texto:
          "La barra muestra cuántos de tus socios ya están asignados a un arranque, para ver cuánto falta de catastrar.",
      },
      {
        selector: enMenu("arr-vista"),
        titulo: "Lista o mapa",
        texto:
          "En Lista buscas por arranque, lugar o socio. En Mapa ves dónde está cada arranque en el terreno.",
        lado: "bottom",
      },
      {
        titulo: "El detalle de un arranque",
        texto:
          "Al abrir uno ves su ubicación, con un enlace para abrir la ruta hasta ahí, y los socios que abastece. Desde ahí agregas o quitas socios.",
      },
    ],
  },
  {
    id: "personal",
    capacidad: "personal",
    ruta: "/panel/personal",
    titulo: "Personal del comité",
    resumen: "La ficha de quienes trabajan para el comité, de donde salen sus sueldos.",
    minutos: 1,
    pasos: [
      {
        selector: enMenu("per-resumen"),
        titulo: "Tu equipo de trabajo",
        texto:
          "Cuántas personas activas tienes, cuánto cuesta el equipo al mes y cuántas están inactivas.",
        lado: "bottom",
      },
      {
        selector: enMenu("per-nueva"),
        titulo: "Crear la ficha de una persona",
        texto:
          "Anotas sus datos, su sueldo, su AFP y su salud. Con esa ficha el sistema calcula solo las imposiciones en la remuneración, y la usa también en vacaciones, licencias, asistencia y préstamos.",
        lado: "bottom",
      },
      {
        titulo: "Gente con acceso al panel pero sin ficha",
        texto:
          "Si le diste acceso al panel a un tesorero u operador que también trabaja para el comité, aparece un aviso para crearle la ficha desde su cuenta.",
      },
    ],
  },
  {
    id: "remuneraciones",
    capacidad: "personal",
    ruta: "/panel/remuneraciones",
    titulo: "Remuneraciones mes a mes",
    resumen: "Armar las liquidaciones del mes, revisarlas y pagarlas.",
    minutos: 3,
    pasos: [
      {
        selector: enMenu("rem-mes"),
        titulo: "Elige el mes",
        texto: "Con las flechas cambias de mes. Cada mes tiene sus propias liquidaciones.",
        lado: "bottom",
      },
      {
        selector: enMenu("rem-armar"),
        titulo: "Armar el mes",
        texto:
          "Se crea una liquidación por cada persona activa, con su sueldo, los días y horas no pagados, las horas extras, las cuotas de préstamos y su colación. La AFP, la salud y el seguro de cesantía se calculan solos con su ficha.",
        lado: "bottom",
      },
      {
        titulo: "Revisar y pagar",
        texto:
          "Abre una liquidación para ajustarla si hace falta. Luego la marcas como revisada y, cuando la pagas, queda registrada como egreso en la Caja. Desde ahí puedes abrir la liquidación para entregársela a la persona.",
      },
      {
        selector: enMenu("rem-libro"),
        titulo: "El libro del mes",
        texto: "Descarga la planilla del mes para tu contador o la directiva.",
        lado: "bottom",
      },
    ],
  },
  {
    id: "asistencia",
    capacidad: "personal",
    ruta: "/panel/asistencia",
    titulo: "Asistencia del personal",
    resumen: "Quién vino cada día, atrasos, ausencias y horas extras.",
    minutos: 2,
    pasos: [
      {
        selector: enMenu("asi-calendario"),
        titulo: "Primero, el calendario laboral",
        texto:
          "Define el horario del comité, quién trabaja cada día y los feriados o días sin operación. Lo que no es laboral no queda pendiente de marcar.",
        lado: "bottom",
      },
      {
        selector: enMenu("asi-vista"),
        titulo: "Día, semana o mes",
        texto:
          "En Día marcas a cada persona: presente, atraso, ausente o permiso, y sumas sus horas extras. En Semana y Mes ves el cuadro completo.",
        lado: "bottom",
      },
      {
        titulo: "Vacaciones y licencias se marcan solas",
        texto:
          "Si una vacación o una licencia está aprobada, ese día aparece marcado automáticamente. Si todos vinieron, un botón marca de una vez a los pendientes como presentes.",
      },
      {
        selector: enMenu("asi-resumen"),
        titulo: "El resumen del mes",
        texto:
          "El porcentaje de asistencia, los atrasos, las ausencias y las horas extras. Esos días y horas pasan a la remuneración del mes.",
        lado: "bottom",
      },
    ],
  },
  {
    id: "prestamos",
    capacidad: "personal",
    ruta: "/panel/prestamos",
    titulo: "Anticipos y préstamos al personal",
    resumen: "Lo que el comité adelanta o presta, con cuotas que se descuentan solas.",
    minutos: 1,
    pasos: [
      {
        selector: enMenu("pre-nuevo"),
        titulo: "Registrar un anticipo o préstamo",
        texto:
          "Eliges a la persona, el monto y en cuántas cuotas se va a descontar. Hace falta que ya exista su ficha en Personal.",
        lado: "bottom",
      },
      {
        selector: enMenu("pre-kpis"),
        titulo: "Cuánto queda por descontar",
        texto: "Lo que falta recuperar, los préstamos vigentes y los que ya están saldados o cerrados.",
        lado: "bottom",
      },
      {
        titulo: "Las cuotas se descuentan solas",
        texto:
          "Al armar cada mes en Remuneraciones, la cuota correspondiente se resta de la liquidación. No tienes que acordarte de descontarla.",
      },
    ],
  },
  {
    id: "vacaciones",
    capacidad: "personal",
    ruta: "/panel/vacaciones",
    titulo: "Vacaciones y permisos",
    resumen: "Solicitar, aprobar y ver cuántos días le quedan a cada persona.",
    minutos: 1,
    pasos: [
      {
        selector: enMenu("aus-kpis"),
        titulo: "Quién está de vacaciones",
        texto: "Quiénes están de vacaciones hoy, cuántos días se han tomado este año y cuántas solicitudes esperan tu respuesta.",
        lado: "bottom",
      },
      {
        selector: enMenu("aus-nueva"),
        titulo: "Registrar vacaciones o un permiso",
        texto: "Eliges a la persona y las fechas. Queda como solicitada hasta que la apruebes o la rechaces.",
        lado: "bottom",
      },
      {
        titulo: "Solicitadas, aprobadas y rechazadas",
        texto:
          "Cada registro avanza por tres columnas. Al aprobarlo, esos días quedan marcados solos en Asistencia.",
      },
      {
        selector: enMenu("aus-saldo"),
        titulo: "El saldo de cada persona",
        texto: "Se suman 1,25 días hábiles por mes trabajado, 15 al año, y se restan los ya tomados.",
        lado: "left",
      },
    ],
  },
  {
    id: "licencias",
    capacidad: "personal",
    ruta: "/panel/licencias",
    titulo: "Licencias médicas",
    resumen: "Registrar las licencias del personal, con su folio y sus fechas.",
    minutos: 1,
    pasos: [
      {
        selector: enMenu("aus-kpis"),
        titulo: "Quién está con licencia",
        texto: "Quiénes tienen licencia hoy, cuántos días de licencia van este año y cuántas esperan tu respuesta.",
        lado: "bottom",
      },
      {
        selector: enMenu("aus-nueva"),
        titulo: "Registrar una licencia",
        texto: "Eliges a la persona, anotas el folio y las fechas. Se aprueba igual que unas vacaciones.",
        lado: "bottom",
      },
      {
        titulo: "Efecto en asistencia",
        texto: "Una licencia aprobada marca esos días solos en Asistencia, para que no cuenten como ausencia.",
      },
    ],
  },
  {
    id: "caja",
    capacidad: "finanzas",
    ruta: "/panel/caja",
    titulo: "Caja: lo que entra, lo que sale y cuánto hay",
    resumen: "Ver el día o el mes, anotar movimientos, cerrar la caja y sacar el informe.",
    minutos: 2,
    pasos: [
      {
        selector: enMenu("caj-periodo"),
        titulo: "Elige el día o el mes",
        texto:
          "Con las flechas y el selector te mueves entre días, o pasas a la vista del mes. Todo lo de abajo se calcula para el período que elijas.",
        lado: "bottom",
      },
      {
        selector: enMenu("caj-resumen"),
        titulo: "Cuánta plata hay",
        texto:
          "Arriba, el disponible. Debajo, de dónde partías (el disponible anterior), lo que entró, lo que salió y con cuánto terminas. Si ya definiste el saldo inicial, también ves cuánto está en efectivo y cuánto en el banco.",
        lado: "bottom",
      },
      {
        titulo: "Los pagos de tus socios entran solos",
        texto:
          "Cada pago que registras en Pagos, o que un socio hace en línea, aparece aquí como ingreso. Solo anotas a mano lo que no viene de un socio, como un gasto o un aporte.",
      },
      {
        selector: enMenu("caj-rapido"),
        titulo: "Anota un movimiento",
        texto:
          "Ingreso: entra plata. Egreso: sale plata. Giro: sacas plata del banco para tener efectivo. Depósito: llevas efectivo al banco. Giros y depósitos no cuentan como ingreso ni gasto, solo cambian dónde está la plata.",
        lado: "bottom",
      },
      {
        selector: enMenu("caj-movimientos"),
        titulo: "Todos los movimientos",
        texto:
          "La lista del período, con búsqueda y filtros por tipo y origen. Cada línea indica de dónde viene: un pago de socio, una compra o algo anotado a mano. Una que anotaste por error se borra desde su propia fila.",
        lado: "top",
      },
      {
        selector: enMenu("caj-acciones"),
        titulo: "Cerrar la caja y el informe",
        texto:
          "Cerrar caja deja el día confirmado: cuentas el efectivo que hay y el sistema te muestra si cuadra con lo anotado. Un día cerrado no admite cambios hasta que lo reabras. En el menú de los tres puntos están el saldo inicial, las categorías, el informe del mes para la asamblea y la descarga a Excel.",
        lado: "left",
      },
    ],
  },
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
          "Morosos: quienes pasaron los días de gracia. En trámite: lo que alguien tiene que ir a hacer. Por dar de alta: ya hay foto y falta tu revisión. Solicitudes: lo que piden tus socios o el operador. Cortados: quiénes tienen el servicio cortado ahora.",
        lado: "bottom",
      },
      {
        titulo: "Cómo se corta",
        texto:
          "Avisas al moroso por WhatsApp, ordenas el corte, el operador (o el presidente) sube la foto del medidor ya cortado y tú das de alta. Sin foto, el corte no queda registrado.",
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
