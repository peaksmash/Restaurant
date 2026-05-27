# SaaS Architecture V1

## 1. Principio rector Last-first

### Regla principal

**Last.app es la fuente de verdad externa y operativa.**

Antes de modelar, persistir o exponer un dato propio en `apps/qr-server`, hay que comprobar primero si Last.app ya lo expone mediante su API y si ya existe un adapter o integracion previa en el repositorio.

### Last.app es la fuente de verdad externa para

- organizations
- locations
- brands, si aplica en el tenant/location
- catalogs
- fullCatalogs, si aplica en brand/location
- products
- modifiers
- promotions, si Last las expone
- floorplans
- mesas
- zonas de reparto
- coste de delivery
- tiempos estimados de preparacion o entrega
- workingTimes
- paymentMethods
- offlinePaymentMethods
- disponibilidad operativa, si Last la expone
- pedido operativo final

### Que no debe hacer nuestro sistema

Nuestro sistema **no debe duplicar esos datos como fuente principal**.

Si se guarda algo localmente o en Firestore, debe declararse explicitamente como una de estas categorias:

- `cache tecnico`
- `snapshot de auditoria`
- `read model`
- `override/enriquecimiento propio separado`

### Estado del repo revisado antes de este documento

Antes de documentar esta arquitectura se reviso:

- [C:\Users\smashme\Documents\New project 3\packages\last-app\src\index.ts](C:\Users\smashme\Documents\New%20project%203\packages\last-app\src\index.ts)
- [C:\Users\smashme\Documents\New project 3\docs\contracts\last-api.md](C:\Users\smashme\Documents\New%20project%203\docs\contracts\last-api.md)
- [C:\Users\smashme\Documents\New project 3\docs\last-app\api-lastapp-openapi.json](C:\Users\smashme\Documents\New%20project%203\docs\last-app\api-lastapp-openapi.json)
- [C:\Users\smashme\Documents\New project 3\apps\local-server\src\last-app.ts](C:\Users\smashme\Documents\New%20project%203\apps\local-server\src\last-app.ts)
- [C:\Users\smashme\Documents\New project 3\packages\types\src\index.ts](C:\Users\smashme\Documents\New%20project%203\packages\types\src\index.ts)

### Adapter/API Last ya existente en el repo

Hoy ya existen estas funciones o piezas reales relacionadas con Last:

- `fetchOrganizations`
- `fetchLocations`
- `fetchLocation`
- `fetchCatalog`
- `fetchPromotions`
- `fetchFloorplans`
- `createOrderInLast`
- `buildAutoSetupPatch`
- `fetchSetupOptions`

Y en `packages/last-app` ya existe el adapter HTTP minimo real:

- `buildLastHeaders`
- `readResponseBody`
- `requestLastJson`
- `LastApiError`

La frontera actual documentada en `docs/contracts/last-api.md` es:

- `packages/last-app` = adapter HTTP Last puro
- `apps/local-server/src/last-app.ts` = integracion viva, persistencia local, cache, auditoria, setup y payloads operativos

---

## 2. Papel de `apps/qr-server`

`apps/qr-server` es el backend online SaaS.

Su responsabilidad es:

- resolver `tenant` y `location` online
- verificar Firebase Auth
- orquestar `qr-pedidos`
- llamar a Last.app como `adapter/proxy` cuando haga falta
- leer todo lo posible desde Last.app antes de crear logica propia
- crear y conservar una `OrderSession` propia para trazabilidad
- guardar historial, tracking y tokens FCM en Firestore
- enviar push notifications
- gestionar Stripe solo si el pago online **no** lo gestiona Last.app

### Reglas especificas de `qr-server`

- no debe calcular delivery fee, minimum basket ni estimated delivery minutes como fuente propia
- no debe mantener un catalogo propio editable como fuente principal
- no debe crear un motor operativo paralelo a Last.app
- no debe inventar nombres o estados paralelos si ya existe nomenclatura canonica en `packages/types`
- no implementara delivery propio hasta agotar la revision de API Last

