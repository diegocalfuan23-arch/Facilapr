import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, lecturas, socios } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/auth-schema";
import { requireApr } from "@/lib/apr-session";
import { formatearRut } from "@/lib/formato";
import { datosTerreno, sociosConAnterior } from "@/lib/terreno";
import { LecturaForm } from "@/components/panel/lectura-form";
import { LecturasTabla } from "@/components/panel/lecturas-tabla";

export const metadata: Metadata = {
  title: "Lecturas",
};

export default async function LecturasPage() {
  const { user, apr } = await requireApr();

  // El operador solo ve la pantalla de cargar lecturas.
  if (user.rol === "OPERADOR") {
    return <LecturaForm {...await datosTerreno(user.id, apr.id)} />;
  }

  const { listaSocios, anteriorPorSocio } = await sociosConAnterior(apr.id);

  // Todas las lecturas del comité, no solo las pendientes: la directiva
  // necesita ver también lo ya resuelto. Tope alto por si el padrón es grande.
  const todas = await db
    .select({
      id: lecturas.id,
      periodo: lecturas.periodo,
      valor: lecturas.valor,
      observacion: lecturas.observacion,
      estado: lecturas.estado,
      motivoRechazo: lecturas.motivoRechazo,
      createdAt: lecturas.createdAt,
      socioId: lecturas.socioId,
      socioNombre: socios.nombre,
      socioRut: socios.rut,
      registradaPor: userTable.name,
      boletaId: boletas.id,
    })
    .from(lecturas)
    .innerJoin(socios, eq(lecturas.socioId, socios.id))
    // Una lectura aprobada sin boleta del mismo período es una lectura inicial.
    .leftJoin(
      boletas,
      and(eq(boletas.socioId, lecturas.socioId), eq(boletas.periodo, lecturas.periodo))
    )
    .leftJoin(userTable, eq(lecturas.registradaPorId, userTable.id))
    .where(eq(socios.aprId, apr.id))
    .orderBy(desc(lecturas.createdAt))
    .limit(1500);

  return (
    <LecturasTabla
      socios={listaSocios.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        rut: s.rut,
        numeroCliente: s.numeroCliente,
        tipo: s.tipo,
        // La última lectura aprobada: el dato con el que se compara la nueva.
        ultimaLectura: anteriorPorSocio.get(s.id)?.valor ?? null,
      }))}
      lecturas={todas.map((l) => ({
        id: l.id,
        socio: l.socioNombre,
        rut: formatearRut(l.socioRut),
        periodo: l.periodo,
        valor: l.valor,
        observacion: l.observacion,
        estado: l.estado,
        motivoRechazo: l.motivoRechazo,
        registradaPor: l.registradaPor,
        createdAt: l.createdAt,
        anterior: anteriorPorSocio.get(l.socioId)?.valor ?? null,
        inicial: l.estado === "APROBADA" && l.boletaId === null,
      }))}
    />
  );
}
