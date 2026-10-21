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
