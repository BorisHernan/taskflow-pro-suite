import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { FilaInventario, Merma, MotivoMerma, NOMBRE_MOTIVO } from '../../models/gestion.model';
import { SolesPipe } from '../../shared/soles.pipe';
import { GestionService, mensajeDeError } from '../gestion.service';

/** Mermas: lo que se pierde (dañado, vencido, robo, error de conteo). Descuentan stock y se valorizan al costo. */
@Component({
  selector: 'app-mermas',
  standalone: true,
  imports: [FormsModule, DatePipe, SolesPipe],
  templateUrl: './mermas.component.html',
  styleUrl: './mermas.component.scss',
})
export class MermasComponent {
  readonly gestion = inject(GestionService);
  readonly nombreMotivo = NOMBRE_MOTIVO;
  readonly motivos = Object.keys(NOMBRE_MOTIVO) as MotivoMerma[];

  readonly mermas = signal<Merma[]>([]);
  readonly productos = signal<FilaInventario[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  productoId: number | null = null;
  cantidad = 1;
  motivo: MotivoMerma = 'DANADO';
  nota = '';

  readonly todas = computed(() => this.gestion.tiendaActiva() == null);
  readonly total = computed(() => this.mermas().reduce((a, m) => a + Number(m.costo), 0));
  /** Costo por motivo, de mayor a menor: dónde se está perdiendo más. */
  readonly porMotivo = computed(() => {
    const suma = new Map<MotivoMerma, number>();
    for (const m of this.mermas()) suma.set(m.motivo, (suma.get(m.motivo) ?? 0) + Number(m.costo));
    const max = Math.max(1, ...suma.values());
    return [...suma]
      .map(([motivo, costo]) => ({ motivo, costo, ancho: (costo / max) * 100 }))
      .sort((a, b) => b.costo - a.costo);
  });
  readonly stockElegido = computed(() => this.productos().find((p) => p.productoId === this.productoIdSenal())?.stock ?? null);
  private readonly productoIdSenal = signal<number | null>(null);

  constructor() {
    effect(() => {
      this.gestion.tiendaActiva();
      untracked(() => this.cargar());
    });
  }

  cargar(): void {
    this.cargando.set(true);
    forkJoin({ mermas: this.gestion.mermas(), inventario: this.gestion.inventario() }).subscribe({
      next: ({ mermas, inventario }) => {
        this.mermas.set(mermas);
        this.productos.set(inventario.filter((f) => f.stock > 0).sort((a, b) => a.producto.localeCompare(b.producto)));
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(err, 'No se pudieron cargar las mermas.'));
      },
    });
  }

  elegirProducto(id: number): void {
    this.productoId = id;
    this.productoIdSenal.set(id);
  }

  registrar(): void {
    if (!this.productoId) return;
    this.gestion
      .registrarMerma({ productoId: this.productoId, cantidad: this.cantidad, motivo: this.motivo, nota: this.nota.trim() || undefined })
      .subscribe({
        next: (m) => {
          const extra = m.motivo === 'ROBO' ? ' Se abrió una incidencia de seguridad.' : '';
          this.aviso.set(`Merma registrada: ${m.cantidad} × ${m.productoNombre} (${this.nombreMotivo[m.motivo].toLowerCase()}).${extra}`);
          setTimeout(() => this.aviso.set(null), 7000);
          this.error.set(null);
          this.productoId = null;
          this.productoIdSenal.set(null);
          this.cantidad = 1;
          this.nota = '';
          this.cargar();
        },
        error: (err) => this.error.set(mensajeDeError(err, 'No se pudo registrar la merma.')),
      });
  }
}
