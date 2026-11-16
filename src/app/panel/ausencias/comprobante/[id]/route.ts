import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trabajadores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarAusencias } from "@/lib/rrhh";
import { generarComprobanteAusenciaPdf } from "@/lib/ausencia-pdf";
import { hoyEnChile } from "@/lib/finanzas-comun";

/** El comprobante de unas vacaciones, un permiso o una licencia en PDF, para que lo firme el trabajador. Solo la directiva. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return new Response("No disponible en tu plan.", { status: 403 });

  const { id } = await params;
  const ausencia = (await listarAusencias(apr.id, ["VACACIONES", "PERMISO", "LICENCIA"])).find((a) => a.id === id);
  if (!ausencia) return new Response("No encontrado.", { status: 404 });

  const [persona] = await db
    .select({ nombre: trabajadores.nombre, rut: trabajadores.rut, cargo: trabajadores.cargo, fechaIngreso: trabajadores.fechaIngreso })
    .from(trabajadores)
    .where(and(eq(trabajadores.id, ausencia.trabajadorId), eq(trabajadores.aprId, apr.id)))
    .limit(1);
  if (!persona) return new Response("No encontrado.", { status: 404 });

  const pdf = await generarComprobanteAusenciaPdf(
    {
      nombre: apr.nombre,
      razonSocial: apr.razonSocial,
      rut: apr.rut,
      direccion: apr.direccion,
      comuna: apr.comuna,
      telefono: apr.telefono,
      logo: apr.logoUrl,
    },
    ausencia,
    persona,
    hoyEnChile()
  );

  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="Comprobante-${ausencia.desde}.pdf"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
