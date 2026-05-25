# Last.app Adapter Contract

## Propósito

Este documento define el contrato interno del adapter técnico que comunica el backend propio con Last.app.

**No es documentación pública de Last.app.**  
**No es el contrato de pedidos del backend propio** — ese vive en [docs/contracts/order-api.md](C:/Users/smashme/Documents/New%20project%203/docs/contracts/order-api.md).

El objetivo es establecer:

- qué hace hoy `packages/last-app`
- qué sigue viviendo en `apps/local-server/src/last-app.ts`
- cuáles son los límites explícitos del adapter
- qué está implementado hoy y qué sigue pendiente de migración

Ningún frontend llama a Last directamente.

---

## Estado actual

`packages/last-app` **ya no es un package legacy vacío**.  
Ahora es un **adapter técnico mínimo real**, consumido inmediatamente por [apps/local-server/src/last-app.ts](C:/Users/smashme/Documents/New%20project%203/apps/local-server/src/last-app.ts).

### Qué vive hoy en `packages/last-app`

- configuración mínima del cliente HTTP de Last
- construcción de headers
- lectura del body de respuesta
- wrapper HTTP JSON básico
- error técnico normalizado (`LastApiError`)

### Qué sigue viviendo hoy en `apps/local-server/src/last-app.ts`

- funciones públicas de integración viva:
  - `fetchOrganizations`
  - `fetchLocations`
  - `fetchLocation`
  - `fetchCatalog`
  - `fetchPromotions`
  - `createOrderInLast`
  - setup auto / setup options
  - resolve de QR mappings
- cache SQLite de catálogo
- auditoría y eventos
- records de pedidos
- normalización de promociones/catálogos
- lógica de negocio de pedidos
- traducción de errores del adapter al modelo HTTP del backend

### Frontera actual

- **package = adapter HTTP Last puro**
- **local-server = negocio, persistencia, auditoría, idempotencia y payloads operativos**

---

## Ownership

| Concepto | Owner |
|---|---|
| Dominio interno de pedido | `packages/types` + [docs/contracts/order-api.md](C:/Users/smashme/Documents/New%20project%203/docs/contracts/order-api.md) |
| Payloads y convenciones de Last | este documento |
| Cliente HTTP técnico de Last | `packages/last-app` |
| Integración viva actual | `apps/local-server/src/last-app.ts` |
| Persistencia local (SQLite) | `apps/local-server` |
| Auditoría / eventos | `apps/local-server` |
| Cache de catálogo | `apps/local-server` |
| QR mappings | `apps/local-server` |
| Stripe | backend propio / contrato específico de pagos |
| Frontends (`kiosk-web`, `qr-order`, `orders`) | nunca llaman a Last directamente |

---

## Responsabilidades del adapter

### Qué hace

- construir headers HTTP requeridos por Last
- ejecutar requests HTTP JSON a `https://api.last.app/v2`
- devolver `null` si una respuesta correcta viene vacía
- lanzar un error técnico estable (`LastApiError`) cuando Last responde error
- mantenerse libre de negocio, persistencia y políticas operativas

### Qué no hace

- no crea `OrderSession`
- no conoce SQLite
- no persiste cache
- no persiste auditoría
- no crea pedidos locales
- no decide reintentos
- no gestiona Stripe
- no gestiona QR mappings
- no expone rutas Fastify/Express
- no es owner de `code` ni `operationalCode`
- no es owner del payload de negocio completo de `createOrderInLast`

---

## Configuración mínima

```ts
interface LastClientConfig {
  token: string;
  baseUrl?: string;        // default: https://api.last.app/v2
  locationId?: string;
  organizationId?: string;
}

interface LastRequestHeadersOptions {
  locationId?: string;
  organizationId?: string;
  includeContentType?: boolean; // default: true
}
```

### Headers soportados

| Header | Valor | Cuándo se añade |
|---|---|---|
| `Authorization` | `Bearer {token}` | Siempre |
| `Content-Type` | `application/json` | Por defecto |
| `LocationID` | `{locationId}` | Si se proporciona |
| `OrganizationID` | `{organizationId}` | Si se proporciona |

---

## Implementado actualmente

