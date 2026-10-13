/**
 * Valor de la UF de hoy en pesos, desde mindicador.cl (indicadores económicos de
 * Chile, gratis). Los precios de los planes están en UF y las pasarelas cobran en
 * pesos, así que cada cobro se convierte con el valor del día. Se guarda una hora
 * en caché para no consultarlo en cada visita.
 */
export async function valorUfHoy(): Promise<number | null> {
  try {
    const r = await fetch("https://mindicador.cl/api/uf", {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const datos = (await r.json()) as { serie?: { valor?: number }[] };
    const valor = datos.serie?.[0]?.valor;
    return typeof valor === "number" && valor > 1000 ? valor : null;
  } catch {
    return null;
  }
}
