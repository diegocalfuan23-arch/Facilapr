import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, socios } from "@/lib/db/schema";
import { anterioresDelComite } from "@/lib/lectura-anterior";
import { urlRecibo } from "@/lib/recibo-enlace";
import { envioAutomaticoActivo } from "@/lib/whatsapp-api";
import { cupoWhatsapp } from "@/lib/whatsapp-cupo";
import type { CupoWhatsapp } from "@/lib/whatsapp-cupo-comun";
import type { Plan } from "@/lib/planes";
import type { BoletaFila, SocioOpcion } from "@/components/panel/boletas-tabla";

/** Lo que cambia en la pantalla de Boletas al emitir, importar, pagar o anular: la lista, el padrón y el cupo de mensajes. */
export type DatosBoletas = {
  boletas: BoletaFila[];
  socios: SocioOpcion[];
  cupoWhatsapp: CupoWhatsapp | null;
  envioAutomatico: boolean;
};

/** Los datos de la pantalla de Boletas. La usan la página (al abrirse) y la consulta que la mantiene al día. */
export async function datosBoletas(apr: { id: string; plan: string }): Promise<DatosBoletas> {
  // Las consultas no dependen unas de otras: se piden a la vez.
  const [cupo, listado, padron, anteriores] = await Promise.all([
    // Cuántos mensajes automáticos le quedan al comité este mes (solo si el envío por API está activo).
    envioAutomaticoActivo() ? cupoWhatsapp(apr.id, apr.plan as Plan) : Promise.resolve(null),
    db
      .select({
        id: boletas.id,
        socioId: boletas.socioId,
        socioNombre: socios.nombre,
        socioRut: socios.rut,
        socioTelefono: socios.telefono,
        socioConsentimiento: socios.whatsappConsentimiento,
        periodo: boletas.periodo,
        montoTotal: boletas.montoTotal,
        montoPagado: boletas.montoPagado,
        estado: boletas.estado,
        fechaEmision: boletas.fechaEmision,
        fechaVencimiento: boletas.fechaVencimiento,
        lecturaAnterior: boletas.lecturaAnterior,
        lecturaActual: boletas.lecturaActual,
        consumoM3: boletas.consumoM3,
        observacion: boletas.observacion,
      })
      .from(boletas)
      .innerJoin(socios, eq(boletas.socioId, socios.id))
      .where(eq(socios.aprId, apr.id))
      .orderBy(desc(boletas.periodo), asc(socios.nombre)),
    db.query.socios.findMany({
      where: eq(socios.aprId, apr.id),
      orderBy: [asc(socios.nombre)],
      columns: { id: true, nombre: true, rut: true, numeroCliente: true, tipo: true, uso: true },
    }),
    anterioresDelComite(apr.id),
  ]);

  // La lectura anterior de cada arranque: sugiere la anterior al crear una boleta.
  const anteriorDe = new Map([...anteriores].map(([id, a]) => [id, a.valor]));

  return {
    boletas: listado.map((b) => ({ ...b, reciboUrl: urlRecibo(b.id) })),
    socios: padron.map((p) => ({ ...p, ultimaLectura: anteriorDe.get(p.id) ?? null })),
    cupoWhatsapp: cupo,
    envioAutomatico: envioAutomaticoActivo() && (cupo?.disponible ?? true),
  };
}
