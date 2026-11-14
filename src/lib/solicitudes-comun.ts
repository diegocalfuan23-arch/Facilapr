/** Lo de las solicitudes de los socios que también usa el navegador: tipos, sin base de datos. */

export type EstadoSolicitud = "PENDIENTE" | "APROBADA" | "RECHAZADA";

/** Un socio que pidió acceso a su cuenta en línea. */
export type Solicitud = {
  id: string;
  nombre: string;
  rut: string | null;
  estado: EstadoSolicitud;
  motivoRechazo: string | null;
  createdAt: Date;
};

/** Un socio que no puede entrar y pidió una clave nueva. */
export type SolicitudClaveFila = {
  id: string;
  socioId: string;
  nombre: string;
  rut: string | null;
  telefono: string | null;
  createdAt: Date;
};

export type DatosSolicitudes = {
  solicitudes: Solicitud[];
  clavesPedidas: SolicitudClaveFila[];
  /** El comité no tiene correo en Configuración: no le llegan los avisos de estas solicitudes. */
  sinCorreo: boolean;
};