### Papel correcto frente a Last

`qr-server` no sustituye a Last.app.

Hace de:

- adapter
- orchestrator
- backend SaaS
- capa de experiencia online

Pero no de:

- TPV operativo principal
- catalogo operativo principal
- motor de mesas
- motor de delivery, si Last ya lo resuelve

---

## 3. Papel de Firestore

Firestore **no** es:

- catalogo principal
- motor de delivery
- TPV
- fuente de locations, mesas o catalogs si Last.app ya lo expone

Firestore **si** es la persistencia del estado SaaS propio:

- perfiles de cliente
- historial
- tracking
- tokens FCM
- estado online de sesiones
- snapshots minimos de auditoria
- overrides minimos

### Reglas sobre Firestore

- `catalog cache` solo si se decide por rendimiento, nunca como fuente de verdad
- snapshots de pedido solo para auditoria e historial, no para reemplazar el pedido operativo de Last.app
- los overrides deben referenciar IDs de Last:
  - `productId`
  - `locationId`
  - `catalogId`
  - `lastTableId`

### Que no guardar como verdad principal en Firestore

Si Last.app ya expone el dato, Firestore no debe convertirse en owner primario de:

- products
- modifiers
- promotions
- locations
- tables
- delivery zones
- delivery fees
- preparation times
- workingTimes

---

## 4. Papel de `local-server`

`apps/local-server` sigue siendo el stack local por restaurante o `location`.

Su ownership sigue siendo:

- CashDro
- Artemis
- impresora
- `payment_jobs`
- cobro fisico
- operacion presencial

### Reglas para `local-server`

- no se toca en las fases actuales de `qr-server`
- no debe absorber `qr-server`
- no debe convertirse en backend SaaS
- no debe pasar a ser la fuente de verdad online de clientes, historial o tenants
- el modelo delivery propio de `apps/local-server` es legado, fallback o configuracion local existente, pero no debe convertirse automaticamente en la fuente SaaS online si Last.app ya cubre delivery
- todo lo que ya funciona en `local-server` y `kiosk-web` se conserva:
  - CashDro
  - Artemis
  - `payment_jobs`
  - impresora
  - cobro fisico
  - flujo actual de envio del kiosko a Last

### Frontera correcta

- `local-server` = hardware y operacion local
- `kiosk-web` = frontend local congelado salvo cambios futuros explicitamente aislados
- `qr-server` = backend online SaaS

---

## 5. Reglas anti-duplicacion

No duplicar:

- catalogo Last
- `products`, `modifiers` o `promotions` si Last los expone
- `locations`
- mesas
- zonas de reparto
- coste de delivery
- tiempos
- admin
- endpoints, si pueden vivir en `qr-server` o `local-server` con owner claro

### Reglas de contrato

No crear nombres alternativos a los canonicos del contrato `OrderSession`.

No crear campos propios tipo:

- `status` si duplica `operationalStatus`
- `paymentMethod` si duplica `paymentMode`
- `source` si duplica `channel`
- `totalAmount` si duplica `total`
- `deliveryFee` propio si Last.app ya devuelve el coste operativo

### Regla de ownership

Cada dato debe tener un owner unico:

- Last.app
- Firestore
- `local-server`
- `qr-server` como capa derivada o de sesion

Si no esta claro el owner, no se implementa todavia.

---

## 6. Que si puede mejorar nuestro sistema

Nuestro sistema si puede aportar una capa propia en:

- UX de `qr-pedidos`
- login Google
- historial cliente
- tracking cliente
- FCM push
- branding visual
- textos comerciales
- imagenes enriquecidas
- badges
- orden visual de productos
- ingredientes removibles si Last.app no los modela de forma suficiente
- sugerencias, upsell, cross-sell y bundles propias si no vienen de Last
- overrides minimos separados de la fuente Last

### Regla de enriquecimiento

Todo enriquecimiento propio debe:

