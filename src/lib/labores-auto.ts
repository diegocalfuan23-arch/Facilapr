import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { labores } from "@/lib/db/schema";
import { ErrorLabor, descontarStock } from "@/lib/labores-stock";
import { ahoraEnChile, claveAhora, claveFin, claveInicio } from "@/lib/labores-comun";

/**
 * Pasa solas las labores que llegaron a su hora: una Programada cuya hora de inicio ya pasó queda En curso, y una
 * cuyo término programado ya pasó queda Hecha (con sus materiales descontados del inventario). Si al terminar no
 * alcanza el stock de algún material, la labor queda En curso y se ve que ya debía haber terminado.
 *
 * No hay un proceso que corra cada minuto: esto se aplica cuando alguien abre Labores o Inventario, así que lo que
 * se ve siempre está al día, aunque el cambio se anote en ese momento y no justo a la hora programada.
 */
export async function avanzarLaboresVencidas(aprId: string): Promise<void> {
  try {
    const ahora = claveAhora();
    const candidatas = await db
      .select({ id: labores.id, numero: labores.numero, estado: labores.estado, fecha: labores.fecha, hora: labores.hora, fechaTermino: labores.fechaTermino, horaFin: labores.horaFin })
      .from(labores)
      .where(and(eq(labores.aprId, aprId), inArray(labores.estado, ["PROGRAMADA", "EN_CURSO"])));

    for (const l of candidatas) {
      const fin = claveFin(l);
      const terminada = fin !== null && fin <= ahora;
      const arrancada = claveInicio(l) <= ahora;

      if (terminada) {
        try {
          await db.transaction(async (tx) => {
            await descontarStock(tx, { aprId, userId: null, auto: true }, { id: l.id, numero: l.numero });
            await tx.update(labores).set({ estado: "HECHA", descontada: true, fechaTermino: l.fechaTermino ?? ahoraEnChile().fecha, horaFin: null, updatedAt: new Date() }).where(eq(labores.id, l.id));
          });
          continue;
        } catch (e) {
          // Sin stock suficiente (u otro motivo): no se finaliza sola; queda en curso para que la directiva la revise.
          if (!(e instanceof ErrorLabor)) console.error("Labores: no se pudo finalizar sola:", e);
        }
      }

      if (l.estado === "PROGRAMADA" && (arrancada || terminada)) {
        await db.update(labores).set({ estado: "EN_CURSO", updatedAt: new Date() }).where(eq(labores.id, l.id));
      }
    }
  } catch (e) {
    console.error("Labores: no se pudieron adelantar las que llegaron a su hora:", e);
  }
}
