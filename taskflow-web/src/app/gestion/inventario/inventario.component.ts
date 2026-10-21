import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SesionService } from '../../auth/sesion.service';
import { EstadoStock, FilaInventario } from '../../models/gestion.model';
import { SolesPipe } from '../../shared/soles.pipe';
import { GestionService, mensajeDeError } from '../gestion.service';

type Filtro = 'todos' | 'alerta' | 'agotados';

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Stock de la tienda con sus niveles. Desde aquí se pide reposición; el admin ajusta los niveles. */
@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [FormsModule, RouterLink, SolesPipe],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.scss',
})
export class InventarioComponent {
  readonly gestion = inject(GestionService);
  readonly sesion = inject(SesionService);

  readonly filas = signal<FilaInventario[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly filtro = signal<Filtro>('alerta');
  readonly busqueda = signal('');

  /** Fila con el formulario de pedido abierto, y la cantidad propuesta. */
  readonly pidiendo = signal<number | null>(null);
  cantidad = 1;
  /** Fila cuyos niveles está editando el admin. */
  readonly editando = signal<number | null>(null);
  minimo = 0;
  objetivo = 1;

  readonly conteo = computed(() => ({
    todos: this.filas().length,
    alerta: this.filas().filter((f) => f.estado !== 'OK').length,
    agotados: this.filas().filter((f) => f.estado === 'AGOTADO').length,
  }));

  readonly visibles = computed(() => {
    const texto = normalizar(this.busqueda().trim());
    return this.filas()
      .filter((f) => this.filtro() === 'todos' || (this.filtro() === 'agotados' ? f.estado === 'AGOTADO' : f.estado !== 'OK'))
      .filter((f) => !texto || normalizar(`${f.producto} ${f.categoria}`).includes(texto));
  });

  readonly todas = computed(() => this.gestion.tiendaActiva() == null);

  constructor() {
    effect(() => {
      this.gestion.tiendaActiva();
      untracked(() => this.cargar());
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.gestion.inventario().subscribe({
      next: (filas) => {
        this.filas.set(filas);
        this.cargando.set(false);
        this.error.set(null);
        if (this.conteo().alerta === 0 && this.filtro() === 'alerta') this.filtro.set('todos');
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(err, 'No se pudo cargar el inventario.'));
      },
    });
  }

  nivel(f: FilaInventario): number {
    return Math.min(100, Math.round((f.stock / f.stockObjetivo) * 100));
  }

  claseEstado(e: EstadoStock): string {
    return e === 'AGOTADO' ? 'rojo' : e === 'BAJO' ? 'ambar' : 'verde';
  }

  abrirPedido(f: FilaInventario): void {
    this.editando.set(null);
    this.cantidad = Math.max(1, f.stockObjetivo - f.stock);
    this.pidiendo.set(f.id);
  }

  pedir(f: FilaInventario): void {
    this.gestion.pedir({ productoId: f.productoId, cantidad: this.cantidad, tiendaId: f.tiendaId }).subscribe({
      next: (p) => {
        this.pidiendo.set(null);
        this.mostrarAviso(`Pedido #${p.id} enviado: ${p.cantidad} × ${p.productoNombre}. Queda esperando la aprobación del administrador.`);
        this.cargar();
      },
      error: (err) => this.error.set(mensajeDeError(err, 'No se pudo enviar el pedido.')),
    });
  }

  abrirNiveles(f: FilaInventario): void {
    this.pidiendo.set(null);
    this.minimo = f.stockMinimo;
    this.objetivo = f.stockObjetivo;
    this.editando.set(f.id);
  }

  guardarNiveles(f: FilaInventario): void {
    this.gestion.cambiarNiveles(f.id, this.minimo, this.objetivo).subscribe({
      next: () => {
        this.editando.set(null);
        this.mostrarAviso(`Niveles de ${f.producto} actualizados. Si quedó bajo el nuevo mínimo, ya tiene su tarea de reposición.`);
        this.cargar();
      },
      error: (err) => this.error.set(mensajeDeError(err, 'No se pudieron guardar los niveles.')),
    });
  }

  private mostrarAviso(texto: string): void {
    this.error.set(null);
    this.aviso.set(texto);
    setTimeout(() => this.aviso.set(null), 6000);
  }
}