- referenciar IDs originales de Last
- no reemplazar el dato original de Last
- vivir claramente como `override`, `cache` o `read model`

Ejemplos validos:

- `imageOverrideUrl`
- `commercialDescription`
- `hiddenInQr`
- `channelVisibility`
- `removableIngredients`

Ejemplos no validos si Last ya los expone:

- precio principal
- categoria principal
- nombre principal del producto
- estado operativo del pedido

---

## 7. Nomenclatura canonica

La nomenclatura canonica debe salir del contrato existente en:

- [C:\Users\smashme\Documents\New project 3\packages\types\src\index.ts](C:\Users\smashme\Documents\New%20project%203\packages\types\src\index.ts)

### Nombres canonicos

- `OrderSession`
- `orderSessionId`
- `externalId`
- `organizationId`
- `locationId`
- `brandId`
- `catalogId`
- `tableId`
- `lastTableId`
- `channel`
- `paymentMode`
- `operationalStatus`
- `paymentStatus`
- `lastSyncStatus`
- `total`
- `currency`

### Nombres que no se deben introducir si duplican

- `status` si duplica `operationalStatus`
- `paymentMethod` si duplica `paymentMode`
- `source` si duplica `channel`
- `totalAmount` si duplica `total`
- `lastOrderId` si el contrato termina usando `LastOrderLink` u otro nombre canonico
- `deliveryFee` propio si Last.app ya lo devuelve como dato operativo

### Observacion importante

En `packages/types` hoy existe `OrderSourceContext.source` con un comentario pendiente de decision documental.

Mientras no se cierre esa decision, en la arquitectura nueva no se debe promover `source` como owner principal si el concepto canonico real es `channel`.

---

## 8. Firestore modelo minimo, Last-first

Este modelo es minimo y orientativo.

No convierte Firestore en fuente operativa principal.

### `/tenants/{tenantId}`

Guarda:

- `slug`
- `domain`
- configuracion online minima
- referencias Last:
  - `organizationId`
  - `defaultLocationId`
  - `brandId`, si aplica

### `/tenants/{tenantId}/locations/{locationId}`

Guarda:

- referencias Last:
  - `locationId`
  - `catalogId`
- configuracion online minima
- branding si aplica

### `/tenants/{tenantId}/orderSessions/{orderSessionId}`

Guarda:

- `OrderSession` propia con nomenclatura canonica
- IDs de Last
- snapshots minimos de importes y estado para auditoria e historial

No sustituye:

- el pedido operativo de Last
- el tab operativo de Last
- el catalogo de Last

### `/tenants/{tenantId}/customers/{uid}`

Guarda:

- perfil Firebase o cliente

### `/tenants/{tenantId}/customers/{uid}/orders/{orderSessionId}`

Guarda:

- historial ligero del cliente

### `/tenants/{tenantId}/fcmTokens/{tokenId}`

Guarda:

- token push

### `/tenants/{tenantId}/catalogOverrides/{productId}` opcional

Solo para enriquecimiento separado:

- `removableIngredients`
- `commercialDescription`
- `imageOverrideUrl`
- `hiddenInQr`
- `channelVisibility`

Nunca para:

- precio principal
- categoria principal
- nombre principal

Si Last ya los proporciona.

### `/tenants/{tenantId}/suggestionRules/{ruleId}` opcional

Solo si las sugerencias no vienen de Last.

Campos esperables:

- `channel: kiosk | qr | both`
- trigger
- target
- prioridad
- horario, si aplica

---

## 9. Relacion con Last.app API

Antes de construir cualquier feature hay que responder siempre estas preguntas:

1. ?Last.app ya lo expone?
2. ?Ya existe adapter en `packages/last-app` o en `apps/local-server/src/last-app.ts`?
3. ?Podemos leerlo y adaptarlo?
4. ?Necesitamos solo cache o snapshot?
5. ?Es un override propio o seria duplicacion?

### Regla de decision

