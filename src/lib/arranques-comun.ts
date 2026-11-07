/** Lo de los arranques que no toca la base de datos: tipos. Lo usan pantallas del navegador. */

/** Un socio que un arranque abastece. */
export type SocioDeArranque = { id: string; nombre: string; numero: string | null };

export type ArranqueFila = {
  id: string;
  nombre: string;
  ubicacion: string | null;
  notas: string | null;
  socios: SocioDeArranque[];
};

/** Un socio que se puede asignar a un arranque, con el arranque que ya lo abastece (si tiene uno). */
export type SocioAsignable = {
  id: string;
  nombre: string;
  numero: string | null;
  rut: string | null;
  arranqueId: string | null;
};

export type DatosArranques = {
  arranques: ArranqueFila[];
  socios: SocioAsignable[];
  /** true si las tablas todavía no existen en la base de datos. */
  sinTablas: boolean;
};
