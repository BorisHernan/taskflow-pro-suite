import { Car, IconNode, Motorbike, Truck } from 'lucide';
import { Punto, distanciaKm } from '../../models/gestion.model';

/** Radio de reparto desde la sede (el servidor aplica el mismo límite). */
export const COBERTURA_KM = 15;
/** Las calles no van en línea recta: factor simple para estimar el recorrido real. */
const FACTOR_CALLES = 1.3;
const PREPARACION_MIN = 20;

export type TipoVehiculo = 'moto' | 'auto' | 'camion';

export interface Vehiculo {
  tipo: TipoVehiculo;
  nombre: string;
  regla: string;
  velocidadKmh: number;
  icono: IconNode;
}

export const VEHICULOS: Record<TipoVehiculo, Vehiculo> = {
  moto: { tipo: 'moto', nombre: 'Moto', regla: 'hasta 8 unidades', velocidadKmh: 28, icono: Motorbike },
  auto: { tipo: 'auto', nombre: 'Auto', regla: 'de 9 a 12 unidades', velocidadKmh: 22, icono: Car },
  camion: { tipo: 'camion', nombre: 'Camión', regla: '13 unidades o más', velocidadKmh: 18, icono: Truck },
};

/** El vehículo depende del tamaño del pedido. */
export function vehiculoPara(unidades: number): Vehiculo {
  return unidades <= 8 ? VEHICULOS.moto : unidades <= 12 ? VEHICULOS.auto : VEHICULOS.camion;
}

export interface Estimado {
  lineaRectaKm: number;
  recorridoKm: number;
  /** Solo el viaje, sin la preparación. */
  viajeMin: number;
  /** Preparación más viaje. */
  minutos: number;
  vehiculo: Vehiculo;
  enCobertura: boolean;
}

export function estimarEnvio(sede: Punto, destino: Punto, unidades: number): Estimado {
  const recta = distanciaKm(sede, destino);
  const recorrido = recta * FACTOR_CALLES;
  const vehiculo = vehiculoPara(unidades);
  const viajeMin = Math.max(3, Math.round((recorrido / vehiculo.velocidadKmh) * 60));
  return {
    lineaRectaKm: redondear(recta),
    recorridoKm: redondear(recorrido),
    viajeMin,
    minutos: PREPARACION_MIN + viajeMin,
    vehiculo,
    enCobertura: recta <= COBERTURA_KM,
  };
}

/** Punto de ejemplo cerca de la sede, para cuando la ubicación real queda fuera de Lima. */
export function puntoDeEjemplo(sede: Punto): Punto {
  return { lat: sede.lat - 0.011, lng: sede.lng + 0.013 };
}

/** Punto de la ruta recta entre a y b (t de 0 a 1). */
export function puntoEnRuta(a: Punto, b: Punto, t: number): Punto {
  const k = Math.min(1, Math.max(0, t));
  return { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k };
}

/** SVG de un icono de lucide como texto, para marcadores HTML del mapa. */
export function iconoSvg(icono: IconNode, tamano = 18): string {
  const hijos = icono
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamano}" height="${tamano}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${hijos}</svg>`;
}

function redondear(km: number): number {
  return Math.round(km * 10) / 10;
}