Si Last.app lo expone:

- se implementa `adapter/proxy`
- se evita recrearlo como modelo operativo propio

Si Last.app **no** lo expone:

- entonces y solo entonces se propone modelo propio

### Aplicacion practica hoy

Con el estado actual del repo, antes de construir:

- catalogo online
- locations online
- mesas online
- promociones online
- delivery info online
- creacion de pedido online

Hay que mirar primero:

- `docs/contracts/last-api.md`
- `docs/last-app/api-lastapp-openapi.json`
- `packages/last-app/src/index.ts`
- `apps/local-server/src/last-app.ts`

---

## Auditoria Last.app y politica de fuente de verdad

Contexto de auditoria revisado antes de esta seccion:

- `packages/last-app` hoy es HTTP puro:
  - `buildLastHeaders`
  - `requestLastJson`
  - `LastApiError`
- `apps/local-server/src/last-app.ts` contiene la logica real de integracion Last
- `apps/local-server/src/services/lastSyncService.ts` contiene el sync `OrderSession -> Last tab`
- `apps/local-server/src/services/lastLiveOrdersService.ts` contiene polling de tabs vivos
- `apps/local-server/src/mappers/orderSessionToLast.ts` contiene el mapper interno -> payload Last

Nada de esto se mueve en esta fase. Solo se documenta para fijar ownership y politica de fuente de verdad.

| Dato / operacion | Fuente de verdad | Estado en repo | Uso en qr-server | Persistencia permitida en Firestore | Riesgo de duplicacion |
|---|---|---|---|---|---|
| organizations | Last.app | Existe `fetchOrganizations()` | seleccionar `organizationId` del tenant | guardar solo `organizationId` elegido para el tenant | Alto |
| locations | Last.app | Existen `fetchLocations()` y `fetchLocation()` | listar/activar locations del tenant | guardar solo `locationId` elegido/activo por tenant location | Alto |
| brands | Last.app parcial/embebida en `location` | Resueltas hoy desde `fetchLocation()` y normalizacion local | seleccionar `brandId` necesario para el contexto | guardar solo `brandId` necesario para crear tab | Medio |
| catalogs | Last.app | Existe `fetchCatalog()` | leer catalogo segun `catalogId` por canal/modo | guardar solo `catalogId` por canal/modo y cache tecnico si se decide | Alto |
| products / modifiers / promotions | Last.app | productos y modifiers llegan via catalogo; promociones via `fetchPromotions()` y `fetchPromotionDetails()` | lectura y adaptacion, no edicion como fuente | no editable; solo cache tecnico, snapshot u overrides visuales separados | Muy alto |
| floorplans / tables | Last.app | Existe `fetchFloorplans()` y contrato documentado en `last-api.md` | resolver mesas reales y `lastTableId` | mapping propio `qrToken -> lastTableId` si se activa QR mesa online | Alto |
| delivery zones | Last.app via `GET /locations/{locationId}` | No esta implementado actualmente en el repo, pero el OpenAPI confirma `deliveryAreas` y `shopAreas` | leerlo desde adapter/proxy/cache tecnico | cache tecnico TTL y snapshot en OrderSession, no fuente propia | Muy alto |
| delivery fee | Last.app dentro de `deliveryAreas` / `shopAreas` | No esta implementado actualmente en el repo como lectura online | leerlo desde adapter/proxy/cache tecnico | snapshot en OrderSession, no fuente propia | Muy alto |
| minimumBasket | Last.app dentro de `deliveryAreas` / `shopAreas` | No esta implementado actualmente en el repo como lectura online | leerlo desde adapter/proxy/cache tecnico | snapshot en OrderSession, no fuente propia | Alto |
| estimatedDeliveryMinutes / preparationMinutes | Last.app | OpenAPI confirma `estimatedDeliveryMinutes` y `preparationMinutes`; el repo actual no lo consume online | leerlo desde adapter/proxy/cache tecnico | snapshot en OrderSession, no fuente propia | Alto |
| workingTimes / availability | Last.app | OpenAPI confirma `workingTimes`; el repo actual no lo consume online | leerlo desde adapter/proxy/cache tecnico | cache tecnico o read model ligero, no fuente propia | Alto |
| create tab / order | Last.app | Existe `createOrderInLast()` con `POST /tabs` en `local-server` | `qr-server` futuro debe crear tab post-pago | guardar solo OrderSession, audit y last links; no duplicar motor operativo | Muy alto |
| bills / payments | Last.app + Stripe si el pago online no lo cubre Last | Existen `createBillInLast()` y `createPaymentInLast()` | resolver flujo online con idempotencia clara | snapshot tecnico y relacion por `stripePaymentIntentId` | Alto |
| order status | Last.app | Existe `fetchLastOrderStatus()` y detalle relacionado | tracking cliente y refresh de estado | snapshot para tracking cliente, no fuente principal | Medio |
| customer | Last.app para cliente operativo si se usa en POS | Existen `findLastCustomerByPhone()`, `fetchLastCustomerById()`, `updateLastCustomerPoints()` | perfil SaaS + referencia al cliente operativo | perfil Firebase con referencia `lastCustomerId` | Medio |
| notes | Fuente propia como input cliente, enviada a Last | Hoy se construyen y transforman en el adapter vivo | conservar formato consistente por `orderMode` y canal | snapshot dentro de OrderSession e historial | Bajo |

