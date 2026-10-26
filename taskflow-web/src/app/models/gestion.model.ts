export type Rol = 'ADMIN' | 'TIENDA';

export interface Perfil {
  usuario: string;
  nombre: string;
  rol: Rol;
  tiendaId: number | null;
  tiendaNombre: string;
}

export interface Sesion {
  token: string;
  expira: string;
  usuario: Perfil;
}

export interface Tienda {
  id: number;
  codigo: string;
  nombre: string;
  distrito: string;
  direccion?: string;
  latitud?: number;
  longitud?: number;
  horario?: string;
  enfoque?: string;
}

export interface Punto {
  lat: number;
  lng: number;
}

/** Distancia en línea recta entre dos puntos (fórmula del haversine), en km. */
export function distanciaKm(a: Punto, b: Punto): number {
  const r = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export type EstadoStock = 'AGOTADO' | 'BAJO' | 'OK';

export interface FilaInventario {
  id: number;
  tiendaId: number;
  productoId: number;
  producto: string;
  categoria: string;
  icono: string;
  precio: number;
  stock: number;
  stockMinimo: number;
  stockObjetivo: number;
  /** Unidades en el almacén de la tienda, para reponer el piso. */
  almacen: number;
  estado: EstadoStock;
  pedidoEnCurso: boolean;
}

export type TipoTurno = 'MANANA' | 'TARDE' | 'NOCHE';

export interface Turno {
  id: number;
  tiendaId: number;
  tipo: TipoTurno;
  responsable: string;
  estado: 'ABIERTO' | 'CERRADO';
  notaApertura?: string;
  notaCierre?: string;
  abiertoPor: string;
  cerradoPor?: string;
  inicio: string;
  fin?: string;
}

export interface ResumenTurno {
  turno: Turno;
  ventas: number;
  unidades: number;
  ingresos: number;
  mermas: number;
  costoMermas: number;
  incidencias: number;
  tareas: number;
  tareasHechas: number;
  pendientes: string[];
}

export type MotivoMerma = 'DANADO' | 'VENCIDO' | 'ROBO' | 'ERROR_INVENTARIO' | 'OTRO';

export interface Merma {
  id: number;
  tiendaId: number;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  motivo: MotivoMerma;
  costo: number;
  nota?: string;
  registradoPor: string;
  creadaEn: string;
}

export type Severidad = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
export type EstadoIncidencia = 'ABIERTA' | 'EN_CURSO' | 'RESUELTA';
export type CategoriaIncidencia = 'EQUIPOS' | 'LIMPIEZA' | 'SEGURIDAD' | 'CLIENTE' | 'SISTEMAS' | 'OTRO';

export interface Incidencia {
  id: number;
  tiendaId: number;
  titulo: string;
  descripcion?: string;
  categoria: CategoriaIncidencia;
  severidad: Severidad;
  estado: EstadoIncidencia;
  solucion?: string;
  tareaId?: number;
  reportadaPor: string;
  creadaEn: string;
  resueltaEn?: string;
}

export type EstadoPedido = 'SOLICITADO' | 'APROBADO' | 'RECIBIDO' | 'RECHAZADO';

export interface Pedido {
  id: number;
  tiendaId: number;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  costo: number;
  estado: EstadoPedido;
  nota?: string;
  tareaId?: number;
  solicitadoPor: string;
  revisadoPor?: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ResumenTienda {
  tiendaId: number;
  codigo: string;
  nombre: string;
  ventasHoy: number;
  comprasHoy: number;
  alertas: number;
  agotados: number;
  incidenciasAbiertas: number;
  tareasAbiertas: number;
  tareasUrgentes: number;
  mermasMes: number;
  pedidosEnCurso: number;
  turnoResponsable: string | null;
}

export interface Venta {
  id: number;
  tiendaId: number;
  producto: string;
  categoria: string;
  cantidad: number;
  total: number;
  fecha: string;
}

export interface VentaDia {
  fecha: string;
  unidades: number;
  ingresos: number;
}

export const NOMBRE_TURNO: Record<TipoTurno, string> = { MANANA: 'Mañana', TARDE: 'Tarde', NOCHE: 'Noche' };

export const NOMBRE_MOTIVO: Record<MotivoMerma, string> = {
  DANADO: 'Dañado',
  VENCIDO: 'Vencido',
  ROBO: 'Robo',
  ERROR_INVENTARIO: 'Error de inventario',
  OTRO: 'Otro',
};

export const NOMBRE_SEVERIDAD: Record<Severidad, string> = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta', CRITICA: 'Crítica' };

export const NOMBRE_ESTADO_INCIDENCIA: Record<EstadoIncidencia, string> = {
  ABIERTA: 'Abierta',
  EN_CURSO: 'En curso',
  RESUELTA: 'Resuelta',
};

export const NOMBRE_CATEGORIA: Record<CategoriaIncidencia, string> = {
  EQUIPOS: 'Equipos',
  LIMPIEZA: 'Limpieza',
  SEGURIDAD: 'Seguridad',
  CLIENTE: 'Cliente',
  SISTEMAS: 'Sistemas',
  OTRO: 'Otro',
};

export const NOMBRE_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  SOLICITADO: 'Por aprobar',
  APROBADO: 'En camino',
  RECIBIDO: 'Recibido',
  RECHAZADO: 'Rechazado',
};

export type Puesto = 'REPONEDOR' | 'CAJERO' | 'REPARTIDOR' | 'ALMACENERO';
export type EstadoPersona = 'TRABAJANDO' | 'DISPONIBLE' | 'FUERA_DE_TURNO' | 'LIBRE_HOY' | 'AUSENTE';
export type TipoAusencia = 'DESCANSO_MEDICO' | 'VACACIONES' | 'PERMISO' | 'DESCANSO' | 'FALTA';
export type PuestoTienda = 'CAJA_1' | 'CAJA_2' | 'CAJA_3' | 'CAJA_4' | 'CAJA_5' | 'ENTRADA' | 'PASILLOS' | 'ALMACEN' | 'DESPACHO';

/** Persona de la sede con su estado en este momento. */
export interface Empleado {
  id: number;
  tiendaId: number;
  nombre: string;
  puesto: Puesto;
  turno: TipoTurno;
  horario: string;
  estado: EstadoPersona;
  disponibilidad: 'ACTIVO' | TipoAusencia;
  motivo?: string | null;
  ausenteDesde?: string | null;
  ausenteHasta?: string | null;
  /** Porcentaje del turno ya trabajado. */
  avanceTurno: number;
  tareaId?: number | null;
  tareaTitulo?: string | null;
  tareaAsignadaEn?: string | null;
  tareaMinutos?: number | null;
  /** Dónde está dentro de la tienda (solo si trabaja ahora). */
  puestoActual?: PuestoTienda | null;
  puestoDesde?: string | null;
  /** Día libre de la semana: 1 = lunes … 7 = domingo. */
  diaLibre?: number | null;
}

/** Aviso enviado a una persona: qué debe hacer. */
export interface AvisoPersonal {
  id: number;
  empleadoId?: number | null;
  empleado?: string | null;
  mensaje: string;
  creadoEn: string;
}

export const NOMBRE_PUESTO_TIENDA: Record<PuestoTienda, string> = {
  CAJA_1: 'Caja 1',
  CAJA_2: 'Caja 2',
  CAJA_3: 'Caja 3',
  CAJA_4: 'Caja 4',
  CAJA_5: 'Caja 5',
  ENTRADA: 'Entrada y seguridad',
  PASILLOS: 'Pasillos · reposición',
  ALMACEN: 'Almacén',
  DESPACHO: 'Despacho online',
};

/** En plural, para frases como "libre los domingos". */
export const DIAS_SEMANA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];

