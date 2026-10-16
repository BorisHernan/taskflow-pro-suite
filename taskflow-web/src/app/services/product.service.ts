import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { NewReview, Product, RatingSummary, Review } from '../models/product.model';
import { RegistroEventosService } from '../shared/registro-eventos.service';

const API_URL = environment.apiUrl.replace(/\/api\/tasks\/?$/, '/api/products');

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly registro = inject(RegistroEventosService);

  constructor(private http: HttpClient) {}

  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(API_URL);
  }

  getRatings(): Observable<RatingSummary[]> {
    return this.http.get<RatingSummary[]>(`${API_URL}/ratings`);
  }

  getReviews(id: number): Observable<Review[]> {
    return this.http.get<Review[]>(`${API_URL}/${id}/reviews`);
  }

  addReview(id: number, review: NewReview): Observable<Review> {
    return this.http.post<Review>(`${API_URL}/${id}/reviews`, review);
  }

  purchase(id: number, quantity: number): Observable<Product> {
    return this.http.post<Product>(`${API_URL}/${id}/purchase`, { quantity });
  }

  /** Stock real y compartido: cualquier compra (de cualquier visitante) llega aquí en vivo. */
  streamUpdates(): Observable<Product> {
    return new Observable<Product>((subscriber) => {
      const eventSource = new EventSource(`${API_URL}/stream`);

      eventSource.onmessage = (event) => {
        const product: Product = JSON.parse(event.data);
        this.registro.registrar({ demo: 'tienda', canal: 'SSE', direccion: 'entrada', detalle: `stock · ${product.name} = ${product.stock}` });
        subscriber.next(product);
      };

      eventSource.onerror = (err) => {
        console.warn('SSE tienda: conexión interrumpida, reintentando...', err);
      };

      return () => eventSource.close();
    });
  }
}
