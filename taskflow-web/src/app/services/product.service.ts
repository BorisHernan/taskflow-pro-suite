import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Product } from '../models/product.model';

const API_URL = environment.apiUrl.replace(/\/api\/tasks\/?$/, '/api/products');

@Injectable({ providedIn: 'root' })
export class ProductService {
  constructor(private http: HttpClient) {}

  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(API_URL);
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
        subscriber.next(product);
      };

      eventSource.onerror = (err) => {
        console.warn('SSE tienda: conexión interrumpida, reintentando...', err);
      };

      return () => eventSource.close();
    });
  }
}
