import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { mensajeDeError } from '../gestion/gestion.service';
import { IconoComponent } from '../shared/icono/icono.component';
import { PASOS_CLIENTE, TourService } from '../shared/tour/tour.service';
import { SesionService } from './sesion.service';
import { Region, VistaRolComponent } from './vista-rol.component';
import { SedesPresentacionComponent } from './sedes-presentacion.component';

interface Funcion {
  texto: string;
  /** Zona de la captura donde se ve esa función. */
  zona: Region;
  /** Otra captura para esta función (por defecto, la del rol). */
  imagen?: string;
}

interface Rol {
  clave: 'admin' | 'tienda' | 'cliente';
  nombre: string;
  resumen: string;
  imagen: string;
  alt: string;
  funciones: Funcion[];
}

interface Sede {
  usuario: string;
  tienda: string;
  encargado: string;
}

const CADA_MS = 2800;

/**
 * Login por rol. Cada tarjeta recorre sola su captura real, función por función,
 * como una cámara; al pasar por una función, la cámara va directo a ella.
 */
@Component({
  selector: 'app-ingresar',
  standalone: true,
  imports: [IconoComponent, VistaRolComponent, SedesPresentacionComponent],
  templateUrl: './ingresar.component.html',
  styleUrl: './ingresar.component.scss',
})
export class IngresarComponent {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly tour = inject(TourService);

  readonly roles: Rol[] = [
    {
      clave: 'admin',
      nombre: 'Administración',
      resumen: 'Supervisa toda la cadena y toma las decisiones que afectan a varias sedes.',
      imagen: 'img/gestion-resumen.png',
      alt: 'Vista de la administración: resumen del día con las tres sedes',
      funciones: [
        { texto: 'Compara las tres sedes en un solo panel', zona: { x: 264, y: 8, w: 1156, h: 314 } },
        { texto: 'Aprueba o rechaza los pedidos de reposición', zona: { x: 1040, y: 180, w: 180, h: 140 } },
        { texto: 'Controla el stock mínimo de cada producto', zona: { x: 272, y: 343, w: 562, h: 300 } },
        { texto: 'Consulta estadísticas y descarga reportes', zona: { x: 12, y: 446, w: 220, h: 100 } },
      ],
    },
    {
      clave: 'tienda',
      nombre: 'Encargado de tienda',
      resumen: 'Opera el día a día de una sede. Solo ve y modifica lo de su tienda.',
      imagen: 'img/rol-tienda.png',
      alt: 'Vista del encargado de tienda: tablero de tareas de su sede',
      funciones: [
        { texto: 'Atiende las tareas de su sede en tiempo real', zona: { x: 272, y: 330, w: 1140, h: 200 } },
        { texto: 'Pide reposición desde la misma tarea', zona: { x: 282, y: 374, w: 354, h: 150 } },
        { texto: 'Registra mermas e incidencias', zona: { x: 12, y: 320, w: 220, h: 110 } },
        { texto: 'Abre y cierra turnos con su checklist', zona: { x: 12, y: 168, w: 220, h: 36 } },
      ],
    },
    {
      clave: 'cliente',
      nombre: 'Cliente',
      resumen: 'Compra en la tienda online, sin crear cuenta. Su compra pone en marcha el trabajo de la tienda.',
      imagen: 'img/rol-cliente.png',
      alt: 'Vista del cliente: catálogo de la tienda online con el stock de la sede elegida',
      funciones: [
        { texto: 'Elige la sede donde retira su compra', zona: { x: 1000, y: 105, w: 312, h: 62 } },
        { texto: 'Ve el stock real de esa sede, en vivo', zona: { x: 128, y: 432, w: 224, h: 364 } },
        { texto: 'Elige recojo o envío y marca su casa en el mapa', zona: { x: 1036, y: 296, w: 390, h: 280 }, imagen: 'img/cliente-entrega.png' },
        { texto: 'Paga y sigue su pedido hasta la entrega', zona: { x: 190, y: 290, w: 1060, h: 360 }, imagen: 'img/cliente-seguimiento.png' },
      ],
    },
  ];

