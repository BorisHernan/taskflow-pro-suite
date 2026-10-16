import { Demo } from './registro-eventos.service';

// Recorrido guiado: un solo lugar con los pasos, para que la portada, la
// barra de guía y el panel "Cómo está hecho" digan exactamente lo mismo.
export interface PasoRecorrido {
  ruta: string;
  demo: Demo;
  titulo: string;
  queEs: string;
  pruebaEsto: string;
  tecnica: string;
  comoFunciona: string;
  codigo: {
    archivo: string;
    simplificado: boolean;
    fragmento: string;
  };
}

const REPO = 'https://github.com/BorisHernan/taskflow-pro-suite/blob/main/';

export function urlArchivo(archivo: string): string {
  return REPO + archivo;
}

export const RECORRIDO: PasoRecorrido[] = [
  {
    ruta: '/tablero',
    demo: 'tablero',
    titulo: 'Tablero Kanban en tiempo real',
    queEs: 'Un tablero compartido por todos los visitantes.',
    pruebaEsto: 'Abre esta página en otra pestaña o en tu celular y mueve una tarjeta: se mueve en las dos al instante.',
    tecnica: 'Server-Sent Events sobre Spring WebFlux',
    comoFunciona:
      'Cada navegador abre una conexión SSE que el servidor mantiene abierta. Cuando alguien crea o mueve una tarea, el cambio se guarda y se emite a todas las conexiones. Un latido cada 15 segundos evita que el proxy de Render corte el stream.',
    codigo: {
      archivo: 'board-service/src/main/java/pe/taskflow/board/controller/TaskController.java',
      simplificado: true,
      fragmento: `@GetMapping(value = "/stream", produces = TEXT_EVENT_STREAM_VALUE)
public Flux<ServerSentEvent<TaskEvent>> stream(ServerWebExchange exchange) {
    return Flux.merge(
            presenciaInicial,          // cuántos están conectados
            eventPublisher.stream(),   // cambios de cualquier pestaña
            heartbeat)                 // cada 15 s, para que no se corte
        .doFinally(s -> eventPublisher.unregisterViewer());
}`,
    },
  },
  {
    ruta: '/tienda',
    demo: 'tienda',
    titulo: 'Tienda con stock compartido',
    queEs: 'Catálogo de 36 productos con categorías, reseñas moderadas, carrito y boleta. El pago es simulado; el stock es real.',
    pruebaEsto: 'Abre un producto, deja una reseña y compra con el cupón PORTAFOLIO15: el stock baja para todos.',
    tecnica: 'SSE + R2DBC sobre PostgreSQL',
    comoFunciona:
      'La compra es una cadena reactiva: busca el producto, valida el stock, lo descuenta y lo guarda sin bloquear hilos. Si no alcanza, responde 409. El producto actualizado se publica por SSE y el stock baja en todas las pestañas abiertas.',
    codigo: {
      archivo: 'board-service/src/main/java/pe/taskflow/board/store/ProductController.java',
      simplificado: true,
      fragmento: `return productRepository.findById(id)
        .switchIfEmpty(Mono.error(new ResponseStatusException(NOT_FOUND, "Producto no encontrado")))
        .flatMap(product -> {
            if (product.getStock() < request.quantity()) {
                return Mono.error(new ResponseStatusException(CONFLICT, "Solo quedan ..."));
            }
            product.setStock(product.getStock() - request.quantity());
            return productRepository.save(product);
        })
        .doOnSuccess(saved -> eventPublisher.publish(saved));`,
    },
  },
  {
    ruta: '/estadisticas',
    demo: 'estadisticas',
    titulo: 'Métricas del sistema',
    queEs: 'Contadores en vivo de lo que pasa en la demo.',
    pruebaEsto: 'Revisa cuántas personas visitaron la demo: el total histórico se guarda en Postgres.',
    tecnica: 'Micrometer + Spring Actuator',
    comoFunciona:
      'Las visitas se cuentan una vez por IP y por día con una sola sentencia SQL atómica: si la IP ya entró hoy, no suma. Así refrescar la página no infla el número y dos visitas simultáneas no se pisan.',
    codigo: {
      archivo: 'board-service/src/main/java/pe/taskflow/board/demo/VisitCounterRepository.java',
      simplificado: false,
      fragmento: `WITH inserted AS (
    INSERT INTO visit_log (ip, visit_date) VALUES (:ip, CURRENT_DATE)
    ON CONFLICT DO NOTHING
    RETURNING ip
)
UPDATE visit_counter
SET total_visits = total_visits + 1, last_visit_at = now()
WHERE id = 1 AND EXISTS (SELECT 1 FROM inserted)`,
    },
  },
  {
    ruta: '/arena',
    demo: 'arena',
    titulo: 'Arena multijugador',
    queEs: 'Un mini agar.io contra otros visitantes y bots con IA.',
    pruebaEsto: 'Elige una skin y juega: come círculos más chicos, divídete con Espacio y atrapa power-ups.',
    tecnica: 'WebSocket bidireccional a 10 ticks por segundo',
    comoFunciona:
      'El servidor corre el juego: 10 veces por segundo mueve a todos, resuelve quién se come a quién y envía el estado por WebSocket. Tu navegador manda hacia dónde apuntas. Un jugador que entra recibe solo el último estado, no el historial.',
    codigo: {
      archivo: 'board-service/src/main/java/pe/taskflow/board/arena/ArenaEngine.java',
      simplificado: true,
      fragmento: `// A un jugador nuevo solo le sirve el último estado, no los ticks pasados.
private final Sinks.Many<ArenaSnapshot> snapshots = Sinks.many().replay().limit(1);

loop = Flux.interval(Duration.ofMillis(100))   // 10 ticks por segundo
        .subscribe(tick -> tick());            // mover, comer y emitir el estado`,
    },
  },
];
