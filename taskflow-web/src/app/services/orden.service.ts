import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../auth/sesion.service';
import { EstadoOrden, NuevaOrden, OrdenVista } from '../models/orden.model';

const CLAVE_RECIENTES = 'taskflow-mis-pedidos';

/** Pedidos de la tienda online: compra, seguimiento público y despacho desde la gestión. */
@Injectable({ providedIn: 'root' })
export class OrdenService {
  private readonly http = inject(HttpClient);
  private readonly api = `${API_BASE}/api/ordenes`;

  crear(orden: NuevaOrden): Observable<OrdenVista> {
    return this.http.post<OrdenVista>(this.api, orden);
  }

  seguimiento(codigo: string): Observable<OrdenVista> {
    return this.http.get<OrdenVista>(`${this.api}/seguimiento/${encodeURIComponent(codigo)}`);
  }

  listar(tienda: number | null): Observable<OrdenVista[]> {
    const params = tienda == null ? new HttpParams() : new HttpParams().set('tienda', tienda);
    return this.http.get<OrdenVista[]>(this.api, { params });
  }

  avanzar(id: number, estado: EstadoOrden): Observable<OrdenVista> {
    return this.http.patch<OrdenVista>(`${this.api}/${id}/estado`, { estado });
  }

  /** Códigos de los pedidos hechos en este navegador, el más reciente primero. */
  recientes(): string[] {
    try {
      const v = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? '[]');
      return Array.isArray(v) ? v.filter((c) => typeof c === 'string') : [];
    } catch {
      return [];
    }
  }

  recordar(codigo: string): void {
    try {
      localStorage.setItem(CLAVE_RECIENTES, JSON.stringify([codigo, ...this.recientes().filter((c) => c !== codigo)].slice(0, 5)));
    } catch {}
  }
}
