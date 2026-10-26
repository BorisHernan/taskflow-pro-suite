import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import type { IconNode } from 'lucide';
import { Punto, Tienda } from '../../models/gestion.model';
import { iconoSvg, puntoEnRuta } from '../entrega/entrega';

/**
 * Mapa de OpenStreetMap con las sedes. En modo "entrega", un clic marca la
 * casa del cliente y se traza la línea hasta la tienda elegida.
 * Leaflet se carga recién cuando el mapa aparece (no pesa en el resto de la app).
 */
@Component({
  selector: 'app-mapa-sedes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #lienzo class="lienzo" role="application" [attr.aria-label]="etiqueta()"></div>`,
  styleUrl: './mapa-sedes.component.scss',
})
export class MapaSedesComponent {
  readonly tiendas = input<Tienda[]>([]);
  readonly seleccionada = input<number | null>(null);
  readonly modo = input<'ver' | 'entrega'>('ver');
  readonly destino = input<Punto | null>(null);
  readonly etiqueta = input('Mapa con la ubicación de las tiendas');
  /** Vehículo del reparto y cuánto avanzó por la ruta (0 = en la sede, 1 = en la casa). */
  readonly vehiculo = input<IconNode | null>(null);
  readonly progreso = input<number | null>(null);

  readonly elegir = output<number>();
  readonly destinoCambio = output<Punto>();

  private readonly lienzo = viewChild.required<ElementRef<HTMLDivElement>>('lienzo');
  private L: typeof Leaflet | null = null;
  private mapa: Leaflet.Map | null = null;
  private capa: Leaflet.LayerGroup | null = null;
  private encuadrado = false;
  private ultimoDestino = '';

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(async () => {
      const L = (await import('leaflet')).default ?? (await import('leaflet'));
      this.L = L;
      const mapa = L.map(this.lienzo().nativeElement, { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView(
        [-12.11, -77.02],
        13,
      );
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa);
      mapa.on('click', (e: Leaflet.LeafletMouseEvent) => {
        if (this.modo() === 'entrega') this.destinoCambio.emit({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      this.mapa = mapa;
      this.capa = L.layerGroup().addTo(mapa);
      this.dibujar();
      // El contenedor puede cambiar de tamaño (panel que se abre, diálogo, ventana): el mapa se reacomoda.
      const observador = new ResizeObserver(() => {
        mapa.invalidateSize();
        // Si se dibujó estando oculto (por ejemplo, en el carrito cerrado), se encuadra al aparecer.
        if (!this.encuadrado) this.dibujar();
      });
      observador.observe(this.lienzo().nativeElement);
      destroyRef.onDestroy(() => {
        observador.disconnect();
        mapa.remove();
      });
    });

    // Redibuja cuando cambian las tiendas, la elegida o el destino.
    effect(() => {
      this.tiendas();
      this.seleccionada();
      this.destino();
      this.modo();
      this.vehiculo();
      this.progreso();
      this.dibujar();
    });
  }

  private dibujar(): void {
    const L = this.L;
    const capa = this.capa;
    if (!L || !capa || !this.mapa) return;
    capa.clearLayers();
    const puntos: Leaflet.LatLngExpression[] = [];
    let elegida: Tienda | undefined;

    for (const t of this.tiendas()) {
      if (t.latitud == null || t.longitud == null) continue;
      const activa = t.id === this.seleccionada();
      if (activa) elegida = t;
      const icono = L.divIcon({
        className: '',
        html: `<span class="pin${activa ? ' activo' : ''}"><span class="pin-punto"></span>${t.distrito}</span>`,
        iconSize: [0, 0],
      });
      const marcador = L.marker([t.latitud, t.longitud], { icon: icono, keyboard: true, title: t.nombre, riseOnHover: true })
        .on('click', () => this.elegir.emit(t.id))
        .addTo(capa);
      if (activa) marcador.setZIndexOffset(1000);
      puntos.push([t.latitud, t.longitud]);
    }

    const d = this.destino();
    if (d) {
      L.marker([d.lat, d.lng], {
        icon: L.divIcon({ className: '', html: '<span class="casa">Tu dirección</span>', iconSize: [0, 0] }),
      }).addTo(capa);
      puntos.push([d.lat, d.lng]);
      if (elegida?.latitud != null && elegida.longitud != null) {
        L.polyline([[elegida.latitud, elegida.longitud], [d.lat, d.lng]], { className: 'ruta', weight: 3, dashArray: '6 8' }).addTo(capa);
        const v = this.vehiculo();
        const t = this.progreso();
        if (v && t != null) {
          const p = puntoEnRuta({ lat: elegida.latitud, lng: elegida.longitud }, d, t);
          // Se crea de nuevo en cada avance: así la animación de salto se repite.
          L.marker([p.lat, p.lng], {
            icon: L.divIcon({ className: '', html: `<span class="vehiculo">${iconoSvg(v, 18)}</span>`, iconSize: [0, 0] }),
            zIndexOffset: 2000,
            interactive: false,
          }).addTo(capa);
        }
      }
    }

    // Encuadra todo la primera vez y cuando cambia el destino; no al elegir otra sede (no marea).
    const visible = this.lienzo().nativeElement.clientWidth > 0;
    const claveDestino = d ? `${d.lat},${d.lng}` : '';
    if (visible && puntos.length && (!this.encuadrado || claveDestino !== this.ultimoDestino)) {
      this.ultimoDestino = claveDestino;
      this.mapa.fitBounds(L.latLngBounds(puntos), { padding: [48, 48], maxZoom: 15, animate: this.encuadrado });
      this.encuadrado = true;
    }
  }
}
