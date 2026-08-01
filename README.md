# TaskFlow Pro

[![CI](https://github.com/BorisHernan/Proyecto_Portafolio/actions/workflows/ci.yml/badge.svg)](https://github.com/BorisHernan/Proyecto_Portafolio/actions/workflows/ci.yml)
**🔴 Demo en vivo:** **[proyecto-portafolio-eosin.vercel.app](https://proyecto-portafolio-eosin.vercel.app/)**

---

## 🇪🇸 Español

### Qué es esto

TaskFlow Pro es un **proyecto de portafolio**: un tablero kanban con actualizaciones en tiempo real (Angular +
Spring WebFlux reactivo), al que le fui sumando funcionalidades — tienda simulada con stock compartido en vivo,
dashboard de estadísticas, un mini juego multijugador (Arena Lite) y modo oscuro — para mostrar un rango más
amplio de lo que sé construir: desde CRUD reactivo hasta WebSockets, pasando por control de abuso en un demo
público sin login, testing y despliegue gratuito end-to-end.

No es un tutorial ni un boilerplate: cada decisión (por qué SSE aquí y WebSocket allá, por qué rate-limit por IP,
por qué `replay().limit(1)` en el sink del juego) está tomada y documentada en el código porque tuvo que resolver
un problema real durante el desarrollo.

### Demo en vivo

| | |
|---|---|
| **Frontend (Vercel)** | https://proyecto-portafolio-eosin.vercel.app/ |
| **Backend (Render)** | https://proyecto-portafolio-67pm.onrender.com |
| **Swagger / OpenAPI** | https://proyecto-portafolio-67pm.onrender.com/swagger-ui.html |
| **Health check** | https://proyecto-portafolio-67pm.onrender.com/actuator/health |

> ⏳ **El backend está en el plan gratuito de Render**, que apaga el contenedor tras un rato sin tráfico. Si la
> demo tarda en cargar la primera vez (hasta 2-3 minutos), es normal: Render está reactivando el servicio, no
> está caído. Los siguientes requests ya van a velocidad normal hasta que vuelva a quedar inactivo.

¿Encontraste algo roto? Escríbeme a **mdrncastro@gmail.com** — cualquier error que reportes ayuda a mejorar el proyecto.

### Funcionalidades

- **Tablero kanban** con drag & drop, tres columnas (Por hacer / En progreso / Hecho) y **actualizaciones en
  tiempo real por Server-Sent Events**: si dos personas tienen la demo abierta a la vez, ven los cambios de la
  otra en vivo, sin refrescar.
- **Tienda simulada** con catálogo, carrito, cupones y boleta — el catálogo y el stock son **reales y
  compartidos** entre todos los visitantes vía SSE (si alguien compra, el stock baja para todos al instante).
- **Dashboard de estadísticas** con contadores en vivo (tareas creadas, ventas, visitantes) alimentados por
  Micrometer y expuestos también en `/actuator/metrics`.
- **Arena Lite**: un mini `agar.io` multijugador en tiempo real por **WebSocket** (no SSE — acá el cliente
  también necesita mandar datos al servidor continuamente), con bots con IA simple (huir/cazar/buscar pellets),
  moderación de nombres y un tope de tamaño que termina la partida para que nadie farmee sin límite.
- **Modo oscuro** persistente, con detección de preferencia del sistema y sin destello blanco al cargar
  (el tema se aplica antes del primer pintado, ver `index.html`).
- **Controles de abuso del demo público** (sin login, así que cualquiera puede escribir): filtro de lenguaje
  ofensivo con 3 avisos antes de bloquear la IP, límite de tareas por IP, y un reset diario automático que
  restaura los datos semilla.

### Arquitectura

```
┌─────────────────┐      HTTPS / SSE / WebSocket      ┌──────────────────────┐      R2DBC       ┌────────────┐
│   taskflow-web   │ ───────────────────────────────► │    board-service      │ ───────────────► │   Neon     │
│  (Angular, Vercel)│ ◄─────────────────────────────── │ (Spring WebFlux,      │ ◄─────────────── │ (Postgres) │
└─────────────────┘         JSON / eventos en vivo      │  Render, Docker)      │                  └────────────┘
                                                          └──────────────────────┘
```

- **Frontend**: Angular 22 (standalone components, signals, esbuild), sin librería de estado externa —
  el estado vive en servicios inyectables con RxJS/signals.
- **Backend**: Spring Boot 3 + WebFlux (reactivo, non-blocking) + R2DBC, un único microservicio
  (`board-service`) que expone REST, SSE y un endpoint WebSocket.
- **Base de datos**: PostgreSQL, con Flyway para las migraciones de esquema (versionadas en
  `board-service/src/main/resources/db/migration`).
- **Tiempo real**: SSE para todo lo que es "un servidor empuja cambios a muchos clientes" (tablero, tienda,
  contador de visitantes); WebSocket solo para Arena, porque ahí el cliente también manda su posición
  continuamente — SSE es unidireccional y no serviría.

### Stack tecnológico

| Capa | Tecnologías |
|---|---|
| Frontend | Angular 22, TypeScript, RxJS, SCSS (variables CSS para theming), Vitest |
| Backend | Java 21, Spring Boot 3 / WebFlux, R2DBC, Flyway, springdoc-openapi (Swagger), Spring Actuator, Micrometer, Lombok |
| Base de datos | PostgreSQL (Neon en producción, Docker local) |
| Tiempo real | Server-Sent Events (tablero, tienda) + WebSocket nativo de WebFlux (Arena) |
| Testing | JUnit 5, Mockito, Reactor Test, AssertJ (backend) · Vitest + Angular Testing Library utils (frontend) |
| CI/CD | GitHub Actions (`mvn test` + `ng test` + `ng build` en cada push/PR) |
| Despliegue | Neon (DB) + Render (backend, Docker) + Vercel (frontend) — el stack completo gratis, ver [DEPLOY.md](DEPLOY.md) |

### Cómo correr el proyecto en local

**1. Base de datos:**

```bash
docker compose up -d postgres
```

**2. Backend** (`board-service/`, abrir en IntelliJ o correr con el Maven que trae el IDE — no hace falta
instalar Maven aparte):

```bash
cd board-service
mvn spring-boot:run
```

Levanta en `http://localhost:8081`. Flyway crea el esquema y carga datos semilla automáticamente.
Swagger UI queda en `http://localhost:8081/swagger-ui.html`.

**3. Frontend:**

```bash
cd taskflow-web
npm install
npm start   # ng serve, http://localhost:4200
```

Guía completa (incluye variables de entorno, troubleshooting) en [board-service/README.md](board-service/README.md).

### Tests

```bash
# Backend: JUnit + Reactor Test + Mockito
cd board-service
mvn test

# Frontend: Vitest
cd taskflow-web
npm test
```

Ambos corren automáticamente en cada push/PR a `main` vía GitHub Actions
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). La cobertura se enfoca en la lógica con más riesgo real
de romperse en silencio: moderación de contenido, límites de abuso por IP, reglas del juego (quién se come a
quién, el tope de tamaño que termina la partida), y los servicios del frontend que hablan con el backend.

> Escribiendo el test de rate-limiting encontré y corregí un bug real: el evento `RESET` que debía avisarle al
> frontend que se borraron las tareas de una IP nunca se disparaba, porque estaba encadenado *después* de un
> `Mono.error(...)` que ya había terminado el flujo en error. Quedó arreglado en `TaskController.java`.

### Despliegue gratuito

Todo el stack corre en planes gratuitos: **Neon** (Postgres), **Render** (backend, Docker) y **Vercel**
(frontend). Guía paso a paso completa en [DEPLOY.md](DEPLOY.md).

### Estructura del repo

```
taskflow-pro/
├── board-service/        # Backend: Spring WebFlux + R2DBC + Postgres
│   ├── src/main/java/pe/taskflow/board/
│   │   ├── controller/    # REST + SSE del tablero
│   │   ├── arena/         # Motor del mini juego + WebSocket
│   │   ├── store/         # Tienda simulada (stock real)
│   │   ├── demo/          # Moderación, rate limiting, reset diario, estadísticas
│   │   └── model/ repository/ config/ exception/
│   └── src/test/java/...  # JUnit + Reactor Test + Mockito
├── taskflow-web/          # Frontend: Angular standalone + signals
│   └── src/app/
│       ├── kanban-board/ store/ dashboard/ arena/
│       └── services/      # incluye los *.spec.ts con Vitest
├── .github/workflows/ci.yml
├── docker-compose.yml     # Postgres + Keycloak (este último aún no está en uso)
├── render.yaml
└── DEPLOY.md
```

### Roadmap

- [ ] Autenticación simplificada (JWT), para diferenciarlo del control por IP actual del demo público.
- [ ] Ampliar cobertura de tests a los componentes de UI más grandes (tablero, tienda).
- [ ] Dominio propio en Vercel.

---

## 🇬🇧 English

### What this is

TaskFlow Pro is a **portfolio project**: a real-time kanban board (Angular + reactive Spring WebFlux) that grew
into a small showcase of a wider range of backend/frontend skills — a simulated store with live shared stock, a
stats dashboard, a real-time multiplayer mini-game (Arena Lite, an `agar.io`-style clone), and dark mode — built
to demonstrate everything from reactive CRUD to WebSockets, abuse control on a public no-login demo, testing,
and a fully free end-to-end deployment.

It's not a tutorial or boilerplate: every non-obvious decision (why SSE here but WebSocket there, why IP-based
rate limiting, why `replay().limit(1)` on the game state sink) is there because it solved a real problem during
development, and is documented inline in the code.

### Live demo

| | |
|---|---|
| **Frontend (Vercel)** | https://proyecto-portafolio-eosin.vercel.app/ |
| **Backend (Render)** | https://proyecto-portafolio-67pm.onrender.com |
| **Swagger / OpenAPI** | https://proyecto-portafolio-67pm.onrender.com/swagger-ui.html |
| **Health check** | https://proyecto-portafolio-67pm.onrender.com/actuator/health |

> ⏳ **The backend runs on Render's free tier**, which spins the container down after a period of inactivity. If
> the first load takes a while (up to 2-3 minutes), that's expected — Render is waking the service back up, not
> broken. Subsequent requests are fast until it goes idle again.

Found something broken? Reach me at **mdrncastro@gmail.com** — any bug report helps improve the project.

### Features

- **Kanban board** with drag & drop and **real-time updates over Server-Sent Events**: open the demo in two
  tabs and watch changes from one appear live in the other, no refresh needed.
- **Simulated store** with catalog, cart, coupons and a receipt — the catalog and stock are **real and shared**
  across all visitors via SSE (a purchase drops the stock for everyone instantly).
- **Stats dashboard** with live counters (tasks created, sales, visitors), backed by Micrometer and also
  exposed at `/actuator/metrics`.
- **Arena Lite**: a small real-time multiplayer `agar.io`-style game over a native **WebSocket** (not SSE —
  here the client also needs to keep sending data to the server), with simple bot AI (flee/hunt/seek-pellet),
  name moderation, and a size cap that ends the match so no one can farm indefinitely.
- **Persistent dark mode** with system-preference detection and no white flash on load (the theme is applied
  before first paint — see `index.html`).
- **Public-demo abuse controls** (no login, so anyone can write to it): profanity filter with a 3-strike
  IP ban, per-IP task limits, and an automatic daily reset back to seed data.

### Architecture

Same diagram as above: Angular (Vercel) talks to a single reactive Spring WebFlux service (Render, Docker) over
HTTPS/SSE/WebSocket, which talks to Postgres (Neon) over R2DBC. SSE is used for anything that's "server pushes
changes to many clients" (board, store, visitor count); WebSocket is used only for Arena, since that's the one
feature where the client also has to continuously send data back.

### Tech stack

| Layer | Technologies |
|---|---|
| Frontend | Angular 22, TypeScript, RxJS, SCSS (CSS custom properties for theming), Vitest |
| Backend | Java 21, Spring Boot 3 / WebFlux, R2DBC, Flyway, springdoc-openapi (Swagger), Spring Actuator, Micrometer, Lombok |
| Database | PostgreSQL (Neon in production, Docker locally) |
| Real-time | Server-Sent Events (board, store) + native WebFlux WebSocket (Arena) |
| Testing | JUnit 5, Mockito, Reactor Test, AssertJ (backend) · Vitest (frontend) |
| CI/CD | GitHub Actions (`mvn test` + `ng test` + `ng build` on every push/PR) |
| Deployment | Neon (DB) + Render (backend, Docker) + Vercel (frontend) — the whole stack on free tiers, see [DEPLOY.md](DEPLOY.md) |

### Running locally

```bash
# 1. Database
docker compose up -d postgres

# 2. Backend (http://localhost:8081, Swagger at /swagger-ui.html)
cd board-service
mvn spring-boot:run

# 3. Frontend (http://localhost:4200)
cd taskflow-web
npm install
npm start
```

### Tests

```bash
cd board-service && mvn test    # JUnit + Reactor Test + Mockito
cd taskflow-web && npm test     # Vitest
```

Both run automatically on every push/PR to `main` via GitHub Actions
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Coverage focuses on the logic most likely to break
silently: content moderation, per-IP abuse limits, game rules (who eats whom, the size cap that ends a match),
and the frontend services that talk to the backend.

> Writing the rate-limit test uncovered a real bug: the `RESET` event that's supposed to tell the frontend an
> IP's tasks were wiped never actually fired, because it was chained *after* a `Mono.error(...)` that had
> already terminated the stream with an error. Fixed in `TaskController.java`.

### License

No explicit license yet — this is a personal portfolio project. Feel free to read the code for reference.
