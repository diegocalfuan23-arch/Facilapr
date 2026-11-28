/** Qué lleva en la boleta electrónica cada boleta del comité, y cuáles todavía no se pueden emitir. Sin base de datos. */

import { formatearPeriodo } from "@/lib/boletas";
import type { DatosBoleta } from "@/lib/sii/dte/boleta";
import { rutSii, texto } from "@/lib/sii/dte/xml";

export type BoletaPorEmitir = {
  periodo: string;
  montoTotal: number;
  montoSubsidio: number;
  cargoFijo: number | null;
  valorM3: number | null;
  consumoM3: number | null;
  observacion: string | null;
  socio: { nombre: string; rut: string | null; direccion: string | null; numeroCliente: string | null };
};

/** Por qué esta boleta no se emite; null si se puede. Se revisa antes de gastar un folio. */
export function motivoParaNoEmitir(b: BoletaPorEmitir): string | null {
  // Una deuda de antes puede tener ya su documento: emitirla la declararía dos veces.
  if (b.observacion === "Deuda anterior") return "Es una deuda anterior";
  // Falta definir cómo se declara la parte que paga la municipalidad.
  if (b.montoSubsidio > 0) return "Tiene subsidio";
  if (b.montoTotal <= 0) return "Monto en cero";
  if (!b.socio.rut || !rutSii(b.socio.rut)) return "Falta el RUT";
  if (!texto(b.socio.direccion ?? "", 70)) return "Falta la dirección";
  return null;
}

/** El detalle: cargo fijo y consumo cuando suman el total; si el monto se escribió a mano, una sola línea. */
export function lineasDeBoleta(b: BoletaPorEmitir): DatosBoleta["items"] {
  const consumo = `Consumo de agua ${formatearPeriodo(b.periodo)}`;
  const { cargoFijo, valorM3, consumoM3 } = b;
  if (cargoFijo !== null && valorM3 !== null && consumoM3 !== null && consumoM3 >= 0 && cargoFijo + consumoM3 * valorM3 === b.montoTotal) {
    return [
      ...(cargoFijo > 0 ? [{ nombre: "Cargo fijo", monto: cargoFijo }] : []),
      // Sin consumo no hay cantidad que mostrar: el SII no acepta cantidades en cero.
      ...(consumoM3 > 0 && valorM3 > 0 ? [{ nombre: consumo, monto: consumoM3 * valorM3, cantidad: consumoM3, precio: valorM3, unidad: "m3" }] : []),
    ];
  }
  return [{ nombre: consumo, monto: b.montoTotal }];
}
