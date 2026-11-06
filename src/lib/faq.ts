/**
 * Preguntas frecuentes de la landing. Son las mismas que se muestran en la página
 * y las que se declaran a Google como datos estructurados (FAQPage), así que
 * se editan en un solo lugar.
 */
export const PREGUNTAS: { pregunta: string; respuesta: string }[] = [
  {
    pregunta: "¿Sirve para un APR pequeño?",
    respuesta: "Sí. El plan Pequeño es para APR con hasta 200 socios e incluye boletas, portal para cada socio y 1 operador en terreno.",
  },
  {
    pregunta: "¿Cómo pasamos lo que tenemos en Excel?",
    respuesta: "Puedes cargar socios uno por uno o todos de una vez, y emitir boletas manualmente o por CSV. En el plan Estándar te cargamos el padrón.",
  },
  {
    pregunta: "¿El socio necesita instalar algo?",
    respuesta: "No. Entra desde el navegador con su RUT y una clave. Si quiere, lo instala en su celular como una app.",
  },
  {
    pregunta: "¿Cómo se registran los pagos?",
    respuesta: "El comité registra cada pago con su comprobante. Con Mercado Pago, hoy en beta, el socio paga desde su cuenta y la boleta se marca pagada sola.",
  },
  {
    pregunta: "¿Se puede cobrar distinto a los comercios?",
    respuesta: "Sí. Puedes crear tarifas residenciales y comerciales, cada una con su cargo fijo y valor del m³.",
  },
  {
    pregunta: "¿El precio incluye IVA?",
    respuesta: "No. Los precios se muestran en UF más IVA.",
  },
  {
    pregunta: "¿Hay permanencia mínima?",
    respuesta: "No. Pagando por mes no hay permanencia mínima.",
  },
];
