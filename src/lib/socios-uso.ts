/** Para qué se usa el agua de un arranque. Cada comité puede tener tarifas o análisis distintos por uso. */
export type UsoSocio = "RESIDENCIAL" | "COMERCIAL";

export const USOS_SOCIO: { valor: UsoSocio; texto: string }[] = [
  { valor: "RESIDENCIAL", texto: "Residencial" },
  { valor: "COMERCIAL", texto: "Comercial" },
];

export const textoUso = (uso: string) => (uso === "COMERCIAL" ? "Comercial" : "Residencial");