  readonly sedes: Sede[] = [
    { usuario: 'surco', tienda: 'Surco', encargado: 'Carlos Díaz' },
    { usuario: 'miraflores', tienda: 'Miraflores', encargado: 'Luis Quispe' },
    { usuario: 'sanisidro', tienda: 'San Isidro', encargado: 'María Rojas' },
  ];
  readonly sede = signal<Sede>(this.sedes[0]);

  /** Pestaña visible: así cada parte entra en una pantalla sin bajar. */
  readonly pestana = signal<'roles' | 'sedes'>('roles');

  /** Función resaltada en cada tarjeta (-1 = vista completa). */
  readonly activa = signal<Record<string, number>>({ admin: -1, tienda: -1, cliente: -1 });
  /** Mientras el usuario explora una tarjeta, su recorrido automático se pausa. */
  private readonly pausada = new Set<string>();

  readonly enviando = signal<string | null>(null);
  readonly error = signal<string | null>(
    this.ruta.snapshot.queryParamMap.get('motivo') === 'expirada' ? 'Tu sesión expiró. Vuelve a entrar.' : null,
  );

  constructor() {
    // Precarga las capturas extra para que el cambio de imagen no parpadee.
    for (const f of this.roles.flatMap((r) => r.funciones)) if (f.imagen) new Image().src = f.imagen;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Las tarjetas van desfasadas para que no se muevan a la vez.
    let tick = 0;
    const id = setInterval(() => {
      tick++;
      const rol = this.roles[tick % this.roles.length];
      if (this.pausada.has(rol.clave)) return;
      const actual = this.activa()[rol.clave];
      const siguiente = actual >= rol.funciones.length - 1 ? -1 : actual + 1;
      this.activa.update((a) => ({ ...a, [rol.clave]: siguiente }));
    }, CADA_MS / this.roles.length);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  imagenDe(rol: Rol): string {
    return rol.funciones[this.activa()[rol.clave]]?.imagen ?? rol.imagen;
  }

  zonaDe(rol: Rol): Region | null {
    return rol.funciones[this.activa()[rol.clave]]?.zona ?? null;
  }

  enfocar(rol: Rol, i: number): void {
    this.pausada.add(rol.clave);
    this.activa.update((a) => ({ ...a, [rol.clave]: i }));
  }

  soltar(rol: Rol): void {
    this.pausada.delete(rol.clave);
  }

  usuarioDe(rol: Rol): string {
    return rol.clave === 'admin' ? 'admin' : rol.clave === 'cliente' ? '' : this.sede().usuario;
  }

  personaDe(rol: Rol): string {
    return rol.clave === 'admin' ? 'Ana Torres' : rol.clave === 'cliente' ? 'Cualquier visitante' : this.sede().encargado;
  }

  entrar(rol: Rol, conRecorrido: boolean): void {
    // El cliente no inicia sesión: va directo a la tienda, con o sin recorrido.
    if (rol.clave === 'cliente') {
      if (conRecorrido) this.tour.iniciar(PASOS_CLIENTE);
      else this.router.navigateByUrl('/tienda');
      return;
    }
    const usuario = this.usuarioDe(rol);
    if (this.enviando()) return;
    this.enviando.set(usuario + (conRecorrido ? ':tour' : ''));
    this.error.set(null);
    this.sesion.ingresar(usuario, 'demo1234').subscribe({
      next: () => {
        this.tour.programar(conRecorrido);
        const volver = this.ruta.snapshot.queryParamMap.get('volver');
        this.router.navigateByUrl(conRecorrido ? '/gestion/resumen' : volver?.startsWith('/') ? volver : '/gestion');
      },
      error: (err) => {
        this.enviando.set(null);
        this.error.set(mensajeDeError(err, 'No se pudo iniciar sesión. El servidor gratuito puede estar despertando: reintenta en un minuto.'));
      },
    });
  }
}
