# TaskFlow Pro — board-service

Primer microservicio del proyecto: tablero kanban reactivo (Spring Boot + WebFlux + R2DBC + Postgres),
con actualizaciones en vivo vía Server-Sent Events.

## 1. Levantar Postgres con Docker

Desde la raíz del proyecto (`taskflow-pro/`):

```
docker compose up -d postgres
```

Verifica que quedó arriba:

```
docker ps
```

Deberías ver el contenedor `taskflow-postgres` corriendo en el puerto 5432.

(Deja `keycloak` apagado por ahora — lo activamos en la fase de seguridad.)

## 2. Abrir el backend en IntelliJ

1. `File > Open` y selecciona la carpeta `board-service/`.
2. IntelliJ detecta el `pom.xml` automáticamente y lo importa como proyecto Maven
   (usa el Maven que trae integrado — **no necesitas instalar Maven aparte**).
3. Espera a que baje las dependencias (barra de progreso abajo a la derecha).
4. Abre `BoardServiceApplication.java` y dale click derecho > Run.

Al arrancar, Flyway va a crear la tabla `tasks` automáticamente y cargar datos de ejemplo.

## 3. Probar que funciona

Con el backend corriendo en `http://localhost:8081`:

- Listar tareas: `GET http://localhost:8081/api/tasks`
- Ver el stream en vivo (SSE): abre `http://localhost:8081/api/tasks/stream` en el navegador
  y déjala abierta — cuando crees o muevas una tarea desde otra pestaña/Postman, va a aparecer aquí en tiempo real.
- Crear una tarea (Postman/Insomnia, `POST http://localhost:8081/api/tasks`):
  ```json
  {
    "title": "Probar el endpoint",
    "description": "Primera tarea creada desde Postman",
    "status": "TODO",
    "position": 1
  }
  ```

Si ves la lista de tareas y puedes crear una nueva, el backend está listo.

## Despliegue gratis (Neon + Render + Vercel)

Ver [DEPLOY.md](DEPLOY.md) para la guía paso a paso.

## Próximos pasos (según el plan)

- [ ] Semana 1-2: tablero Angular con drag & drop consumiendo `GET /api/tasks`
- [ ] Semana 3: conectar el frontend al stream SSE para movimiento en vivo
- [ ] Semana 4: activar Keycloak + Spring Security (JWT)
- [ ] Semana 5: API Gateway + `resource-service` + `scheduling-service`