### Politica derivada de la auditoria

- Si el dato u operacion ya existe en Last.app, `qr-server` debe leerlo, adaptarlo o proxyarlo.
- Firestore solo puede guardar:
  - referencias
  - snapshots de auditoria
  - cache tecnico
  - overrides propios claramente separados
- En delivery, `qr-server` puede calcular si una coordenada cae dentro de una `deliveryArea`, pero la geometria, el `deliveryFee`, el `minimumBasket` y los tiempos vienen de Last.
- Ese calculo no convierte Firestore en fuente de verdad.
- No se debe crear un motor operativo paralelo a Last.app para:
  - catalogo
  - mesas
  - delivery
  - pedidos operativos

### Persistencia permitida en Firestore para delivery

Firestore solo puede guardar:

- cache tecnico TTL de `location` y `deliveryAreas`, si se decide
- snapshot en `OrderSession` de:
  - `matchedDeliveryAreaId`
  - `matchedDeliveryAreaName`
  - `deliveryFee`
  - `minimumBasket`
  - `estimatedDeliveryMinutes`
  - `address`
  - `latitude`
  - `longitude`
  - `source: "last_app_snapshot"`

---

## Delivery Last-first confirmado por OpenAPI

El OpenAPI actual de Last.app confirma que delivery ya existe en la API y que `qr-server` no debe crear una fuente propia de delivery.

### `GET /locations/{locationId}` devuelve

- `deliveryAreas`
- `shopAreas`
- `workingTimes`
- `preparationMinutes`
- `paymentMethods`
- `offlinePaymentMethods`
- `brands` con `catalogs` y `fullCatalogs`

### `deliveryAreas` contiene

- `id`
- `locationId`
- `name`
- `type: polygon | circle`
- `geometry`
- `estimatedDeliveryMinutes`
- `deliveryFee`
- `deliveryExtraMinutes`
- `minimumBasket`
- `enabled`
- `position`
- `color`

### `POST /tabs` acepta

- `delivery.address`
- `delivery.details`
- `delivery.latitude`
- `delivery.longitude`
- `delivery.fee`
- `delivery.comments`
- `delivery.external`
- `delivery.needCutlery`
- `pickupTime`
- `schedulingTime`
- `payments[]`

### Regla de implementacion

`qr-server` puede calcular si una coordenada cae dentro de una `deliveryArea`, pero:

- la geometria viene de Last
- el `deliveryFee` viene de Last
- el `minimumBasket` viene de Last
- el `estimatedDeliveryMinutes` viene de Last
- los `workingTimes` vienen de Last

