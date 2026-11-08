import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, remuneraciones, trabajadores } from "@/lib/db/schema";

/** Todo lo que lleva una liquidación de sueldo impresa: el comité, la persona y los números del mes. */
export type LiquidacionDatos = {
  id: string;
  periodo: string;
  comite: {
    nombre: string;
    razonSocial: string | null;
    rut: string | null;
    direccion: string | null;
    comuna: string;
    telefono: string | null;
    logo: string | null;
  };
  persona: {
    nombre: string;
    rut: string | null;
    cargo: string;
    contrato: "SUELDO" | "HONORARIO";
    afp: string | null;
    porDia: boolean;
    valorDia: number | null;
    fechaIngreso: string | null;
  };
  sueldoBase: number;
  diasDescontados: number;
  horasDescontadas: number;
  descAusencias: number;
  horasExtra: number;
  montoHorasExtra: number;
  noImponible: number;
  bonos: number;
  descAfp: number;
  descSalud: number;
  descCesantia: number;
  retencion: number;
  otrosDescuentos: number;
  descuentos: number;
  liquido: number;
  estado: "PENDIENTE" | "LISTA" | "PAGADA";
  fechaPago: string | null;
  medio: string | null;
  nota: string | null;
};

/** La liquidación de un comité por su id, o null si no existe o es de otro comité. */
export async function liquidacionPorId(aprId: string, id: string): Promise<LiquidacionDatos | null> {
  const [f] = await db
    .select({
      id: remuneraciones.id,
      periodo: remuneraciones.periodo,
      sueldoBase: remuneraciones.sueldoBase,
      diasDescontados: remuneraciones.diasDescontados,
      horasDescontadas: remuneraciones.horasDescontadas,
      descAusencias: remuneraciones.descAusencias,
      horasExtra: remuneraciones.horasExtra,
      montoHorasExtra: remuneraciones.montoHorasExtra,
      noImponible: remuneraciones.noImponible,
      bonos: remuneraciones.bonos,
      descAfp: remuneraciones.descAfp,
      descSalud: remuneraciones.descSalud,
      descCesantia: remuneraciones.descCesantia,
      retencion: remuneraciones.retencion,
      otrosDescuentos: remuneraciones.otrosDescuentos,
      descuentos: remuneraciones.descuentos,
      liquido: remuneraciones.liquido,
      estado: remuneraciones.estado,
      fechaPago: remuneraciones.fechaPago,
      medio: remuneraciones.medio,
      nota: remuneraciones.nota,
      personaNombre: trabajadores.nombre,
      personaRut: trabajadores.rut,
      personaCargo: trabajadores.cargo,
      contrato: trabajadores.contrato,
      afp: trabajadores.afp,
      porDia: trabajadores.porDia,
      valorDia: trabajadores.valorDia,
      fechaIngreso: trabajadores.fechaIngreso,
      comiteNombre: aprs.nombre,
      comiteRazonSocial: aprs.razonSocial,
      comiteRut: aprs.rut,
      comiteDireccion: aprs.direccion,
      comiteComuna: aprs.comuna,
      comiteTelefono: aprs.telefono,
      comiteLogo: aprs.logoUrl,
    })
    .from(remuneraciones)
    .innerJoin(trabajadores, eq(trabajadores.id, remuneraciones.trabajadorId))
    .innerJoin(aprs, eq(aprs.id, remuneraciones.aprId))
    .where(and(eq(remuneraciones.id, id), eq(remuneraciones.aprId, aprId)))
    .limit(1);
  if (!f) return null;

  return {
    id: f.id,
    periodo: f.periodo,
    comite: {
      nombre: f.comiteNombre,
      razonSocial: f.comiteRazonSocial,
      rut: f.comiteRut,
      direccion: f.comiteDireccion,
      comuna: f.comiteComuna,
      telefono: f.comiteTelefono,
      logo: f.comiteLogo,
    },
    persona: {
      nombre: f.personaNombre,
      rut: f.personaRut,
      cargo: f.personaCargo,
      contrato: f.contrato as "SUELDO" | "HONORARIO",
      afp: f.afp,
      porDia: f.porDia,
      valorDia: f.valorDia,
      fechaIngreso: f.fechaIngreso,
    },
    sueldoBase: f.sueldoBase,
    diasDescontados: f.diasDescontados,
    horasDescontadas: f.horasDescontadas,
    descAusencias: f.descAusencias,
    horasExtra: f.horasExtra,
    montoHorasExtra: f.montoHorasExtra,
    noImponible: f.noImponible,
    bonos: f.bonos,
    descAfp: f.descAfp,
    descSalud: f.descSalud,
    descCesantia: f.descCesantia,
    retencion: f.retencion,
    otrosDescuentos: f.otrosDescuentos,
    descuentos: f.descuentos,
    liquido: f.liquido,
    estado: f.estado as "PENDIENTE" | "LISTA" | "PAGADA",
    fechaPago: f.fechaPago,
    medio: f.medio,
    nota: f.nota,
  };
}
