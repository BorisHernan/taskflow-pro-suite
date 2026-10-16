export interface StatsSnapshot {
  tasksCreated: number;
  // Desde el historial de compras en Postgres.
  purchases: number;
  unitsSold: number;
  revenue: number;
  // En memoria: se reinicia con cada despliegue del backend.
  totalVisitors: number;
  // Persistido en la base de datos: sobrevive a reinicios y deploys.
  totalVisitsAllTime: number;
}

/** GET /api/stats/historial: agregados calculados en SQL para los gráficos. */
export interface HistorialStats {
  visitasPorDia: { fecha: string; total: number }[];
  ventasPorDia: { fecha: string; unidades: number; ingresos: number }[];
  ventasPorCategoria: VentaGrupo[];
  topProductos: VentaGrupo[];
  tareasPorEstado: { clave: string; total: number }[];
  resenasPorEstrellas: { clave: string; total: number }[];
  stockPorCategoria: { categoria: string; stock: number; inicial: number }[];
}

export interface VentaGrupo {
  nombre: string;
  unidades: number;
  ingresos: number;
}
