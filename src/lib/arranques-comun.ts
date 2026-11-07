/** Lo de los arranques que no toca la base de datos: tipos. Lo usan pantallas del navegador. */

/** Un socio que un arranque abastece. */
export type SocioDeArranque = { id: string; nombre: string; numero: string | null };

export type ArranqueFila = {
  id: string;
  nombre: string;
  ubicacion: string | null;
  /** Su punto en el mapa, si se marcó. */
  lat: number | null;
  lng: number | null;
  notas: string | null;
  socios: SocioDeArranque[];
};

/** Un punto en el mapa. */
export type Punto = { lat: number; lng: number };

/** Enlace de ruta: abre Google Maps (o la app instalada) sin costo de API. */
export const linkRuta = (p: Punto) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

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
