import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { IconoComponent } from '../../shared/icono/icono.component';
import { SolesPipe } from '../../shared/soles.pipe';
import { ProductIconComponent } from '../product-icon/product-icon.component';
import { CatalogoService } from '../servicios/catalogo.service';
import { fotosDe } from '../fotos-productos';
import { DEPARTAMENTOS } from '../categorias';

/** Botón "Menú" de la cabecera: departamentos, subcategorías con su cantidad y las ofertas del departamento. */
@Component({
  selector: 'app-menu-categorias',
  standalone: true,
  imports: [RouterLink, IconoComponent, ProductIconComponent, SolesPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-categorias.component.html',
  styleUrl: './menu-categorias.component.scss',
})
export class MenuCategoriasComponent {
  private readonly catalogo = inject(CatalogoService);
  readonly departamentos = DEPARTAMENTOS;
  readonly fotosDe = fotosDe;
  readonly abierto = signal(false);
  readonly activo = signal(DEPARTAMENTOS[0].nombre);
  readonly actual = computed(() => DEPARTAMENTOS.find((d) => d.nombre === this.activo()) ?? DEPARTAMENTOS[0]);

  private readonly deLaSede = computed(() => this.catalogo.productos().filter((p) => p.category === this.actual().nombre));
  readonly cargado = this.catalogo.cargado;
  readonly total = computed(() => this.deLaSede().length);
  readonly subs = computed(() => {
    const por = new Map<string, { total: number; icono: string }>();
    for (const p of this.deLaSede()) {
      const k = p.subcategory ?? '';
      const a = por.get(k) ?? { total: 0, icono: p.icon || this.actual().icono };
      por.set(k, { ...a, total: a.total + 1 });
    }
    return this.actual().subs.map((nombre) => ({ nombre, total: por.get(nombre)?.total ?? 0, icono: por.get(nombre)?.icono ?? this.actual().icono }));
  });
  private static descuento(p: { price: number; listPrice?: number }): number {
    return p.listPrice && p.listPrice > p.price ? Math.round((1 - p.price / p.listPrice) * 100) : 0;
  }
  /** Cuatro productos del departamento: primero los que están en oferta, de mayor a menor descuento. */
  readonly destacados = computed(() =>
    [...this.deLaSede()]
      .sort((a, b) => MenuCategoriasComponent.descuento(b) - MenuCategoriasComponent.descuento(a))
      .slice(0, 4)
      .map((p) => ({ ...p, descuento: MenuCategoriasComponent.descuento(p) })),
  );
  readonly descuentoMax = computed(() => this.destacados()[0]?.descuento ?? 0);

  constructor() {
    const navegando = toSignal(inject(Router).events.pipe(filter((e) => e instanceof NavigationStart)));
    effect(() => {
      if (navegando()) this.abierto.set(false);
    });
  }

  alternar(): void {
    this.abierto.update((v) => !v);
    if (this.abierto()) this.catalogo.cargar();
  }

  @HostListener('document:keydown.escape')
  cerrar(): void {
    this.abierto.set(false);
  }
}
