import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SesionService } from '../../auth/sesion.service';
import { EstadoStock, FilaInventario } from '../../models/gestion.model';
import { SolesPipe } from '../../shared/soles.pipe';
import { IconoComponent } from '../../shared/icono/icono.component';
import { AvisosService } from '../../shared/ui/avisos.service';
import { EstadoVistaComponent } from '../../shared/ui/estado-vista.component';
import { GestionService, mensajeDeError } from '../gestion.service';

type Filtro = 'todos' | 'alerta' | 'agotados';
type Columna = 'producto' | 'stock' | 'cobertura' | 'tienda';
const POR_PAGINA = 20;

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Stock de la tienda con sus niveles. Desde aquí se pide reposición; el admin ajusta los niveles. */
@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [FormsModule, RouterLink, SolesPipe, IconoComponent, EstadoVistaComponent],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.scss',
})
export class InventarioComponent {
  readonly gestion = inject(GestionService);
  readonly sesion = inject(SesionService);
  private readonly avisos = inject(AvisosService);
  readonly orden = signal<{ columna: Columna; asc: boolean }>({ columna: 'cobertura', asc: true });
  readonly pagina = signal(1);
  readonly enviando = signal(false);

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

  readonly filtradas = computed(() => {
    const texto = normalizar(this.busqueda().trim());
    const { columna, asc } = this.orden();
    const valor = (f: FilaInventario): string | number =>
      columna === 'producto'
        ? normalizar(f.producto)
        : columna === 'stock'
          ? f.stock
          : columna === 'tienda'
            ? this.gestion.nombreTienda(f.tiendaId)
            : f.stock / Math.max(f.stockMinimo, 1);
    return this.filas()
      .filter((f) => this.filtro() === 'todos' || (this.filtro() === 'agotados' ? f.estado === 'AGOTADO' : f.estado !== 'OK'))
      .filter((f) => !texto || normalizar(`${f.producto} ${f.categoria} ${this.codigo(f)}`).includes(texto))
      .sort((a, b) => {
        const x = valor(a);
        const y = valor(b);
        const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return asc ? r : -r;
      });
  });
  readonly paginas = computed(() => Math.max(1, Math.ceil(this.filtradas().length / POR_PAGINA)));
  readonly visibles = computed(() => {
    const p = Math.min(this.pagina(), this.paginas());
    return this.filtradas().slice((p - 1) * POR_PAGINA, p * POR_PAGINA);
  });
  readonly rango = computed(() => {
    const total = this.filtradas().length;
    const p = Math.min(this.pagina(), this.paginas());
    return total ? `${(p - 1) * POR_PAGINA + 1}–${Math.min(p * POR_PAGINA, total)} de ${total}` : '0 productos';
  });

  readonly todas = computed(() => this.gestion.tiendaActiva() == null);

  constructor() {
    effect(() => {
      this.gestion.tiendaActiva();
      untracked(() => this.cargar());
    });
  }

  cargar(): void {
    if (!this.gestion.recargaSilenciosa()) this.cargando.set(true);
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

  /** Código del producto (su id en el catálogo), para buscar y referirse a él sin ambigüedad. */
  codigo(f: FilaInventario): string {
    return 'P-' + String(f.productoId).padStart(4, '0');
  }

  ordenarPor(columna: Columna): void {
    this.orden.update((o) => ({ columna, asc: o.columna === columna ? !o.asc : true }));
    this.pagina.set(1);
  }

  ordenDe(columna: Columna): 'ascending' | 'descending' | 'none' {
    const o = this.orden();
    return o.columna !== columna ? 'none' : o.asc ? 'ascending' : 'descending';
  }

  cambiarFiltro(f: Filtro): void {
    this.filtro.set(f);
    this.pagina.set(1);
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
    this.enviando.set(true);
    this.gestion.pedir({ productoId: f.productoId, cantidad: this.cantidad, tiendaId: f.tiendaId }).subscribe({
      next: (p) => {
        this.enviando.set(false);
        this.pidiendo.set(null);
        this.avisos.exito(`Pedido #${p.id} enviado: ${p.cantidad} × ${p.productoNombre}. Queda pendiente de aprobación.`);
        this.cargar();
      },
      error: (err) => {
        this.enviando.set(false);
        this.avisos.error(mensajeDeError(err, 'No se pudo enviar el pedido.'));
      },
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
        this.avisos.exito(`Niveles de ${f.producto} guardados. Si quedó bajo el nuevo mínimo, ya tiene su tarea de reposición.`);
        this.cargar();
      },
      error: (err) => this.avisos.error(mensajeDeError(err, 'No se pudieron guardar los niveles.')),
    });
  }

}
