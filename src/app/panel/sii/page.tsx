import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, siiConfigs, siiDocumentos, siiFolios, socios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { cifradoListo, siiHabilitado } from "@/lib/sii/seguridad";
import { boletasSinEmitir, periodosConBoletas, type FotoDocumento } from "@/lib/sii/emision";
import { motivoParaNoEmitir } from "@/lib/sii/lineas";
import { SiiVista } from "@/components/panel/sii-vista";
import { SiiBoletas } from "@/components/panel/sii-boletas";

export const metadata: Metadata = {
  title: "Boletas SII",
};

/** Cuántos documentos se listan. */
const ULTIMOS = 50;

export default async function SiiPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { apr } = await requireAdmin();
  // Solo los comités activados la ven: no se muestra ni por la dirección directa.
  if (!siiHabilitado(apr.slug)) redirect("/panel");

  // Nunca se traen el certificado, su clave ni el contenido de los folios: la pantalla no los necesita.
  const [config, folios] = await Promise.all([
    db.query.siiConfigs.findFirst({
      where: eq(siiConfigs.aprId, apr.id),
      columns: { certificado: false, certificadoClave: false },
    }),
    db.query.siiFolios.findMany({
      where: eq(siiFolios.aprId, apr.id),
      columns: { id: true, tipo: true, desde: true, hasta: true, siguiente: true, fechaAutorizacion: true },
      orderBy: [asc(siiFolios.tipo), asc(siiFolios.desde)],
    }),
  ]);

  const periodos = await periodosConBoletas(apr.id);
  const { mes } = await searchParams;
  const periodo = mes && periodos.includes(mes) ? mes : (periodos[0] ?? null);
  const [sinEmitir, documentos] = await Promise.all([
    periodo ? boletasSinEmitir(apr.id, periodo) : [],
    db
      .select({
        id: siiDocumentos.id,
        folio: siiDocumentos.folio,
        monto: siiDocumentos.monto,
        estado: siiDocumentos.estado,
        datos: siiDocumentos.datos,
        montoBoleta: boletas.montoTotal,
        estadoBoleta: boletas.estado,
        socio: socios.nombre,
      })
      .from(siiDocumentos)
      .leftJoin(boletas, eq(boletas.id, siiDocumentos.boletaId))
      .leftJoin(socios, eq(socios.id, boletas.socioId))
      .where(eq(siiDocumentos.aprId, apr.id))
      .orderBy(desc(siiDocumentos.createdAt), desc(siiDocumentos.folio))
      .limit(ULTIMOS),
  ]);
  const omitidas = sinEmitir.flatMap((b) => {
    const motivo = motivoParaNoEmitir(b);
    return motivo ? [{ socio: b.socio.nombre, motivo }] : [];
  });

  return (
    <div className="flex max-w-[720px] flex-col gap-4">
      <SiiVista
        comite={{ nombre: apr.nombre, razonSocial: apr.razonSocial, rut: apr.rut, direccion: apr.direccion, comuna: apr.comuna }}
        listo={cifradoListo()}
        emisor={config ?? null}
        folios={folios}
      />
      <SiiBoletas
        periodos={periodos}
        periodo={periodo}
        porEmitir={sinEmitir.length - omitidas.length}
        omitidas={omitidas}
        documentos={documentos.map((d) => ({
          id: d.id,
          folio: d.folio,
          monto: d.monto,
          estado: d.estado,
          socio: d.socio ?? (d.datos as FotoDocumento).boleta.receptor.nombre,
          // La boleta del comité se borró, se anuló o cambió de monto después de firmar el documento.
          revisar: d.estadoBoleta === null || d.estadoBoleta === "ANULADA" || d.montoBoleta !== d.monto,
        }))}
      />
    </div>
  );
}