Ese calculo no convierte Firestore en fuente de verdad.

`qr-server` no debe crear fuente propia de delivery.

---

## Modelo multi-restaurante / multi-location / multi-catalogo

### Modelo general

Un `tenant` SaaS representa un cliente de nuestra plataforma, por ejemplo `smashme`.

Cada tenant:

- se vincula a un `organizationId` de Last.app
- puede tener multiples `locations` vinculadas a distintos `locationId` de Last.app
- cada `location` puede tener multiples `catalogs` de Last
- nuestro sistema no crea catalogos propios
- nuestro sistema solo configura que `catalogId` de Last se usa por canal o modo

Canales o modos a configurar por `location`:

- `kiosk`
- `qr_table`
- `qr_pickup`
- `qr_delivery`

### Ejemplo

```text
Tenant SaaS: smashme
tenantSlug: smashme
hostname: smashme.pideahora.com
organizationId: 59535dfw34rasfdw

Locations:
- smashme-centro -> Last locationId loc_1
- smashme-norte -> Last locationId loc_2
- smashme-sur -> Last locationId loc_3
```

### Regla de ownership

El token de Last.app puede dar acceso a varias `organizations` y varias `locations`.

Nuestro sistema:

- no crea `organizations` propias equivalentes
- no crea `locations` propias equivalentes
- no crea `catalogs` propios equivalentes

Solo guarda:

- referencias
- configuracion de seleccion
- branding y overrides minimos

### Firestore propuesto

```text
/tenants/{tenantId}
{
  tenantId,
  tenantSlug,
  displayName,
  orderWeb: { hostname },
  lastApp: { organizationId },
  online: { enabled }
}

/tenants/{tenantId}/locations/{locationKey}
{
  locationKey,
  slug,
  displayName,
  lastApp: {
    organizationId,
    locationId,
    brandId
  },
  geo: {
    lat,
    lng
  },
  catalogsByChannel: {
    kiosk: { catalogId },
    qr_table: { catalogId },
    qr_pickup: { catalogId },
    qr_delivery: { catalogId }
  },
  online: {
    enabled,
    deliveryEnabled,
    pickupEnabled,
    tableQrEnabled
  }
}
```

### Distincion obligatoria: channel, orderMode y paymentMode

- `channel` = origen del pedido
  - ejemplos: `qr_order`, `kiosk`
- `orderMode` = forma de consumo
  - ejemplos: `table`, `pickup`, `delivery`
- `paymentMode` = forma de pago
  - ejemplos: `online`, `kiosk`, `cashier`, `staff_internal`

No se deben mezclar.

Ejemplos:

QR domicilio pagado online:

- `channel = qr_order`
- `orderMode = delivery`
- `paymentMode = online`

QR mesa pagado en caja:

- `channel = qr_order`
- `orderMode = table`
- `paymentMode = cashier`

Kiosko fisico:

- `channel = kiosk`
- `orderMode = pickup` o `table`
- `paymentMode = kiosk`

### Nota sobre `orderMode`

`orderMode` no existe todavia como campo canonico formalizado en `@kiosk/types` ni en el contrato actual revisado.

Por tanto, en este documento se mantiene como:

- **campo nuevo propuesto pendiente de formalizar**

No se deben crear otros nombres alternativos para ese concepto.

### Reglas anti-duplicacion para este modelo

- no crear `organizations` propias equivalentes a Last organization
- no crear `locations` propias equivalentes a Last location
- no crear `catalogs` propios equivalentes a Last catalog
- no copiar `products`, `modifiers` o `promotions` como fuente principal
- solo guardar referencias Last y configuracion de seleccion
- los `catalogOverrides` deben referenciar `productId`, `catalogId` y `locationId` de Last
- los pedidos deben conservar `organizationId`, `locationId`, `catalogId` y `lastTableId` si aplica

### Ejemplo completo de OrderSession

