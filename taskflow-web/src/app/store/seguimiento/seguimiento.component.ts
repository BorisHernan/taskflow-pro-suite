import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, map, switchMap, takeWhile, timer } from 'rxjs';
import { Tienda } from '../../models/gestion.model';
import { EstadoOrden, NOMBRE_ESTADO_ORDEN, OrdenVista, pasosDe } from '../../models/orden.model';
import { OrdenService } from '../../services/orden.service';
import { COBERTURA_KM, estimarEnvio, vehiculoPara } from '../../shared/entrega/entrega';
import { IconoComponent } from '../../shared/icono/icono.component';
import { MapaSedesComponent } from '../../shared/mapa/mapa-sedes.component';
import { SolesPipe } from '../../shared/soles.pipe';
import { mensajeDeError } from '../servicios/carrito.service';

/** Cuadros de la simulación: estado, avance en la ruta y cuánto dura (ms). */
type Cuadro = { estado: EstadoOrden; progreso: number; ms: number };

/** Seguimiento público de un pedido: pasos, mapa y refresco cada pocos segundos. */
@Component({
  selector: 'app-seguimiento',
  standalone: true,
  imports: [DatePipe, RouterLink, IconoComponent, MapaSedesComponent, SolesPipe],
  templateUrl: './seguimiento.component.html',
  styleUrl: './seguimiento.component.scss',
})
export class SeguimientoComponent {
  private readonly ordenes = inject(OrdenService);
  private readonly router = inject(Router);

  /** Viene de la ruta /tienda/pedido/:codigo. */
  readonly codigo = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => (p.get('codigo') ?? '').toUpperCase())), {
    initialValue: '',
  });
  readonly vista = signal<OrdenVista | null>(null);
  readonly error = signal<string | null>(null);
  readonly recientes = signal(this.ordenes.recientes());
  readonly nombreEstado = NOMBRE_ESTADO_ORDEN;
  readonly cobertura = COBERTURA_KM;
  buscado = '';

  /** Simulación en curso (null = se muestra el estado real). */
  readonly simulado = signal<{ estado: EstadoOrden; progreso: number } | null>(null);
  readonly simulacionTerminada = signal(false);
  private simulacion?: ReturnType<typeof setTimeout>;
  /** Reloj para mover el vehículo según el tiempo real del viaje. */
  private readonly ahora = signal(Date.now());

  readonly estado = computed<EstadoOrden | null>(() => this.simulado()?.estado ?? this.vista()?.orden.estado ?? null);
  readonly unidades = computed(() => this.vista()?.lineas.reduce((n, l) => n + l.cantidad, 0) ?? 0);
  readonly envio = computed(() => this.vista()?.orden.modalidad === 'ENVIO');

  readonly sede = computed(() => {
    const v = this.vista();
    return v?.tiendaLatitud != null && v.tiendaLongitud != null ? { lat: v.tiendaLatitud, lng: v.tiendaLongitud } : null;
  });

  readonly destino = computed(() => {
    const o = this.vista()?.orden;
    return o?.latitud != null && o.longitud != null ? { lat: o.latitud, lng: o.longitud } : null;
  });

  readonly estimado = computed(() => {
    const s = this.sede();
    const d = this.destino();
    return s && d ? estimarEnvio(s, d, this.unidades()) : null;
  });

  readonly vehiculo = computed(() => (this.envio() ? vehiculoPara(this.unidades()) : null));

  /** Dónde va el vehículo: en la sede hasta salir; en camino, según el tiempo transcurrido. */
  readonly progreso = computed<number | null>(() => {
    if (!this.envio()) return null;
    const sim = this.simulado();
    if (sim) return sim.progreso;
    const o = this.vista()?.orden;
    const e = this.estimado();
    if (!o || !e) return null;
    if (o.estado === 'ENTREGADA') return 1;
    if (o.estado !== 'EN_CAMINO') return 0;
    const transcurrido = (this.ahora() - new Date(o.actualizadaEn).getTime()) / 60000;
    // Avanza en saltos de 10 % y se queda cerca de la casa hasta que la sede confirme la entrega.
    return Math.min(0.9, Math.max(0.1, Math.floor((transcurrido / e.viajeMin) * 10) / 10));
  });

  readonly pasos = computed(() => {
    const v = this.vista();
    const estado = this.estado();
    if (!v || !estado) return [];
    const pasos = pasosDe(v.orden.modalidad);
    const actual = pasos.findIndex((p) => p.estado === estado);
    return pasos.map((p, i) => ({ ...p, hecho: i < actual || estado === 'ENTREGADA', actual: i === actual && estado !== 'ENTREGADA' }));
  });

  readonly tienda = computed<Tienda[]>(() => {
    const v = this.vista();
    const s = this.sede();
    if (!v || !s) return [];
    return [{ id: v.orden.tiendaId, codigo: '', nombre: v.tiendaNombre, distrito: v.tiendaNombre.replace(/^Tienda /, ''), latitud: s.lat, longitud: s.lng }];
  });

  private sondeo?: Subscription;

  constructor() {
    const reloj = setInterval(() => this.ahora.set(Date.now()), 5000);
    inject(DestroyRef).onDestroy(() => {
      this.sondeo?.unsubscribe();
      clearInterval(reloj);
      clearTimeout(this.simulacion);
    });
    effect(() => {
      const codigo = this.codigo();
      untracked(() => this.seguir(codigo));
    });
  }

  buscar(): void {
    const c = this.buscado.trim().toUpperCase();
    if (c) this.router.navigate(['/tienda/pedido', c]);
  }

  /** Recorre todos los estados en unos 12 s, solo en pantalla: el pedido real no cambia. */
  simular(): void {
    const v = this.vista();
    if (!v) return;
    const cuadros: Cuadro[] = [
      { estado: 'RECIBIDA', progreso: 0, ms: 1500 },
      { estado: 'PREPARANDO', progreso: 0, ms: 2500 },
    ];
    if (v.orden.modalidad === 'ENVIO') {
      for (let i = 1; i <= 10; i++) cuadros.push({ estado: 'EN_CAMINO', progreso: i / 10, ms: 650 });
    } else {
      cuadros.push({ estado: 'LISTA', progreso: 0, ms: 3500 });
    }
    cuadros.push({ estado: 'ENTREGADA', progreso: 1, ms: 0 });

    clearTimeout(this.simulacion);
    this.simulacionTerminada.set(false);
    const paso = (i: number) => {
      const c = cuadros[i];
      this.simulado.set({ estado: c.estado, progreso: c.progreso });
      if (i === cuadros.length - 1) this.simulacionTerminada.set(true);
      else this.simulacion = setTimeout(() => paso(i + 1), c.ms);
    };
    paso(0);
  }

  verEstadoReal(): void {
    clearTimeout(this.simulacion);
    this.simulado.set(null);
    this.simulacionTerminada.set(false);
  }

  private seguir(codigo: string): void {
    this.sondeo?.unsubscribe();
    this.verEstadoReal();
    this.vista.set(null);
    this.error.set(null);
    if (!codigo) return;
    // Consulta cada 5 s hasta que el pedido se entregue.
    this.sondeo = timer(0, 5000)
      .pipe(
        switchMap(() => this.ordenes.seguimiento(codigo)),
        takeWhile((v) => v.orden.estado !== 'ENTREGADA', true),
      )
      .subscribe({
        next: (v) => {
          this.vista.set(v);
          this.ordenes.recordar(v.orden.codigo);
          this.recientes.set(this.ordenes.recientes());
        },
        error: (err) => this.error.set(mensajeDeError(err, 'No se pudo consultar el pedido.')),
      });
  }
}
