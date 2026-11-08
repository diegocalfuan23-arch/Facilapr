/**
 * Preguntas frecuentes de la landing. Son las mismas que se muestran en la página
 * y las que se declaran a Google como datos estructurados (FAQPage), así que
 * se editan en un solo lugar.
 */
export const PREGUNTAS: { pregunta: string; respuesta: string }[] = [
  {
    pregunta: "¿Qué es un software para APR y qué hace Facilapr?",
    respuesta:
      "Es un sistema para administrar un comité de Agua Potable Rural (APR o SSR) sin planillas sueltas: se cargan los socios y las lecturas de los medidores, el sistema calcula y emite las boletas, registra los pagos con su comprobante, lleva la morosidad y los cortes, y cada socio tiene su cuenta en línea para ver lo que debe.",
  },
  {
    pregunta: "¿Sirve para un APR pequeño?",
    respuesta:
      "Sí. El plan Pequeño es para comités de hasta 200 socios, desde 0,7 UF al mes más IVA y sin permanencia pagando por mes. Incluye boletas y recibos en PDF, el portal de cada socio, 1 operador en terreno y soporte por correo. Si el comité crece, se cambia de plan cuando quiera.",
  },
  {
    pregunta: "¿Dónde quedan guardados los datos de nuestros socios?",
    respuesta:
      "En una base de datos propia de tu APR, separada de cualquier otro comité. Nunca compartimos ni vendemos información de socios a terceros.",
  },
  {
    pregunta: "¿Cómo pasamos a Facilapr lo que ya tenemos en Excel?",
    respuesta:
      "Los socios y las boletas se pueden importar desde una planilla Excel o CSV con el nombre, RUT, número de arranque, dirección y teléfono de cada socio. Antes de guardar, el sistema te muestra qué entendió de cada fila para que corrijas lo que haga falta. En el plan Estándar te cargamos el padrón.",
  },
  {
    pregunta: "¿Se pueden registrar lecturas de medidor y ver la morosidad?",
    respuesta:
      "Sí. Las lecturas se cargan desde el celular en terreno, incluso con mala señal; al aprobarlas, el sistema calcula el consumo y la boleta con las tarifas del comité. El panel muestra de un vistazo qué socios están al día y cuáles tienen boletas vencidas.",
  },
  {
    pregunta: "¿Cómo se manejan los cortes por morosidad?",
    respuesta:
      "El sistema lista a los socios con deuda vencida más allá de los días de gracia que defina el comité, deja registro de los avisos que se les hacen y del corte, y permite pactar la deuda en cuotas (repactación). Cuando el socio regulariza, se registra la reposición del servicio.",
  },
  {
    pregunta: "¿Cómo registran los pagos los socios?",
    respuesta:
      "El comité registra cada pago, o abono, en efectivo, transferencia o Caja Vecina, y el sistema genera un comprobante en PDF que se puede enviar al socio por WhatsApp. Con Mercado Pago, hoy en beta, el socio también puede pagar desde su cuenta y la boleta se marca pagada sola. En todos los casos el socio ve sus pagos en su cuenta en línea.",
  },
  {
    pregunta: "¿Se puede cobrar una tarifa distinta a los comercios?",
    respuesta:
      "Sí. Cada arranque se marca como residencial o comercial, y el comité puede definir una tarifa comercial opcional (cargo fijo y valor del metro cúbico). Si no la define, todos pagan la tarifa general.",
  },
  {
    pregunta: "¿El socio necesita instalar algo?",
    respuesta:
      "No es obligatorio. Entra desde el navegador de su celular o computador, con su RUT y una clave. Si quiere, puede instalar su panel en la pantalla de inicio del teléfono y abrirlo como una app, sin pasar por la tienda de aplicaciones.",
  },
  {
    pregunta: "¿Los socios pueden escribirle al comité?",
    respuesta:
      "En los planes Estándar y Grande hay un chat en tiempo real con la directiva, donde un asistente con inteligencia artificial responde en segundos con los datos del socio. En todos los planes, el socio puede hacer solicitudes desde su cuenta: reclamos, reparaciones, reposición del servicio o baja.",
  },
  {
    pregunta: "¿Sirve también para la caja, las compras y el personal del comité?",
    respuesta:
      "Sí. Desde el plan Estándar incluye la caja del comité, compras y proveedores, inventario, labores y reportes. El plan Grande suma RR.HH. (sueldos, vacaciones y asistencia), incidentes, activos fijos y el registro de arranques de la red.",
  },
  {
    pregunta: "¿El precio incluye IVA?",
    respuesta:
      "Los valores publicados son netos, en UF, más IVA, igual que la mayoría de los servicios contratados por un APR o SSR.",
  },
  {
    pregunta: "¿Hay contrato de permanencia mínima?",
    respuesta:
      "No. Pagando por mes puedes darte de baja cuando lo estime la directiva, sin multas ni plazos forzosos. El plan anual incluye 1 mes gratis.",
  },
];