export const NOMBRE_PUESTO: Record<Puesto, string> = {
  REPONEDOR: 'Reponedor',
  CAJERO: 'Cajero',
  REPARTIDOR: 'Repartidor',
  ALMACENERO: 'Almacenero',
};

export const NOMBRE_ESTADO_PERSONA: Record<EstadoPersona, string> = {
  TRABAJANDO: 'Trabajando',
  DISPONIBLE: 'Disponible',
  FUERA_DE_TURNO: 'Fuera de turno',
  LIBRE_HOY: 'Libre hoy',
  AUSENTE: 'Ausente',
};

export const NOMBRE_AUSENCIA: Record<TipoAusencia, string> = {
  DESCANSO_MEDICO: 'Descanso médico',
  VACACIONES: 'Vacaciones',
  PERMISO: 'Permiso',
  DESCANSO: 'Día libre',
  FALTA: 'No vino',
};

/** Avance de una tarea asignada según el tiempo estimado (0 a 100). */
export function avanceDe(asignadaEn: string | null | undefined, minutos: number | null | undefined, ahora: number): number {
  if (!asignadaEn || !minutos) return 0;
  const pasado = (ahora - new Date(asignadaEn).getTime()) / (minutos * 60000);
  return Math.max(0, Math.min(100, Math.round(pasado * 100)));
}
