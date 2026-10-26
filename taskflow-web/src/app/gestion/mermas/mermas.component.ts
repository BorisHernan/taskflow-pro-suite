import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { FilaInventario, Incidencia, Merma, MotivoMerma, NOMBRE_MOTIVO } from '../../models/gestion.model';
import { IconoComponent } from '../../shared/icono/icono.component';
import { SolesPipe } from '../../shared/soles.pipe';
import { AvisosService } from '../../shared/ui/avisos.service';
import { ConfirmacionService } from '../../shared/ui/confirmacion.service';
import { EstadoVistaComponent } from '../../shared/ui/estado-vista.component';
import { GestionService, mensajeDeError } from '../gestion.service';

/** Mermas: lo que se pierde (dañado, vencido, robo, error de conteo). Descuentan stock y se valorizan al costo. */
@Component({
  selector: 'app-mermas',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink, SolesPipe, IconoComponent, EstadoVistaComponent],
  templateUrl: './mermas.component.html',
  styleUrl: './mermas.component.scss',
})
export class MermasComponent {
  readonly gestion = inject(GestionService);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacion = inject(ConfirmacionService);
  readonly nombreMotivo = NOMBRE_MOTIVO;
  readonly motivos = Object.keys(NOMBRE_MOTIVO) as MotivoMerma[];

  readonly mermas = signal<Merma[]>([]);
  readonly productos = signal<FilaInventario[]>([]);
  readonly incidencias = signal<Incidencia[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly enviando = signal(false);

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
    return [...suma].map(([motivo, costo]) => ({ motivo, costo, ancho: (costo / max) * 100 })).sort((a, b) => b.costo - a.costo);
  });
  private readonly productoIdSenal = signal<number | null>(null);
  readonly elegido = computed(() => this.productos().find((p) => p.productoId === this.productoIdSenal()) ?? null);

  constructor() {
    effect(() => {
      this.gestion.tiendaActiva();
      this.gestion.cambios();
      untracked(() => this.cargar());
    });
  }

  cargar(): void {
    if (!this.gestion.recargaSilenciosa()) this.cargando.set(true);
    forkJoin({ mermas: this.gestion.mermas(), inventario: this.gestion.inventario(), incidencias: this.gestion.incidencias() }).subscribe({
      next: ({ mermas, inventario, incidencias }) => {
        this.mermas.set(mermas);
        this.incidencias.set(incidencias);
        this.productos.set(inventario.filter((f) => f.stock > 0).sort((a, b) => a.producto.localeCompare(b.producto)));
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(err, 'No se pudieron cargar las mermas.'));
      },
    });
  }

  /** Incidencia de seguridad que el backend abrió para una merma por robo (la menciona en su descripción). */
  incidenciaDe(m: Merma): Incidencia | null {
    if (m.motivo !== 'ROBO') return null;
    return this.incidencias().find((i) => i.descripcion?.includes(`merma #${m.id}.`)) ?? null;
  }

  elegirProducto(id: number): void {
    this.productoId = id;
    this.productoIdSenal.set(id);
  }

  async registrar(): Promise<void> {
    const f = this.elegido();
    if (!f) return;
    const robo = this.motivo === 'ROBO';
    const r = await this.confirmacion.pedir({
      titulo: 'Registrar merma',
      detalle:
        `Se descontarán ${this.cantidad} unidades de ${f.producto} (stock actual: ${f.stock}) por ${this.nombreMotivo[this.motivo].toLowerCase()}. ` +
        (robo ? 'También se abrirá una incidencia de seguridad con su tarea. ' : '') +
        'Este movimiento no se puede deshacer desde la aplicación.',
      confirmar: 'Registrar merma',
      peligro: true,
    });
    if (!r.ok) return;

    this.enviando.set(true);
    this.gestion
      .registrarMerma({ productoId: f.productoId, cantidad: this.cantidad, motivo: this.motivo, nota: this.nota.trim() || undefined })
      .subscribe({
        next: (m) => {
          this.enviando.set(false);
          const extra = m.motivo === 'ROBO' ? ' Se abrió una incidencia de seguridad.' : '';
          this.avisos.exito(`Merma #${m.id} registrada: ${m.cantidad} × ${m.productoNombre}.${extra}`);
          this.productoId = null;
          this.productoIdSenal.set(null);
          this.cantidad = 1;
          this.nota = '';
          this.cargar();
        },
        error: (err) => {
          this.enviando.set(false);
          this.avisos.error(mensajeDeError(err, 'No se pudo registrar la merma.'));
        },
      });
  }
}
