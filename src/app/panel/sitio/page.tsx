import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { Globe, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { avisos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import {
  NOMBRE_PLAN,
  generarSlug,
  planMinimoPara,
  puede,
  type Plan,
} from "@/lib/planes";
import { SitioEditor } from "@/components/panel/sitio-editor";
import { imagenesDelSitio } from "@/lib/sitio-imagenes";
import { listarSecciones } from "@/lib/sitio-secciones";
import { colorDelSitio } from "@/lib/sitio-tema";

export const metadata: Metadata = {
  title: "Sitio público",
};

const DOMINIO_RAIZ = process.env.NEXT_PUBLIC_DOMINIO_RAIZ ?? "facilapr.cl";

export default async function SitioPage() {
  const { apr } = await requireAdmin();
  const plan = apr.plan as Plan;

  if (!puede(plan, "landing")) {
    const requerido = planMinimoPara("landing");

    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Globe className="size-6 text-primary" />
        </span>
        <h1 className="mt-5 text-[1.25rem] font-semibold">
          Tu comité en internet
        </h1>
        <p className="mt-2 max-w-[52ch] text-[0.95rem] leading-relaxed text-muted-foreground">
          Una página web con los datos de tu comité, los avisos de corte y la
          información de pago. Se arma sola con lo que ya tienes cargado: no
          hay que diseñar ni mantener nada.
        </p>

        <ul className="mt-6 flex flex-col gap-2 text-left text-[0.92rem]">
          {[
            `Tu dirección propia: ${generarSlug(apr.nombre)}.${DOMINIO_RAIZ}`,
            "Avisos de corte que publicas desde el panel",
            "Tarifas y formas de pago siempre al día",
            "Acceso directo al panel de socios",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-7 flex items-center gap-2 rounded-lg bg-muted px-4 py-2.5 text-[0.88rem]">
          <Lock className="size-4 text-muted-foreground" />
          Disponible desde el plan{" "}
          <strong className="font-semibold">{NOMBRE_PLAN[requerido]}</strong>.
          Tu plan actual es {NOMBRE_PLAN[plan]}.
        </div>
      </div>
    );
  }

  const listado = await db.query.avisos.findMany({
    where: and(eq(avisos.aprId, apr.id), eq(avisos.publicado, true)),
    orderBy: [desc(avisos.createdAt)],
    limit: 5,
    columns: {
      id: true,
      tipo: true,
      titulo: true,
      cuerpo: true,
      sectores: true,
      inicia: true,
      termina: true,
    },
  });

  const [imagenes, secciones, color] = await Promise.all([imagenesDelSitio(apr.id), listarSecciones(apr.id, true), colorDelSitio(apr.id)]);

  return (
    <SitioEditor
      datos={{
        slug: apr.slug,
        sitioPublicado: apr.sitioPublicado,
        sitioDescripcion: apr.sitioDescripcion,
        horarioAtencion: apr.horarioAtencion,
        tarifaCargoFijo: apr.tarifaCargoFijo,
        tarifaMetroCubico: apr.tarifaMetroCubico,
        infoPago: apr.infoPago,
      }}
      sitio={{
        id: apr.id,
        nombre: apr.nombre,
        comuna: apr.comuna,
        region: apr.region,
        direccion: apr.direccion,
        telefono: apr.telefono,
        email: apr.email,
        sitioDescripcion: apr.sitioDescripcion,
        horarioAtencion: apr.horarioAtencion,
        tarifaCargoFijo: apr.tarifaCargoFijo,
        tarifaMetroCubico: apr.tarifaMetroCubico,
        infoPago: apr.infoPago,
      }}
      avisos={listado}
      imagenes={imagenes}
      secciones={secciones}
      color={color}
      dominioRaiz={DOMINIO_RAIZ}
      sugerenciaSlug={generarSlug(apr.nombre)}
    />
  );
}
