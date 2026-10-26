export type Modalidad = 'RECOJO' | 'ENVIO';
export type EstadoOrden = 'RECIBIDA' | 'PREPARANDO' | 'LISTA' | 'EN_CAMINO' | 'ENTREGADA' | 'CANCELADA';

export interface Orden {
  id: number;
  codigo: string;
  tiendaId: number;
  clienteNombre: string;
  modalidad: Modalidad;
  direccion?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  distanciaKm?: number | null;
  subtotal: number;
  descuento: number;
  total: number;
  cupon?: string | null;
  estado: EstadoOrden;
  tareaId?: number | null;
  creadaEn: string;
  actualizadaEn: string;
}

export interface OrdenVista {
  orden: Orden;
  lineas: { producto: string; cantidad: number; total: number; fecha: string }[];
  tiendaNombre: string;
  tiendaDireccion?: string;
  tiendaLatitud?: number;
  tiendaLongitud?: number;
}

export interface NuevaOrden {
  tiendaId: number;
  clienteNombre: string;
  modalidad: Modalidad;
  direccion?: string;
  latitud?: number;
  longitud?: number;
  cupon?: string;
  lineas: { productoId: number; cantidad: number }[];
}

export interface PasoOrden {
  estado: EstadoOrden;
  nombre: string;
  detalle: string;
}

/** Pasos que ve el cliente según cómo recibe su pedido. */
export function pasosDe(modalidad: Modalidad): PasoOrden[] {
  const final: PasoOrden[] =
    modalidad === 'ENVIO'
      ? [
          { estado: 'EN_CAMINO', nombre: 'En camino', detalle: 'El repartidor salió de la tienda.' },
          { estado: 'ENTREGADA', nombre: 'Entregado', detalle: 'Llegó a tu dirección.' },
        ]
      : [
          { estado: 'LISTA', nombre: 'Listo para recoger', detalle: 'Acércate a la tienda con tu código.' },
          { estado: 'ENTREGADA', nombre: 'Recogido', detalle: 'Retiraste tu pedido.' },
        ];
  return [
    { estado: 'RECIBIDA', nombre: 'Recibido', detalle: 'El pago se registró y la tienda ya tiene la tarea.' },
    { estado: 'PREPARANDO', nombre: 'Preparando', detalle: 'El equipo junta tus productos.' },
    ...final,
  ];
}

/** Siguiente estado que puede marcar la tienda, o null si ya terminó. */
export function siguienteEstado(o: Orden): { estado: EstadoOrden; accion: string } | null {
  switch (o.estado) {
    case 'RECIBIDA':
      return { estado: 'PREPARANDO', accion: 'Empezar a preparar' };
    case 'PREPARANDO':
      return o.modalidad === 'ENVIO' ? { estado: 'EN_CAMINO', accion: 'Despachar' } : { estado: 'LISTA', accion: 'Marcar listo para recoger' };
    case 'LISTA':
      return { estado: 'ENTREGADA', accion: 'Entregado al cliente' };
    case 'EN_CAMINO':
      return { estado: 'ENTREGADA', accion: 'Confirmar entrega' };
    default:
      return null;
  }
}

export const NOMBRE_ESTADO_ORDEN: Record<EstadoOrden, string> = {
  RECIBIDA: 'Recibido',
  PREPARANDO: 'Preparando',
  LISTA: 'Listo para recoger',
  EN_CAMINO: 'En camino',
  ENTREGADA: 'Entregado',
  CANCELADA: 'Cancelado',
};
