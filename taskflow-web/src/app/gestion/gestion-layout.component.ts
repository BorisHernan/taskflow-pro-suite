import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SesionService } from '../auth/sesion.service';
import { TaskService } from '../services/task.service';
import { IconoComponent } from '../shared/icono/icono.component';
import { NombreIcono } from '../shared/icono/iconos';
import { SelectorTemaComponent } from '../shared/ui/selector-tema.component';
import { GestionService } from './gestion.service';
import { TourService } from '../shared/tour/tour.service';
import { TourDemoService } from '../shared/tour/tour-demo.service';
import { EN_MONITOR } from '../shared/monitor/en-monitor';

interface Enlace {
  ruta: string;
  nombre: string;
  icono: NombreIcono;
}

interface Grupo {
  nombre: string;
  enlaces: Enlace[];
  soloAdmin?: boolean;
}

/** Marco de la gestión: barra lateral agrupada por áreas y barra superior con sede, conexión, tema y usuario. */
@Component({
  selector: 'app-gestion-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconoComponent, SelectorTemaComponent],
  templateUrl: './gestion-layout.component.html',
  styleUrl: './gestion-layout.component.scss',
})
export class GestionLayoutComponent {
  readonly sesion = inject(SesionService);
  readonly gestion = inject(GestionService);
  private readonly tareas = inject(TaskService);
  readonly tour = inject(TourService);
  // Registra la demo en vivo como recorrido de la gestión.
  private readonly demo = inject(TourDemoService);

  private readonly grupos: Grupo[] = [
    {
      nombre: 'Operación',
      enlaces: [
        { ruta: 'resumen', nombre: 'Resumen del día', icono: 'resumen' },
        { ruta: 'operaciones', nombre: 'Centro de operaciones', icono: 'sistema' },
        { ruta: 'tablero', nombre: 'Órdenes de trabajo', icono: 'tablero' },
        { ruta: 'personal', nombre: 'Personal', icono: 'usuarios' },
        { ruta: 'pedidos-online', nombre: 'Pedidos online', icono: 'carrito' },
        { ruta: 'turnos', nombre: 'Turnos', icono: 'reloj' },
      ],
    },
    {
      nombre: 'Inventario',
      enlaces: [
        { ruta: 'inventario', nombre: 'Stock', icono: 'inventario' },
        { ruta: 'compras', nombre: 'Compras', icono: 'envio' },
        { ruta: 'mermas', nombre: 'Mermas', icono: 'merma' },
      ],
    },
    {
      nombre: 'Control',
      enlaces: [{ ruta: 'incidencias', nombre: 'Incidencias', icono: 'incidencia' }],
    },
    {
      nombre: 'Análisis',
      soloAdmin: true,
      enlaces: [
        { ruta: 'estadisticas', nombre: 'Estadísticas', icono: 'estadisticas' },
        { ruta: 'reportes', nombre: 'Reportes', icono: 'descargar' },
      ],
    },
  ];

  readonly menu = computed(() => this.grupos.filter((g) => !g.soloAdmin || this.sesion.esAdmin()));
  readonly menuAbierto = signal(false);

  /** Estado de la conexión en tiempo real: solo se muestra cuando hay algo que contar. */
  readonly conexion = computed(() => {
    switch (this.tareas.conexion()) {
      case 'conectado':
        return { clase: 'en-vivo', texto: 'En vivo' };
      case 'reconectando':
        return { clase: 'problema', texto: 'Reconectando…' };
      case 'sin-permiso':
        return { clase: 'problema', texto: 'Sin sincronización' };
      default:
        return { clase: '', texto: 'Conectando…' };
    }
  });

  constructor() {
    // Mantiene abierta la conexión en tiempo real mientras se está en la gestión (una sola, compartida).
    this.tareas.streamUpdates().pipe(takeUntilDestroyed()).subscribe({ error: () => {} });
    // En móvil, el cajón se cierra al navegar.
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuAbierto.set(false));
    // La primera vez, se recomienda el recorrido (sin obligar).
    if (!EN_MONITOR) setTimeout(() => this.tour.ofrecerSiCorresponde(), 600);
  }

  elegir(valor: string): void {
    this.gestion.elegirTienda(valor ? Number(valor) : null);
  }
}