```json
{
  "orderSessionId": "uuid",
  "tenantId": "smashme",
  "organizationId": "59535dfw34rasfdw",
  "locationId": "loc_123",
  "catalogId": "cat_delivery_004",
  "channel": "qr_order",
  "orderMode": "delivery",
  "paymentMode": "online",
  "paymentStatus": "unpaid",
  "operationalStatus": "pending",
  "lastSyncStatus": "not_sent",
  "total": 2450,
  "currency": "EUR"
}
```

---

## Funciones Last candidatas a extraer en fases futuras

### Candidatas a extraer como adapter o servicio compartido, sin implementacion ahora

- `fetchOrganizations()`
- `fetchLocations()`
- `fetchLocation()`
- `fetchFloorplans()`
- `fetchPromotions()`
- `fetchPromotionDetails()`
- `findLastCustomerByPhone()`
- `fetchLastCustomerById()`
- `updateLastCustomerPoints()`
- `fetchLastTabs()`
- `fetchLastTabById()`
- `fetchLastOrderStatus()`
- `fetchLastOrderStatusDetail()`
- `updateLastOrderStatus()`
- `cancelLastOrder()`
- `createBillInLast()`
- `createPaymentInLast()`
- `normalizeSetupOptions()`
- `buildAutoSetupPatch()`

### Funciones que requieren desacoplar SQLite o efectos locales antes de extraer

- `fetchCatalog()`
- `createOrderInLast()`
- `createOrFindLastCustomer()`

### Motivo de no extraer todavia

Aunque estas funciones existen hoy en el adapter vivo de `local-server`, varias de ellas todavia mezclan:

- cache SQLite
- auditoria
- normalizacion local
- side effects operativos
- payload shaping con contexto de `local-server`

Por eso, en esta fase solo se documentan como candidatas y no se mueven todavia.

---

## Bloqueadores antes de delivery

Ya no son bloqueadores funcionales:

- si Last tiene zonas
- si Last tiene `delivery fee`
- si Last tiene tiempos estimados
- si `POST /tabs` acepta delivery address
- si `POST /tabs` acepta `pickupTime` / `schedulingTime`

Eso ya queda confirmado por el OpenAPI actual de Last.app.

Siguen siendo decisiones tecnicas:

1. como cachear `GET /locations/{locationId}`
2. como validar `polygon` / `circle` en `qr-server`
3. que hacer si dos zonas coinciden
4. que hacer si `deliveryAreas.enabled = false`
5. como mostrar `workingTimes` por brand/catalog
6. como sincronizar cambios de Last sin webhooks
7. cuales son los rate limits de Last para status polling

Mientras eso no este resuelto:

- no se implementa delivery propio en `qr-server`
- no se modela delivery como fuente propia en Firestore
- no se promueve el modelo delivery de `local-server` a fuente SaaS online

---

## 10. Fases actualizadas

### Fase 1

`qr-server` skeleton + Firebase Admin  
**Estado: hecho**

### Fase 2

Documentar arquitectura Last-first  
**Estado: esta tarea**

### Fase 3

`TenantResolver` real desde Firestore, solo con referencias Last minimas

Bloque tecnico recomendado:

- crear tenant real de prueba
- crear location real de prueba
- resolver tenant por `hostname` / `slug`
- devolver `locations` activas
- devolver `catalogsByChannel`
- no tocar `local-server`
- no tocar `kiosk-web`

### Fase 4

Adapter Last de solo lectura para:

- tenant
- location
- catalog
- delivery info

Segun la API existente

### Fase 5

`qr-pedidos` apunta a `qr-server` para:

- config
- catalogo
- delivery info

Todo leido desde Last cuando exista

### Fase 6

`OrderSession` + pago online segun la decision entre Stripe y Last.app

### Fase 7

Historial de cliente + FCM

### Fase 8

Overrides, enriquecimiento y sugerencias online/shared con `channel`, solo donde Last no cubra

### Fase 9

