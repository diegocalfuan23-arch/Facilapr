import { aplicarPagoFlow } from "@/lib/pago-plan";

/**
 * Flow avisa aquí, de servidor a servidor, que un pago cambió de estado. No
 * traemos nada de la petición salvo el token: el estado real se le pregunta a Flow.
 */
export async function POST(req: Request) {
  // Flow manda el token como formulario (x-www-form-urlencoded).
  const token = new URLSearchParams(await req.text().catch(() => "")).get("token") ?? "";
  if (!token) return new Response("Falta el token.", { status: 400 });

  try {
    await aplicarPagoFlow(token);
    return new Response("ok");
  } catch (e) {
    console.error("Confirmación de Flow:", e);
    // Un error aquí hace que Flow reintente más tarde.
    return new Response("error", { status: 500 });
  }
}
