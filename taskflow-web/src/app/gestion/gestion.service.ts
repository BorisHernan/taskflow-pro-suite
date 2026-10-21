import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, map, shareReplay } from 'rxjs';
import { API_BASE, SesionService } from '../auth/sesion.service';
import {
  FilaInventario,
  Incidencia,
  Merma,
  Pedido,
  ResumenTienda,
  ResumenTurno,
  Tienda,
  Turno,
  Venta,
  VentaDia,
} from '../models/gestion.model';

const CLAVE_TIENDA = 'taskflow-tienda-admin';

/** Llamadas a la API de gestión. El filtro de tienda solo lo usa el admin; el servidor ignora el resto. */
@Injectable({ providedIn: 'root' })
export class GestionService {
  private readonly http = inject(HttpClient);
  private readonly sesion = inject(SesionService);
  private readonly api = `${API_BASE}/api`;

  /** Tienda que el admin está mirando (null = todas). Para una tienda, siempre la suya. */
  private readonly elegidaPorAdmin = signal<number | null>(leerTienda());
  readonly tiendaActiva = computed(() =>
    this.sesion.esAdmin() ? this.elegidaPorAdmin() : (this.sesion.usuario()?.tiendaId ?? null),
  );

  readonly tiendas$ = this.http.get<Tienda[]>(`${this.api}/tiendas`).pipe(shareReplay(1));
  readonly tiendas = toSignal(this.tiendas$, { initialValue: [] as Tienda[] });

  nombreTienda(id: number | null | undefined): string {
    return this.tiendas().find((t) => t.id === id)?.nombre ?? '';
  }

  elegirTienda(id: number | null): void {
    this.elegidaPorAdmin.set(id);
    try {
      localStorage.setItem(CLAVE_TIENDA, id == null ? '' : String(id));
    } catch {}
  }

  private params(): HttpParams {
    const t = this.tiendaActiva();
    return t == null ? new HttpParams() : new HttpParams().set('tienda', t);
  }

  resumen(): Observable<ResumenTienda[]> {
    return this.http.get<ResumenTienda[]>(`${this.api}/resumen`, { params: this.params() });
  }

  ventas(): Observable<Venta[]> {
    return this.http.get<Venta[]>(`${this.api}/ventas`, { params: this.params() });
  }

  ventasPorDia(): Observable<VentaDia[]> {
    return this.http.get<VentaDia[]>(`${this.api}/ventas/por-dia`, { params: this.params() });
  }

  inventario(): Observable<FilaInventario[]> {
    return this.http.get<FilaInventario[]>(`${this.api}/inventario`, { params: this.params() });
  }

  cambiarNiveles(id: number, stockMinimo: number, stockObjetivo: number): Observable<unknown> {
    return this.http.put(`${this.api}/inventario/${id}/niveles`, { stockMinimo, stockObjetivo });
  }

  turnoActual(): Observable<Turno | null> {
    return this.http.get<Turno | null>(`${this.api}/turnos/actual`, { params: this.params() });
  }

  turnos(): Observable<Turno[]> {
    return this.http.get<Turno[]>(`${this.api}/turnos`, { params: this.params() });
  }

  abrirTurno(datos: { tipo: string; responsable: string; nota?: string }): Observable<Turno> {
    return this.http.post<Turno>(`${this.api}/turnos`, { ...datos, tiendaId: this.tiendaActiva() });
  }

  cerrarTurno(id: number, nota?: string): Observable<ResumenTurno> {
    return this.http.post<ResumenTurno>(`${this.api}/turnos/${id}/cerrar`, { nota });
  }

  resumenTurno(id: number): Observable<ResumenTurno> {
    return this.http.get<ResumenTurno>(`${this.api}/turnos/${id}/resumen`);
  }

  mermas(): Observable<Merma[]> {
    return this.http.get<Merma[]>(`${this.api}/mermas`, { params: this.params() });
  }

  registrarMerma(datos: { productoId: number; cantidad: number; motivo: string; nota?: string }): Observable<Merma> {
    return this.http.post<Merma>(`${this.api}/mermas`, { ...datos, tiendaId: this.tiendaActiva() });
  }

  incidencias(): Observable<Incidencia[]> {
    return this.http.get<Incidencia[]>(`${this.api}/incidencias`, { params: this.params() });
  }

  reportarIncidencia(datos: { titulo: string; descripcion?: string; categoria: string; severidad: string }): Observable<Incidencia> {
    return this.http.post<Incidencia>(`${this.api}/incidencias`, { ...datos, tiendaId: this.tiendaActiva() });
  }

  cambiarIncidencia(id: number, estado: string, solucion?: string): Observable<Incidencia> {
    return this.http.patch<Incidencia>(`${this.api}/incidencias/${id}`, { estado, solucion });
  }

  pedidos(): Observable<Pedido[]> {
    return this.http.get<Pedido[]>(`${this.api}/pedidos`, { params: this.params() });
  }

  pedir(datos: { productoId: number; cantidad: number; nota?: string; tiendaId?: number | null }): Observable<Pedido> {
    return this.http.post<Pedido>(`${this.api}/pedidos`, { tiendaId: this.tiendaActiva(), ...datos });
  }

  revisarPedido(id: number, accion: 'aprobar' | 'rechazar' | 'recibir', nota?: string): Observable<Pedido> {
    return this.http.post<Pedido>(`${this.api}/pedidos/${id}/${accion}`, { nota });
  }

  /** Descarga el CSV con la sesión (un enlace normal no llevaría el token). */
  descargarReporte(tipo: string, desde: string, hasta: string): Observable<{ nombre: string; archivo: Blob }> {
    let params = this.params().set('desde', desde).set('hasta', hasta);
    return this.http
      .get(`${this.api}/reportes/${tipo}`, { params, responseType: 'blob', observe: 'response' })
      .pipe(
        map((r) => ({
          nombre: /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? `${tipo}.csv`,
          archivo: r.body ?? new Blob(),
        })),
      );
  }
}

function leerTienda(): number | null {
  try {
    const v = localStorage.getItem(CLAVE_TIENDA);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

/** Mensaje legible de un error de la API. */
export function mensajeDeError(err: unknown, porDefecto: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'No hay conexión con el servidor. Reintenta en unos segundos.';
    const cuerpo = err.error;
    if (typeof cuerpo?.error === 'string') return cuerpo.error;
    const primero = Object.values(cuerpo ?? {}).find((v) => typeof v === 'string');
    if (typeof primero === 'string') return primero;
  }
  return porDefecto;
}
