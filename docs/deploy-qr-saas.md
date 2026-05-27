# Deploy SaaS QR

Esta guia deja cerrado el deploy del plano online SaaS actual:

- backend: `apps/qr-server` en Render
- frontend: `apps/qr-pedidos` en Cloudflare Pages

No afecta a `apps/local-server`, `apps/kiosk-web`, pagos fisicos, CashDro, Artemis, impresora ni al flujo actual kiosko -> Last.

## Backend: Render Web Service

Servicio:
- tipo: `Web Service`
- app: `apps/qr-server`
- root directory recomendado: repositorio raiz

Comandos reales del monorepo:
- build command:

```bash
npm install && npm run build --workspace apps/qr-server
```

- start command:

```bash
npm run start --workspace apps/qr-server
```

- health check path:

```text
/health
```

Notas:
- no configurar `PORT` manualmente en Render
- Render ya inyecta `PORT`
- `seed:tenant` no se ejecuta en cada deploy
- el seed se ejecuta solo manualmente si hace falta crear o actualizar tenant/location de prueba

Ejemplo de seed manual:

```bash
npm run seed:tenant --workspace apps/qr-server
```

Variables de entorno sin secretos:

```text
ALLOWED_ORIGINS=https://<tu-proyecto>.pages.dev
FIREBASE_PROJECT_ID=<firebase-project-id>
FIREBASE_CLIENT_EMAIL=<firebase-admin-client-email>
FIREBASE_PRIVATE_KEY=<firebase-private-key-con-\n>
LAST_TOKEN=<last-token>
LAST_BASE_URL=https://api.last.app/v2
```

Reglas:
- `ALLOWED_ORIGINS` debe apuntar al dominio real de Cloudflare Pages
- si luego tienes dominio propio, anade tambien ese dominio
- no usar `*`
- no poner `PORT` en Render

Webhook futuro de Stripe:

```text
https://<QR_SERVER_PUBLIC_DOMAIN>/api/webhooks/stripe
```

Todavia no se implementa Stripe en esta fase.

## Frontend: Cloudflare Pages

Servicio:
- tipo: `Cloudflare Pages`
- app: `apps/qr-pedidos`
- root directory correcto:

```text
apps/qr-pedidos
```

Comandos:
- build command:

```bash
npm run build
```

- output directory:

```text
dist
```

Variables `VITE_*`:

```text
VITE_QR_SERVER_URL=https://<tu-render-service>.onrender.com
VITE_QR_SERVER_TENANT=<tenant-slug-de-prueba-o-produccion>
VITE_QR_SERVER_LOCATION_KEY=<locationKey-activa>
VITE_GOOGLE_MAPS_API_KEY=<google-maps-browser-key>
```

Reglas:
- `VITE_QR_SERVER_URL` debe apuntar al dominio publico de Render
- la Google Maps key debe restringirse por dominio
- minimo:
  - `https://<tu-proyecto>.pages.dev/*`
  - y tu dominio propio cuando exista

## Smoke Tests

Backend:

```bash
curl -i https://<QR_SERVER_PUBLIC_DOMAIN>/health
curl -i "https://<QR_SERVER_PUBLIC_DOMAIN>/api/tenant/config?tenant=<tenantSlug>"
curl -i "https://<QR_SERVER_PUBLIC_DOMAIN>/api/tenant/bootstrap?tenant=<tenantSlug>&locationKey=<locationKey>&orderMode=delivery"
```

Esperado:
- `/health` -> `200`
- `/api/tenant/config` -> `200` si el tenant existe y esta online
- `/api/tenant/bootstrap` -> `200` si tenant, location y catalogos por canal estan bien configurados

Frontend en navegador:
1. abrir la URL publica de Cloudflare Pages
2. comprobar que carga configuracion del tenant
3. comprobar que resuelve location activa
4. comprobar que llega a bootstrap sin errores
5. avanzar el flujo hasta crear `OrderSession` draft en la experiencia web

## Comandos finales de referencia

Render:

```bash
npm install && npm run build --workspace apps/qr-server
npm run start --workspace apps/qr-server
```

Cloudflare Pages:

```bash
# Root directory
apps/qr-pedidos

# Build command
npm run build

# Output directory
dist
```