| Función / export | Estado | Dónde vive | Consumidor actual |
|---|---|---|---|
| `LastClientConfig` | Implementado | `packages/last-app` | `apps/local-server/src/last-app.ts` |
| `LastRequestHeadersOptions` | Implementado | `packages/last-app` | `apps/local-server/src/last-app.ts` |
| `LastApiError` | Implementado | `packages/last-app` | `apps/local-server/src/last-app.ts` |
| `buildLastHeaders(...)` | Implementado | `packages/last-app` | `apps/local-server/src/last-app.ts` |
| `readResponseBody(...)` | Implementado | `packages/last-app` | `apps/local-server/src/last-app.ts` |
| `requestLastJson(...)` | Implementado | `packages/last-app` | `apps/local-server/src/last-app.ts` vía wrapper local |
| `fetchOrganizations(...)` | Implementado | `apps/local-server/src/last-app.ts` | `server.ts` / setup |
| `fetchLocations(...)` | Implementado | `apps/local-server/src/last-app.ts` | `server.ts` / setup |
| `fetchLocation(...)` | Implementado | `apps/local-server/src/last-app.ts` | `server.ts`, resolve QR, setup |
| `fetchCatalog(...)` | Implementado | `apps/local-server/src/last-app.ts` | `kiosk-web`, `qr-order`, `admin-web` |
| `fetchPromotions(...)` | Implementado | `apps/local-server/src/last-app.ts` | catálogo enriquecido / inspección |
| `fetchFloorplans(config, locationId)` | Implementado | `apps/local-server/src/last-app.ts` | `/api/last/tables` — devuelve mesas reales de Last |
| `createOrderInLast(...)` | Implementado | `apps/local-server/src/last-app.ts` | `POST /api/orders` |
| Cache SQLite de catálogo | Implementado | `apps/local-server` | `fetchCatalog(...)` |
| Setup auto | Implementado | `apps/local-server/src/last-app.ts` + `server.ts` | `admin-web` |

---

## Pendiente de migración

Las siguientes piezas **no existen todavía en `packages/last-app`** y no deben describirse como disponibles:

| Función / tipo | Estado | Comentario |
|---|---|---|
| `fetchCatalogById(...)` en package | Pendiente | Hoy `fetchCatalog(...)` sigue en `local-server` |
| `fetchPromotions(...)` en package | Pendiente | Sigue en `local-server` |
| `fetchPromotionById(...)` en package | Pendiente | Sigue en `local-server` |
| `createTab(...)` en package | Pendiente | `createOrderInLast(...)` sigue usando lógica local |
| `LastLocation` exportado desde package | Pendiente | No existe como tipo exportado canónico todavía |
| `LastPromotion` exportado desde package | Pendiente | No existe como tipo exportado canónico todavía |
| `LastCatalogSnapshot` exportado desde package | Pendiente | No existe como tipo exportado canónico todavía |
| `LastFloorplan` / `LastTable` exportados | Pendiente | Shape confirmado — ver §Mesas reales de Last; tipos locales en `local-server`, no exportados desde package |
| `extractTablesFromFloorplans(floorplans)` | Pendiente | Helper puro para listar mesas desde respuesta de floorplans |
| Mappers `OrderSession -> Last` | Pendiente | No se han extraído al package |

---

## Fuera del adapter

| Componente | Owner correcto |
|---|---|
| `createOrderInLast(...)` como flujo completo de negocio | `apps/local-server` |
| SQLite / DB | `apps/local-server` |
| cache de catálogo | `apps/local-server` |
| auditoría / `order_events` | `apps/local-server` |
| `orders` records | `apps/local-server` |
| setup auto | `apps/local-server` |
| QR mappings | `apps/local-server` |
| Stripe | backend propio |
| `OrderSession` | dominio interno / backend propio |
| idempotencia de negocio | backend propio |
| reintentos / backoff | backend propio |
| rutas HTTP | `server.ts` del backend correspondiente |

---

## Mesas reales de Last — endpoint confirmado

Auditoría realizada 2026-05-18 contra el local configurado en el repositorio.

### Endpoint útil

```
GET https://api.last.app/v2/floorplans?locationId={locationId}
```

- Devuelve `200 OK` con el token actual de `local-server`.
- `locationId` debe ir en query string — el header `LocationID` solo no es suficiente.
- `GET /admin/floorplans` devolvió `401 Invalid token` con ese mismo token. No es la vía estable para integraciones de backend.

### Shape observado

La respuesta es un array de floorplans. Cada floorplan contiene sus mesas:

```ts
interface LastFloorplan {
  id: string;
  name: string;
  locationId: string;
  tables: LastTable[];
  [key: string]: unknown;
}

interface LastTable {
  id: string;
  name: string;
  floorplanId?: string | null;
  floorplanName?: string | null;
  min?: number | null;
  max?: number | null;
  seats?: number | null;
  flatFeeSurcharge?: number | null;
  [key: string]: unknown;
}
```

No se incluyen campos `enabled`, `available` ni `status` porque no aparecieron en la respuesta real inspeccionada. No se deben inventar.

### Datos del local inspeccionado

| Campo | Valor observado |
|---|---|
| Número de floorplans | 1 |
| Nombre del floorplan | `"Floor"` |
| Número de mesas | 3 |
| Nombres de mesas | `T1`, `T2`, `T3` |
| `tables[].id` | UUID real, utilizable como `lastTableId` |

