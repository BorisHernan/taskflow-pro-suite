import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HistorialStats, StatsSnapshot } from '../models/stats.model';

const API_URL = environment.apiUrl.replace(/\/api\/tasks\/?$/, '/api/stats');

@Injectable({ providedIn: 'root' })
export class StatsService {
  constructor(private http: HttpClient) {}

  getStats(): Observable<StatsSnapshot> {
    return this.http.get<StatsSnapshot>(API_URL);
  }

  getHistorial(): Observable<HistorialStats> {
    return this.http.get<HistorialStats>(`${API_URL}/historial`);
  }
}
