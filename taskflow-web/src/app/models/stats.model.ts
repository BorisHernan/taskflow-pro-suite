export interface StatsSnapshot {
  tasksCreated: number;
  purchases: number;
  unitsSold: number;
  revenue: number;
  // En memoria: se reinicia con cada despliegue del backend.
  totalVisitors: number;
  // Persistido en la base de datos: sobrevive a reinicios y deploys.
  totalVisitsAllTime: number;
}