### `lastTableId` — decisión

**`tables[].id` de `GET /v2/floorplans?locationId=...` es el valor correcto para `lastTableId`.**

Evidencia:
- El OpenAPI de Last describe `tables[].id` como "Unique identifier for the table".
- La respuesta real devuelve objetos de mesa con `id` y `name` utilizables.
- Coincide con el modelo de QR mapping del backend propio: `qrToken → lastTableId`.

Pendiente de confirmación end-to-end: no se hizo una creación real de tab con uno de esos `tables[].id` en esta auditoría. Hasta que se pruebe, `tableNameSnapshot` sigue siendo el fallback operativo.

### Estado de implementación

| Función / tipo | Estado | Dónde vive |
|---|---|---|
| `fetchFloorplans(config, locationId)` | **Implementado** | `apps/local-server/src/last-app.ts` — expuesto como `GET /api/last/tables` |
| `LastFloorplan` | Implementado (tipo local) | `apps/local-server/src/last-app.ts` — no exportado desde package |
| `LastTable` | Implementado (tipo local) | `apps/local-server/src/last-app.ts` — no exportado desde package |
| `extractTablesFromFloorplans(floorplans)` | Pendiente | Helper puro — pendiente si hace falta separar |

El flujo de alta de QR mappings en `admin-web` debe usar `tables[].id` como `lastTableId` y `tables[].name` como nombre visible. La UI de `admin-web` para el selector de mesas está pendiente de implementar.

### Qué cambia y qué no

- `fetchLocation(...)` sigue siendo útil para brands, catalogs y metadatos generales. No da mesas — esto es correcto y no cambia.
- `fetchFloorplans(...)` está implementado. El resolve de `qrToken` intenta el nombre real desde Last y cae a `tableNameSnapshot` solo si falla.
- `tableNameSnapshot` sigue siendo el fallback operativo hasta que se confirme end-to-end la creación de tab con `tables[].id`.
- El ownership de las mesas sigue siendo Last.app. El backend solo mantiene el mapping `qrToken → lastTableId`.

---

## Contrato mínimo actual del package

```ts
interface LastClientConfig {
  token: string;
  baseUrl?: string;
  locationId?: string;
  organizationId?: string;
}

interface LastRequestHeadersOptions {
  locationId?: string;
  organizationId?: string;
  includeContentType?: boolean;
}

class LastApiError extends Error {
  status: number;
  body: string;
}

function buildLastHeaders(
  config: LastClientConfig,
  options?: LastRequestHeadersOptions
): Record<string, string>

function readResponseBody(response: Response): Promise<unknown>

function requestLastJson<T>(
  config: LastClientConfig,
  path: string,
  init: {
    method: string;
    body?: unknown;
    headers?: LastRequestHeadersOptions;
  }
): Promise<T | null>
```

### Semántica actual de `requestLastJson(...)`

- usa `https://api.last.app/v2` por defecto
- serializa `body` a JSON si existe
- usa `buildLastHeaders(...)`
- si `response.ok === false`, lanza `LastApiError`
- si la respuesta correcta está vacía, devuelve `null`
- si la respuesta trae texto no JSON válido, lanza error controlado

---

## Frontera técnica actual

### Package

- HTTP puro
- headers
- parsing base
- error técnico base

### local-server

- wrapper `requestLastData(...)`
- traducción `LastApiError -> HttpError`
- cache
- records
- eventos
- setup
- promociones
- negocio de pedidos
- payloads operativos de `POST /tabs`

---

## Riesgos y pendientes restantes

| Riesgo / pendiente | Impacto | Estado |
|---|---|---|
| Selector de mesas en `admin-web` no implementado | `lastTableId` se sigue entrando manual en la UI de admin; `fetchFloorplans(...)` ya devuelve datos reales pero la UI no lo consume aún | Pendiente — UI de `admin-web` |
| Confirmación end-to-end de tab con `tables[].id` | No se ha verificado que Last acepte ese `id` como `tableId` en `POST /tabs` | Pendiente — bajo riesgo dado el OpenAPI |
| `GET /admin/floorplans` no accesible con token actual | No usar esa ruta en integraciones de backend | Documentado |
| Tipos `LastLocation`, `LastPromotion`, `LastFloorplan`, `LastTable` no exportados desde package | Solo viven en `local-server` como tipos locales | Pendiente de extracción cuando se consolide el package |
| `fetchPromotions(...)` / `createTab(...)` no en package | Lógica de negocio sigue en `local-server` | Correcto por ahora — no migrar antes de tiempo |
| Mappers `OrderSession -> Last` no extraídos | No hay mapper canónico compartible | Pendiente hasta que el backend propio los necesite |

La fuente de verdad es:

- **package** para primitivas HTTP mínimas
- **local-server** para integración viva, negocio y floorplans
