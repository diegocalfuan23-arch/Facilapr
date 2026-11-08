import { vencerPruebas } from "@/lib/prueba";

/**
 * Cierra las pruebas gratuitas vencidas: el comité vuelve al plan Pequeño y no pierde sus datos. Corre una vez al día
 * desde un cron y va protegido con el mismo secreto que los demás procesos programados.
 */
async function ejecutar(request: Request) {
  const secreto = process.env.CRON_SECRET;

  // Sin secreto configurado el endpoint queda apagado.
  if (!secreto) {
    return Response.json({ error: "Proceso no configurado." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const cerradas = await vencerPruebas();
  return Response.json({ ok: true, cerradas });
}

export async function GET(request: Request) {
  return ejecutar(request);
}

export async function POST(request: Request) {
  return ejecutar(request);
}
