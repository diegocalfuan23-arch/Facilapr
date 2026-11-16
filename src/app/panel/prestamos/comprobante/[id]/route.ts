import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trabajadores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarPrestamos } from "@/lib/prestamos";
import { generarAutorizacionPrestamoPdf } from "@/lib/prestamo-pdf";
import { hoyEnChile } from "@/lib/finanzas-comun";

/** La autorización de descuento de un anticipo o préstamo en PDF, para que la firme el trabajador. Solo la directiva. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return new Response("No disponible en tu plan.", { status: 403 });

  const { id } = await params;
  const prestamo = (await listarPrestamos(apr.id)).find((p) => p.id === id);
  if (!prestamo) return new Response("No encontrado.", { status: 404 });

  const [persona] = await db
    .select({ nombre: trabajadores.nombre, rut: trabajadores.rut, cargo: trabajadores.cargo, sueldo: trabajadores.sueldo })
    .from(trabajadores)
    .where(and(eq(trabajadores.id, prestamo.trabajadorId), eq(trabajadores.aprId, apr.id)))
    .limit(1);
  if (!persona) return new Response("No encontrado.", { status: 404 });

  const pdf = await generarAutorizacionPrestamoPdf(
    {
      nombre: apr.nombre,
      razonSocial: apr.razonSocial,
      rut: apr.rut,
      direccion: apr.direccion,
      comuna: apr.comuna,
      telefono: apr.telefono,
      logo: apr.logoUrl,
    },
    prestamo,
    persona,
    hoyEnChile()
  );

  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="Autorizacion-${prestamo.codigo}.pdf"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