Integracion futura `pay-here` con `local-server`, minima y aislada

---

## 11. Tabla final

| Componente | Owner | Fuente de verdad | Persistencia | Tipo | Toca local-server? | Riesgo de duplicacion |
|---|---|---|---|---|---|---|
| organizations | Last.app | Last.app | Last.app | fuente | No | Alto si se replica como modelo propio |
| locations | Last.app | Last.app | Last.app | fuente | No | Alto |
| brands | Last.app | Last.app | Last.app | fuente | No | Medio |
| catalogs | Last.app | Last.app | Last.app | fuente | No | Alto |
| products | Last.app | Last.app | Last.app | fuente | No | Alto |
| modifiers | Last.app | Last.app | Last.app | fuente | No | Alto |
| promotions | Last.app si las expone | Last.app | Last.app | fuente | No | Medio/alto |
| mesas | Last.app | Last.app | Last.app | fuente | No | Alto |
| table QR mapping publico | qr-server | Firestore + referencia `lastTableId` | Firestore | referencia/overlay | No | Medio |
| tenant online config | qr-server | Firestore | Firestore | fuente SaaS propia | No | Bajo |
| customer profile | qr-server | Firestore | Firestore | fuente SaaS propia | No | Bajo |
| customer order history | qr-server | Firestore + snapshot de OrderSession | Firestore | snapshot/historial | No | Bajo |
| FCM tokens | qr-server | Firestore | Firestore | fuente SaaS propia | No | Bajo |
| catalog cache | qr-server | Last.app | Firestore o cache tecnica futura | cache | No | Medio si se confunde con fuente |
| catalog overrides | qr-server | Firestore con referencias Last | Firestore | override | No | Medio |
| suggestion rules | qr-server o shared layer | Firestore, solo si no vienen de Last | Firestore | fuente propia limitada | No | Medio |
| OrderSession | qr-server | qr-server + referencias Last | Firestore | fuente propia de trazabilidad | No | Medio si intenta sustituir al pedido operativo |
| pedido operativo final | Last.app | Last.app | Last.app | fuente | No | Muy alto si se replica como motor paralelo |
| pagos fisicos | local-server | local-server + hardware | local | fuente local | Si | Alto si se mezcla con SaaS |
| CashDro/Artemis/impresora | local-server | local-server | local | fuente local | Si | Alto |

---

## 12. Decisiones abiertas

Quedan abiertas estas decisiones:

### Pago online

- que parte del pago online la hace Last.app
- que parte la hace Stripe
- si Last ya cubre un flujo suficiente para no duplicarlo

### Delivery

- que estrategia de cache usar para `GET /locations/{locationId}`
- como resolver `polygon` vs `circle`
- que hacer si varias zonas coinciden
- como proyectar `workingTimes` en UX por brand/catalog
- como sincronizar cambios de Last sin webhooks

### Promociones y sugerencias

- si las promociones vienen realmente de Last en todos los casos
- si las sugerencias, upsell y cross-sell seran una capa propia
- como conviviran si una parte viene de Last y otra es override propio

### Ingredientes removibles

- si Last ya modela esto de forma suficiente via modifiers
- o si requiere `override` propio minimo

### Cache

- que datos se cachean por rendimiento
- donde se cachean
- que TTL tendran
- cuando se invalidan

---

## Conclusion

La arquitectura correcta para esta fase es:

- Last.app como fuente operativa externa
- `qr-server` como adapter/orchestrator SaaS
- Firestore como estado online propio, historial, tracking, tokens y overrides minimos
- `local-server` como stack local de hardware y pago presencial

La regla de implementacion es simple:

**si Last.app ya lo expone, se lee y se adapta; no se recrea.**

Reglas adicionales para delivery:

- el modelo delivery propio de `local-server` es legado, fallback o configuracion local existente, pero no debe convertirse automaticamente en la fuente SaaS online si Last.app ya cubre delivery
- `qr-server` no implementara delivery propio hasta agotar la revision de API Last
