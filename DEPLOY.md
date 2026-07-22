# Desplegar TaskFlow Pro gratis (Neon + Render + Vercel)

Stack: **Neon** (Postgres gratis) + **Render** (backend Spring Boot, Docker) + **Vercel** (frontend Angular).
Ninguno de los tres pide tarjeta para el tier gratuito.

## 0. Subir el repo a GitHub

```bash
cd taskflow-pro
git init
git add .
git commit -m "Initial commit: TaskFlow Pro kanban board"
```

Crea un repo vacío en [github.com/new](https://github.com/new) (sin README, sin .gitignore — ya los tienes) y luego:

```bash
git remote add origin https://github.com/TU_USUARIO/taskflow-pro.git
git branch -M main
git push -u origin main
```

## 1. Base de datos — Neon

1. Crea cuenta en [neon.tech](https://neon.tech) (puedes usar "Sign in with GitHub").
2. Crea un proyecto nuevo → una base de datos (por defecto se llama `neondb`, puedes renombrarla o dejarla).
3. En el dashboard del proyecto, ve a **Connection Details** y copia la cadena **direct** (no la "pooled/PgBouncer" — R2DBC no lleva bien el modo *transaction pooling* de PgBouncer con prepared statements). Se ve algo así:

   ```
   postgresql://usuario:password@ep-xxxx-yyyy.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

4. De ahí arma dos variantes que usarás como variables de entorno en Render:

   - **R2DBC** (para la app en runtime):
     `r2dbc:postgresql://ep-xxxx-yyyy.us-east-2.aws.neon.tech:5432/neondb?sslMode=REQUIRE`
   - **JDBC** (solo para que Flyway corra las migraciones al arrancar):
     `jdbc:postgresql://ep-xxxx-yyyy.us-east-2.aws.neon.tech:5432/neondb?sslmode=require`

## 2. Backend — Render

1. Crea cuenta en [render.com](https://render.com) con "Sign in with GitHub" y dale acceso al repo `taskflow-pro`.
2. **New > Blueprint**, selecciona el repo. Render debería detectar `render.yaml` en la raíz y proponer el servicio `taskflow-board-service` (runtime Docker, usa `board-service/Dockerfile`).
   - Si prefieres hacerlo manual en vez de Blueprint: **New > Web Service**, root directory `board-service`, runtime **Docker**, plan **Free**.
3. Configura las variables de entorno (Render las pide porque `render.yaml` las marca `sync: false`):

   | Variable | Valor |
   |---|---|
   | `SPRING_R2DBC_URL` | la cadena R2DBC del paso 1 |
   | `SPRING_R2DBC_USERNAME` | usuario de Neon |
   | `SPRING_R2DBC_PASSWORD` | password de Neon |
   | `SPRING_FLYWAY_URL` | la cadena JDBC del paso 1 |
   | `SPRING_FLYWAY_USER` | usuario de Neon |
   | `SPRING_FLYWAY_PASSWORD` | password de Neon |
   | `ALLOWED_ORIGINS` | de momento `http://localhost:4200` (lo actualizas en el paso 4) |

4. Deploy. Cuando termine, copia la URL pública (algo como `https://taskflow-board-service.onrender.com`) y verifica:
   `https://taskflow-board-service.onrender.com/api/tasks` debe devolver el JSON con las tareas semilla.

   **Nota:** el plan free de Render duerme el servicio tras ~15 min sin tráfico; el primer request después reactiva el contenedor y tarda ~30-50s. Es normal en un demo de portafolio, pero acláralo en el README para quien lo pruebe.

## 3. Frontend — Vercel

1. Edita [`taskflow-web/src/environments/environment.prod.ts`](taskflow-web/src/environments/environment.prod.ts) y reemplaza la URL placeholder por la URL real de Render + `/api/tasks`:

   ```ts
   apiUrl: 'https://taskflow-board-service.onrender.com/api/tasks',
   ```

   Commit y push ese cambio.

2. Crea cuenta en [vercel.com](https://vercel.com) con "Sign in with GitHub" → **Add New Project** → importa `taskflow-pro`.
3. En la configuración del proyecto:
   - **Root Directory:** `taskflow-web`
   - **Framework Preset:** Angular (Vercel lo detecta solo al ver `angular.json`)
   - **Build Command:** `npm run build` (usa la config `production` por defecto, según `angular.json`)
   - **Output Directory:** `dist/taskflow-web/browser`
4. Deploy. Vercel te da una URL tipo `https://taskflow-pro.vercel.app`.

## 4. Cerrar el círculo: CORS

Vuelve a Render → variables de entorno del backend → actualiza `ALLOWED_ORIGINS` con la URL real de Vercel:

```
ALLOWED_ORIGINS=https://taskflow-pro.vercel.app
```

Guarda (esto redeploya el servicio automáticamente).

## 5. Probar

Abre la URL de Vercel, crea una tarea, muévela entre columnas, ábrelo en dos pestañas y confirma que los cambios se reflejan en vivo por SSE en ambas.

## A futuro

- Dominio propio en Vercel (gratis, solo agregar el CNAME en tu DNS).
- GitHub Actions que corra `mvn test` / `ng test` en cada push antes de que Render/Vercel desplieguen (ver roadmap del README principal).
