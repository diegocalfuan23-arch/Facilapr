import { NextRequest, NextResponse } from "next/server";

/** La rendición de cuentas ahora vive en el módulo Rendiciones: esta dirección antigua lleva allá, con el año pedido. */
export async function GET(req: NextRequest) {
  const anio = req.nextUrl.searchParams.get("anio");
  const destino = new URL("/panel/rendiciones", req.url);
  destino.searchParams.set("tipo", "anio");
  if (anio) destino.searchParams.set("anio", anio);
  return NextResponse.redirect(destino);
}
