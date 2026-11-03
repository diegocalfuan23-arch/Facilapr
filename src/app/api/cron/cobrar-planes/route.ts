import { ejecutarCobros } from "@/lib/cobro-automatico";

/**
 * Cobra los planes cuyo período terminó, a las tarjetas que los comités dejaron
 * registradas en Flow. Pensado para correr una vez al día desde un cron. Cobra
 * dinero de verdad, así que va protegido con el mismo secreto que el resto de los
 * procesos programados.
 */
async function ejecutar(request: Request) {
  const secreto = process.env.CRON_SECRET;

  // Sin secreto configurado el endpoint queda apagado: es preferible que no
  // cobre nada a que quede abierto a cualquiera.
  if (!secreto) {
    return Response.json({ error: "Cobros no configurados." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const resumen = await ejecutarCobros();
  return Response.json({ ok: true, ...resumen });
}

export async function GET(request: Request) {
  return ejecutar(request);
}

export async function POST(request: Request) {
  return ejecutar(request);
}
