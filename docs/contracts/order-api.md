# Order API Contract

## Objetivo

Definir el contrato base de pedidos para las apps `qr-order` y `orders`.

Este documento es normativo: ningún endpoint, payload, campo o nomenclatura relacionada con pedidos debe implementarse si no está definido aquí o referenciado desde este contrato.

## Principios

1. Last.app es la verdad final del pedido operativo.
2. El backend propio es la verdad de sesiones, pedidos temporales, QR, PIN, checkout y sincronización.
3. Stripe es la verdad del cobro online.
4. `qr-order` nunca crea tabs impagados en Last.
5. `orders` puede gestionar excepciones internas bajo control de staff.
6. La nomenclatura técnica debe ser única y estable.

---

## Unidad monetaria

Todos los importes monetarios del contrato propio se expresan en **minor units** de la moneda indicada en `currency`.

| Ejemplo | Valor en el contrato | `currency` |
|---|---|---|
| 12,50 € | `1250` | `EUR` |
| 2,00 € | `200` | `EUR` |
| 0,50 € | `50` | `EUR` |

Esta convención aplica a todos los campos numéricos de precio del dominio propio:

| Campo | Entidad | Descripción |
|---|---|---|
| `unitPrice` | `CatalogProduct` | Precio base del producto en catálogo |
| `priceExtra` | `CatalogModifierOption` | Precio adicional del modificador en catálogo |
| `discountAmount` | `CatalogProductPromotion` | Importe de descuento de la promoción |
| `displayPrice` | `CatalogProductPromotion` | Precio final con descuento aplicado |
| `unitPrice` | `OrderSessionItem` | Precio unitario del ítem en el pedido |
| `totalPrice` | `OrderSessionItem` | Precio total del ítem (unitPrice + modifiers) × quantity |
| `unitPrice` | `OrderSessionItemModifier` | Precio del modificador por unidad |
| `totalPrice` | `OrderSessionItemModifier` | Precio total del modificador |
| `subtotal` | `OrderSession` | Subtotal del pedido antes de descuentos |
| `discountTotal` | `OrderSession` | Total de descuentos aplicados |
| `total` | `OrderSession` | Total final del pedido |

`currency` debe ser un código ISO 4217 (`EUR`, `USD`, etc.). Queda como `string` temporal hasta que se defina como tipo canónico. Ver §Campos pendientes de decisión.

> El backend de Last usa `price` en minor units también. Los mappers de `packages/last-app` no deben convertir unidades — deben trasladar el valor numérico directamente.

---

## Entidades principales

| Entidad | Descripción | Owner |
|---|---|---|
| `OrderSession` | Pedido interno antes o durante su sincronización con Last | Backend propio |
| `LastOrderLink` | Relación entre pedido interno y entidades de Last | Backend propio |
| `OrderSessionEvent` | Auditoría local de cambios y eventos | Backend propio |
| `TableMapping` | Relación entre QR propio y una mesa real de Last | Backend propio |

---

## Identificadores canónicos

| Campo | Tipo | Obligatorio | Owner | Descripción |
|---|---|---:|---|---|
| `orderSessionId` | `string` / `uuid` | Sí | Backend propio | ID interno canónico del pedido |
| `organizationId` | `string` | Sí | Backend propio / Last mapped | Organización o grupo propietario |
| `locationId` | `string` | Sí | Backend propio / Last mapped | Local operativo |
| `brandId` | `string` | Sí | Last / Backend mapped | Marca asociada al pedido |
| `catalogId` | `string` | Sí | Last / Backend mapped | Catálogo usado para construir el pedido |
| `tableId` | `string` / `nullable` | No | Backend propio | Mesa interna o lógica |
| `lastTableId` | `string` / `nullable` | No | Last / Backend mapped | Mesa real en Last — campo de `OrderSession` para vincular mesa antes de crear el tab |
| `stripePaymentIntentId` | `string` / `nullable` | No | Stripe | PaymentIntent usado para cobro online |
| `externalId` | `string` | Sí | Backend propio | ID idempotente enviado a integraciones cuando aplique |

> `lastTabId`, `lastBillId`, `lastPaymentId` y `lastCode` son IDs de Last que viven únicamente en `LastOrderLink`. `OrderSession` no los contiene directamente.

---

## Canales de origen

El campo canónico es `channel`.

| Valor técnico | Descripción | Público / Interno |
|---|---|---|
| `qr_order` | Pedido desde QR público | Público |
| `kiosk` | Pedido desde kiosko | Público / interno |
| `pos` | Pedido desde Last POS | Interno |
| `uber` | Pedido desde Uber | Externo |
| `glovo` | Pedido desde Glovo | Externo |
| `deliveroo` | Pedido desde Deliveroo | Externo |
| `just_eat` | Pedido desde Just Eat | Externo |
| `manual` | Pedido creado por staff | Interno |

No se deben usar variantes como `QR Order`, `qr-order`, `qrOrder`, `last_pos` o `manual_order` en contratos internos.

---

## Estados canónicos

### Estado operativo

Campo: `operationalStatus`.

| Valor | Descripción |
|---|---|
| `pending` | Pedido creado o recibido, pendiente de aceptación operativa |
| `accepted` | Pedido aceptado por operación |
| `preparing` | Pedido en preparación |
| `ready` | Pedido listo para entrega o recogida |
| `delivered` | Pedido entregado |
| `cancelled` | Pedido cancelado |

### Estado de cobro

Campo: `paymentStatus`.

| Valor | Descripción |
|---|---|
| `unpaid` | Pedido sin cobrar |
| `payment_pending` | Cobro iniciado, pendiente o diferido |
| `paid` | Pedido cobrado |
| `payment_failed` | Cobro fallido |
| `refunded` | Pedido reembolsado total o parcialmente |

### Estado de sincronización con Last

Campo: `lastSyncStatus`.

| Valor | Descripción |
|---|---|
| `not_sent` | Pedido aún no enviado a Last |
| `sent` | Pedido enviado correctamente a Last |
| `sync_failed` | Fallo al sincronizar con Last |

---

## Contrato base: `OrderSession`

```ts
type Channel =
  | 'qr_order'
  | 'kiosk'
  | 'pos'
  | 'uber'
  | 'glovo'
  | 'deliveroo'
  | 'just_eat'
  | 'manual';

type OperationalStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

type PaymentStatus =
  | 'unpaid'
  | 'payment_pending'
  | 'paid'
  | 'payment_failed'
  | 'refunded';

type LastSyncStatus =
  | 'not_sent'
  | 'sent'
  | 'sync_failed';

type PreparationTimeMode =
  | 'auto'
  | 'manual'
  | 'inherited';

type PickupTimeSyncStatus =
  | 'pending'
  | 'synced'
  | 'failed';

type PaymentMode =
  | 'online'
  | 'kiosk'
  | 'cashier'
  | 'staff_internal';

type OrderSessionItemType =
  | 'PRODUCT'
  | 'COMBO';

type OrderSessionEventActorType =
  | 'customer'
  | 'staff'
  | 'system'
  | 'webhook';

interface CustomerInfo {
  name?: string | null;
  surname?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
}

interface OrderSessionItemPromotion {
  promotionId: string;
  promotionName: string;
  discountAmount: number;
}

interface OrderSessionItemModifier {
  modifierId: string;
  modifierName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface OrderSessionItem {
  id: string;
  productId: string;
  productName: string;
  type: OrderSessionItemType;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers: OrderSessionItemModifier[];
  promotionId?: string | null;
  promotion?: OrderSessionItemPromotion | null;
  notes?: string | null;
}

interface OrderSession {
  orderSessionId: string;
  externalId: string;

  organizationId: string;
  locationId: string;
  brandId: string;
  catalogId: string;
  tableId?: string | null;
  lastTableId?: string | null;
  tableNameSnapshot?: string | null;

  channel: Channel;
  operationalStatus: OperationalStatus;
  paymentStatus: PaymentStatus;
  lastSyncStatus: LastSyncStatus;

  customer?: CustomerInfo | null;
  notes?: string | null;

  items: OrderSessionItem[];
  subtotal: number;
  discountTotal: number;
  total: number;
  currency: string;

  paymentMode: PaymentMode;
  stripePaymentIntentId?: string | null;
  stripeCheckoutSessionId?: string | null;

  pin4?: string | null;
  qrToken?: string | null;
  expiresAt?: string | null;

  preparationTimeMode?: PreparationTimeMode | null;
  suggestedPreparationMinutes?: number | null;
  confirmedPreparationMinutes?: number | null;
  estimatedReadyAt?: string | null;
  pickupTimeSyncedToLast?: string | null;
  pickupTimeSyncStatus?: PickupTimeSyncStatus | null;

  createdAt: string;
  updatedAt: string;
}
```

### Tabla de valores: `PaymentMode`

| Valor | Descripción | Caso de uso |
|---|---|---|
| `online` | Pago online con Stripe en el momento del checkout | `qr-order` — pago inmediato |
| `kiosk` | Pago en kiosko físico tras generar código de rescate | `qr-order` — pago diferido en kiosko |
| `cashier` | Pago en caja o mostrador, gestionado por personal | `qr-order` — pago diferido en caja |
| `staff_internal` | Pedido creado y gestionado internamente por staff | `orders` — mini comandero |

### Tabla de valores: `OrderSessionItemType`

| Valor | Descripción |
|---|---|
| `PRODUCT` | Ítem individual de catálogo |
| `COMBO` | Conjunto de ítems agrupados como combo |

### Tabla de valores: `OrderSessionEventActorType`

| Valor | Descripción |
|---|---|
| `customer` | Acción iniciada por el cliente final |
| `staff` | Acción iniciada por personal del restaurante |
| `system` | Acción automática del sistema |
| `webhook` | Acción originada por webhook externo (Stripe, Last) |

### Reglas de `OrderSessionItem`

- `name`, `price` y `comments` están descartados. Usar `productName`, `unitPrice`/`totalPrice` y `notes`.
- `modifiers` es un array requerido (vacío si no hay modificadores). No usar `modifiers?`.
- `unitPrice` y `totalPrice` son los campos canónicos de precio. No usar `priceImpact` ni variantes.
- `id` es obligatorio y debe ser único por ítem dentro de la sesión.

### Modelo canónico: `CustomerInfo`

Datos opcionales del cliente asociados al pedido. Agrupa los campos de contacto bajo un objeto único.

| Campo canónico | Aliases descartados |
|---|---|
| `name` | `customerName` |
| `surname` | — |
| `phoneNumber` | `phone`, `customerPhone` |
| `email` | `customerEmail` |

> Los campos planos `customerName`, `customerPhone`, `customerEmail` y el alias `phone` están descartados. Usar `customer: CustomerInfo | null` en `OrderSession`.

---

## Modelo de estados de `OrderSession`

### Descripción de campos canónicos

| Campo | Tipo | Requerido | Descripción |
|---|---|:---:|---|
| `orderSessionId` | `string (uuid)` | Sí | ID interno canónico — nunca se expone como identificador de usuario |
| `externalId` | `string` | Sí | ID idempotente único generado por el cliente al crear la sesión — se envía a Last como referencia externa del tab |
| `organizationId` | `string` | Sí | Organización propietaria del local |
| `locationId` | `string` | Sí | Local operativo donde se realiza el pedido |
| `brandId` | `string` | Sí | Marca asociada al pedido (desde Last) |
| `catalogId` | `string` | Sí | Catálogo usado para construir el pedido |
| `tableId` | `string?` | No | ID del mapping QR interno del backend — referencia a `TableMapping` |
| `lastTableId` | `string?` | No | ID real de la mesa en Last — se envía en `POST /tabs` como `tableId` |
| `tableNameSnapshot` | `string?` | No | Snapshot del nombre de mesa en Last al crear la sesión — fallback visual si Last no está disponible; no modifica el ownership de la mesa |
| `channel` | `Channel` | Sí | Canal de origen del pedido — **inmutable tras creación** |
| `operationalStatus` | `OperationalStatus` | Sí | Estado operativo del pedido — transiciones en `docs/domain/order-lifecycle.md` §Transiciones operativas válidas |
| `paymentStatus` | `PaymentStatus` | Sí | Estado del cobro — ver §Transiciones de `paymentStatus` |
| `lastSyncStatus` | `LastSyncStatus` | Sí | Estado de sincronización con Last — ver §Transiciones de `lastSyncStatus` |
| `customer` | `CustomerInfo?` | No | Datos del cliente — `customer.name` se requiere antes del pago; resto opcional |
| `notes` | `string?` | No | Nota general del pedido |
| `items` | `OrderSessionItem[]` | Sí | Líneas del pedido — array no vacío |
| `subtotal` | `number` | Sí | Suma de `items[].totalPrice` antes de descuentos — en minor units |
| `discountTotal` | `number` | Sí | Total de descuentos aplicados — en minor units; `0` si no hay descuentos |
| `total` | `number` | Sí | `subtotal - discountTotal` — importe final en minor units |
| `currency` | `string` | Sí | Código ISO 4217 (`EUR`, `USD`) |
| `paymentMode` | `PaymentMode` | Sí | Modo de pago — **inmutable tras creación** |
| `stripePaymentIntentId` | `string?` | No | ID del PaymentIntent de Stripe — asignado al crear Checkout Session; `null` para `paymentMode != 'online'` |
| `stripeCheckoutSessionId` | `string?` | No | ID de la Stripe Checkout Session — asignado al crear Checkout Session; `null` para `paymentMode != 'online'` |
| `pin4` | `string?` | No | PIN de 4 dígitos numéricos — único por `locationId` en ventana activa; solo para `paymentMode: 'cashier'` o `'kiosk'` |
| `qrToken` | `string?` | No | Token de rescate alfanumérico generado por el backend para pedidos cashier/kiosk — **distinto del `qrToken` de `TableMapping`** (que identifica la mesa física) |
| `expiresAt` | `string?` | No | ISO 8601 — TTL de la sesión de cobro diferido; `null` para `paymentMode: 'online'` y `'staff_internal'` |
| `preparationTimeMode` | `PreparationTimeMode?` | No | Modo de cálculo del tiempo de preparación |
| `suggestedPreparationMinutes` | `number?` | No | Tiempo sugerido por el sistema en minutos |
| `confirmedPreparationMinutes` | `number?` | No | Tiempo confirmado por el operador en minutos |
| `estimatedReadyAt` | `string?` | No | ISO 8601 — `createdAt + confirmedPreparationMinutes` |
| `pickupTimeSyncedToLast` | `string?` | No | ISO 8601 — timestamp del último sync de `estimatedReadyAt` a Last |
| `pickupTimeSyncStatus` | `PickupTimeSyncStatus?` | No | Estado del sync de pickup time con Last |
| `createdAt` | `string` | Sí | ISO 8601 — creación de la sesión |
| `updatedAt` | `string` | Sí | ISO 8601 — última modificación — clave del polling incremental de `orders` |

> **`qrToken` en `OrderSession` ≠ `qrToken` en `TableMapping`.** El `OrderSession.qrToken` es el token de rescate generado por el backend al crear un pedido cashier/kiosk — el código QR que el cliente recibe para ir a pagar. El `TableMapping.qrToken` es el token codificado en el QR físico de la mesa. Son tokens distintos con usos distintos: el de `TableMapping` resuelve `GET /tables/resolve/{qrToken}`; el de `OrderSession` rescata `GET /order-sessions/recovery/{tokenOrCode}`.

---

### Semántica de campos por `paymentMode`

Campos que varían según el modo de pago. El resto de campos aplican igual para todos los modos.

| Campo | `online` | `cashier` | `kiosk` | `staff_internal` |
|---|---|---|---|---|
| `pin4` | `null` | Requerido — 4 dígitos, único por `locationId` en ventana activa | Requerido | `null` |
| `qrToken` (rescate) | `null` | Opcional — alfanumérico secundario de rescate | Opcional | `null` |
| `expiresAt` | `null` | `createdAt + 30 min` | Configurable por `KioskConfig` | `null` |
| `stripePaymentIntentId` | Asignado al crear Checkout Session | `null` | `null` | `null` |
| `stripeCheckoutSessionId` | Asignado al crear Checkout Session | `null` | `null` | `null` |

---

### Combinaciones válidas de `(channel, paymentMode)`

`channel` describe el origen del pedido y es inmutable. `paymentMode` describe cómo se cobra.

| `channel` | `paymentMode` | Válido | Notas |
|---|---|:---:|---|
| `qr_order` | `online` | ✅ | Cliente paga con Stripe en el momento del checkout |
| `qr_order` | `cashier` | ✅ | Cliente paga más tarde en barra — genera `pin4` y `qrToken` de rescate |
| `qr_order` | `kiosk` | ✅ | Cliente paga más tarde en kiosko — genera `pin4` y `qrToken` de rescate |
| `qr_order` | `staff_internal` | ❌ | Modo interno exclusivo de `channel: 'manual'` |
| `kiosk` | `kiosk` | ✅ | Kiosko auto-servicio gestiona su propio flujo de pago |
| `kiosk` | `online` | ❌ | Kiosko no usa Stripe Checkout hosted en fase 1 |
| `kiosk` | `cashier` | ❌ | Kiosko gestiona su propio flujo de pago |
| `kiosk` | `staff_internal` | ❌ | |
| `manual` | `cashier` | ✅ | Staff crea pedido; cliente paga en barra |
| `manual` | `staff_internal` | ✅ | Staff crea y gestiona internamente |
| `manual` | `online` | ❌ | Sin Stripe para pedidos manuales en fase 1 |
| `manual` | `kiosk` | ❌ | |
| `pos`, `uber`, `glovo`, `deliveroo`, `just_eat` | — | n/a | Canales externos — no crean `OrderSession` en backend propio en fase 1 |

---

### Combinaciones válidas de `(paymentStatus, lastSyncStatus)`

| `paymentStatus` | `lastSyncStatus` | Estado | Descripción |
|---|---|:---:|---|
| `unpaid` | `not_sent` | ✅ Estable | Estado inicial de toda sesión |
| `unpaid` | `sent` | ❌ PROHIBIDO | Tab no puede existir en Last si el pedido no está cobrado |
| `unpaid` | `sync_failed` | ❌ PROHIBIDO | No se intenta sync sobre pedido no cobrado |
| `payment_pending` | `not_sent` | ✅ Estable | Stripe Checkout activo — pago no confirmado aún |
| `payment_pending` | `sent` | ❌ PROHIBIDO | No se sincroniza mientras el pago está en curso |
| `payment_pending` | `sync_failed` | ❌ PROHIBIDO | |
| `paid` | `not_sent` | ⚠️ Transitorio | Instante entre cobro confirmado e inicio del sync — no debe persistir en DB |
| `paid` | `sent` | ✅ Estable | Estado normal post-pago — tab existe en Last |
| `paid` | `sync_failed` | ✅ Estable | Cobro firme, Last falló — incidencia operativa en `orders` |
| `payment_failed` | `not_sent` | ✅ Estable | Stripe rechazó — sin sync pendiente |
| `payment_failed` | `sent` | ❌ PROHIBIDO | |
| `payment_failed` | `sync_failed` | ❌ PROHIBIDO | |
| `refunded` | `not_sent` | ❌ PROHIBIDO | Solo se reembolsa lo cobrado; lo cobrado siempre intentó sync |
| `refunded` | `sent` | ✅ Estable | Reembolso ejecutado — Last notificado |
| `refunded` | `sync_failed` | ✅ Estable | Reembolso ejecutado — notificación a Last falló |

---

### Combinaciones válidas de `(operationalStatus, paymentStatus)`

| `operationalStatus` | `unpaid` | `payment_pending` | `paid` | `payment_failed` | `refunded` |
|---|:---:|:---:|:---:|:---:|:---:|
| `pending` | ✅ | ✅ | ✅ | ✅ | — |
| `accepted` | ❌ | ❌ | ✅ | ❌ | ✅ |
| `preparing` | ❌ | ❌ | ✅ | ❌ | ✅ |
| `ready` | ❌ | ❌ | ✅ | ❌ | ✅ |
| `delivered` | ❌ | ❌ | ✅ | ❌ | ✅ |
| `cancelled` | ✅ | ✅ | ✅ | ✅ | ✅ |

> `refunded + pending` (—) es teóricamente posible si el reembolso se ejecuta antes de que el pedido sea aceptado operativamente. Un reembolso total convierte `operationalStatus → 'cancelled'` automáticamente. Ver `docs/domain/order-lifecycle.md` §Flujo E.

---

### Transiciones de `paymentStatus`

```
unpaid ──────────────────────────────────────────────────────► paid         (cashier/kiosk: confirm-payment)
unpaid ──────────────► payment_pending ──────────────────────► paid         (online: Stripe webhook OK)
                                       └──────────────────────► payment_failed (online: Stripe rechazado)
paid ────────────────────────────────────────────────────────► refunded     (staff autorizado: POST /refund)
```

| Transición | Trigger | Ejecutor |
|---|---|---|
| `unpaid → payment_pending` | Backend crea Stripe Checkout Session | Backend — `POST /order-sessions/{id}/checkout/stripe` |
| `unpaid → paid` | `confirm-payment` exitoso | Backend — desde `orders` (JWT staff) o `kiosk-web` (service token) |
| `payment_pending → paid` | Webhook Stripe `checkout.session.completed` | Backend — webhook handler con firma verificada |
| `payment_pending → payment_failed` | Webhook Stripe con pago rechazado | Backend — webhook handler |
| `paid → refunded` | Reembolso aprobado por staff | Backend — `POST /order-sessions/{id}/refund`, rol `admin` (o `manager` pendiente) |

**Regla:** ninguna transición de `paymentStatus` puede ejecutarse desde un frontend directamente. Toda transición pasa por el backend.

---

### Transiciones de `lastSyncStatus`

| Transición | Trigger | Ejecutor | Precondición |
|---|---|---|---|
| `not_sent → sent` | Tab creado exitosamente en Last | Backend | `paymentStatus: 'paid'` |
| `not_sent → sync_failed` | Fallo al intentar crear tab en Last | Backend | `paymentStatus: 'paid'` |
| `sync_failed → sent` | Reintento exitoso | Backend — `POST /order-sessions/{id}/send-to-last` desde `orders` | `paymentStatus: 'paid'` |
| `sync_failed → sync_failed` | Reintento fallido | Backend | `paymentStatus: 'paid'` |

**Regla crítica:** `lastSyncStatus` solo puede cambiar de `not_sent` cuando `paymentStatus: 'paid'`. Intentar sync con `paymentStatus != 'paid'` es un bug de implementación que el backend debe rechazar.

> Las transiciones de `operationalStatus` están definidas en `docs/domain/order-lifecycle.md` §Transiciones operativas válidas y no se duplican aquí.

---

### Invariantes de `OrderSession`

Estas reglas son absolutas. Ninguna implementación puede violarlas.

1. **`channel` es inmutable.** Se establece al crear `OrderSession` y nunca cambia. El punto de cobro (barra, kiosko) no modifica `channel`.

2. **`paymentMode` es inmutable.** Se establece al crear `OrderSession`. Que `kiosk-web` cobre un pedido `qr_order cashier` no cambia ni `channel` ni `paymentMode`.

3. **Tab en Last solo tras `paymentStatus: 'paid'`.** El backend no puede intentar `POST /tabs` en Last si `paymentStatus != 'paid'`. Es un bug de implementación hacerlo antes.

4. **Cobro firme.** Una vez `paymentStatus: 'paid'`, no puede revertirse a `unpaid` ni a `payment_pending`. La única transición permitida es `paid → refunded`.

5. **Cashier unpaid no existe en Last.** `paymentStatus: 'unpaid'` + `lastSyncStatus: 'not_sent'` implica que el pedido no existe en Last, no está en cocina y no puede rescatarse desde el TPV de Last.

6. **`confirm-payment` es idempotente por `idempotencyKey`.** Misma `idempotencyKey` + sesión ya `paid` → `200` con `OrderSession` actual, sin reprocesar. `idempotencyKey` distinto + sesión ya `paid` → `409 session_already_paid`.

7. **Sesión expirada no se puede cobrar.** Si `expiresAt < now` y `paymentStatus: 'unpaid'`, `confirm-payment` devuelve `410 session_expired`. El cliente debe crear un nuevo pedido.

8. **`operationalStatus` solo avanza post-pago.** Un pedido no puede pasar de `pending` a `accepted` mientras `paymentStatus: 'unpaid'` o `'payment_pending'`.

9. **`pin4` único por `locationId` en ventana activa.** El backend detecta colisiones antes de persistir y regenera. No pueden coexistir dos sesiones `unpaid` con el mismo `pin4` en el mismo `locationId`.

10. **`updatedAt` siempre actualizado.** El backend actualiza `updatedAt` ante cualquier cambio de `operationalStatus`, `paymentStatus`, `lastSyncStatus`, `confirmedPreparationMinutes`, `estimatedReadyAt` o `pickupTimeSyncStatus`. Es el cursor del polling incremental de `orders`.

11. **Solo el backend crea y muta `OrderSession`.** `qr-order`, `orders` y `kiosk-web` nunca escriben directamente en `OrderSession`. Solo el backend la modifica como reacción a eventos (requests autenticados, webhooks).

12. **`expiresAt` nulo para `paymentMode: 'online'` y `'staff_internal'`.** Solo los modos de cobro diferido tienen ventana de expiración.

---

### Relaciones con sistemas externos

| Sistema / app | Operación | Endpoint / mecanismo | Condición |
|---|---|---|---|
| `qr-order` | Crea `OrderSession` | `POST /order-sessions` | Al confirmar checkout (nunca antes) |
| `qr-order` | Consulta estado post-pago | `GET /order-sessions/{id}` | Polling hasta `paymentStatus: 'paid'` |
| `orders` | Lista sesiones activas | `GET /order-sessions?active=true&since=...` | Polling cada 10s |
| `orders` | Cambia `operationalStatus` | `PATCH /order-sessions/{id}/status` | Rol mínimo según transición — ver `docs/auth/auth-model.md` §4 |
| `orders` | Busca por `pin4` | `GET /order-sessions/recovery/{pin4}` | Rol mínimo `staff` |
| `orders` | Confirma cobro cashier | `POST /order-sessions/{id}/confirm-payment` | Rol mínimo `staff`; `paymentStatus` debe ser `'unpaid'` |
| `orders` | Reintenta sync con Last | `POST /order-sessions/{id}/send-to-last` | Rol mínimo `manager`; `paymentStatus: 'paid'` + `lastSyncStatus: 'sync_failed'` |
| `kiosk-web` | Busca por `pin4` | `GET /order-sessions/recovery/{pin4}` vía `local-server` | `PUBLIC_API_SERVICE_TOKEN` |
| `kiosk-web` | Confirma cobro físico | `POST /order-sessions/{id}/confirm-payment` vía `local-server` | `PUBLIC_API_SERVICE_TOKEN`; `actorType: 'system'` |
| **Stripe** | Confirma `paymentStatus → 'paid'` | Webhook `checkout.session.completed` — firma verificada | Solo vía webhook — nunca desde frontend |
| **Stripe** | Marca `paymentStatus → 'payment_failed'` | Webhook de pago rechazado | Solo vía webhook |
| **Last.app** | Recibe el tab del pedido | Backend llama `POST /tabs` | Solo tras `paymentStatus: 'paid'` |
| **Last.app** | Owner de `operationalStatus` post-sync | Mapeo de estados Last → enum canónico | Tras `lastSyncStatus: 'sent'` |

**Regla:** ningún sistema externo (Stripe, Last) muta `OrderSession` directamente. Solo el backend propio la muta como reacción a los eventos externos.

---

## Contrato base: `LastOrderLink`

```ts
interface LastOrderLink {
  id: string;
  orderSessionId: string;
  lastTabId?: string | null;
  lastBillId?: string | null;
  lastPaymentId?: string | null;
  lastCode?: string | null;
  lastPayloadHash?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## Contrato base: `OrderSessionEvent`

```ts
interface OrderSessionEvent {
  id: string;
  orderSessionId: string;
  type: string;
  actorType: OrderSessionEventActorType;
  actorId?: string | null;
  rawJson?: Record<string, unknown> | null;
  createdAt: string;
}
```

---

## Endpoints internos recomendados

Estos endpoints son orientativos para el backend propio. La forma final puede cambiar, pero los conceptos no deben cambiar sin actualizar este documento.

| Método | Endpoint | Propósito | App consumidora |
|---|---|---|---|
| `GET` | `/tables/resolve/{qrToken}` | Resolver QR de mesa → restaurante + local + mapping QR + mesa real de Last + catálogo | `qr-order` |
| `GET` | `/order-sessions` | Listar pedidos activos para `orders` — con filtro `active` e incremental `since` | `orders` |
| `POST` | `/order-sessions` | Crear pedido local | `qr-order`, `orders` |
| `GET` | `/order-sessions/{orderSessionId}` | Consultar pedido individual | `qr-order`, `orders` |
| `GET` | `/order-sessions/{orderSessionId}/events` | Historial de eventos de auditoría de un pedido — solo lectura | `orders` |
| `PATCH` | `/order-sessions/{orderSessionId}/status` | Cambiar estado operativo | `orders` |
| `PATCH` | `/order-sessions/{orderSessionId}/preparation-time` | Confirmar tiempo | `orders` |
| `POST` | `/order-sessions/{orderSessionId}/checkout/stripe` | Crear checkout online | `qr-order` |
| `POST` | `/order-sessions/{orderSessionId}/cancel` | Cancelar sesión expirada o por cliente | Backend / `qr-order` |
| `POST` | `/order-sessions/{orderSessionId}/send-to-last` | Crear tab en Last | Backend / `orders` |
| `POST` | `/order-sessions/{orderSessionId}/refund` | Iniciar reembolso vía Stripe y notificar Last | `orders` |
| `GET` | `/order-sessions/recovery/{tokenOrCode}` | Recuperar sesión cashier pendiente de cobro. `tokenOrCode` acepta `pin4` (método principal) o código de rescate (secundario). Devuelve `OrderSession` si existe, no ha expirado y `paymentStatus` es `'unpaid'`. Ver §Recovery. | `orders`, kiosko (vía local-server) |
| `POST` | `/order-sessions/{orderSessionId}/confirm-payment` | Confirmar cobro físico o en caja — marca `paymentStatus: 'paid'` y dispara envío a Last | `orders`, kiosko (vía local-server) |
| `POST` | `/stripe/webhook` | Recibir eventos de Stripe (firma verificada) | Stripe → Backend |
| `GET` | `/catalog/{catalogId}` | Catálogo normalizado con promociones enriquecidas — proxy de Last | `qr-order` |

### Parámetros de `GET /order-sessions`

Endpoint protegido — requiere token de sesión válido de `orders`. El backend aplica `locationId` del JWT automáticamente; el cliente no lo envía.

| Parámetro | Tipo | Requerido | Descripción |
|---|---|:---:|---|
| `active` | `boolean` | No | Si `true`, el backend aplica el filtro de visibilidad de `orders` (ver abajo) |
| `since` | `string` (ISO 8601) | No | Polling incremental — devuelve solo sesiones con `updatedAt > since`. Si se omite, devuelve todos los activos. |
| `limit` | `number` | No | Máximo de resultados. Por defecto y máximo en fase 1: `100`. |

**Filtro de visibilidad `active=true`** — el backend incluye una `OrderSession` si cumple alguna de estas condiciones:

| Condición | Por qué aparece |
|---|---|
| `operationalStatus` in `['pending', 'accepted', 'preparing', 'ready']` | Pedido operativo activo |
| `paymentStatus: 'unpaid'` AND `paymentMode: 'cashier'` | Pendiente de rescate por caja |
| `paymentStatus: 'paid'` AND `lastSyncStatus: 'sync_failed'` | Incidencia operativa — requiere reenvío a Last |

**Ordenación por defecto:** `updatedAt` descendente.

**Contrato de respuesta:**

```ts
interface OrderSessionListResponse {
  items: OrderSession[];
  total: number;        // total de resultados (no paginado en fase 1)
  polledAt: string;    // ISO 8601 — timestamp del servidor al procesar el request; usar como valor de `since` en el siguiente poll
}
```

> `polledAt` es el campo canónico para el cursor del siguiente poll incremental. El cliente no debe usar `Date.now()` local para calcular `since` — debe usar el `polledAt` del último response exitoso para evitar gaps por desfase de reloj entre cliente y servidor.

**Regla de `updatedAt`:** el backend debe actualizar `updatedAt` en `OrderSession` ante cualquier cambio de `operationalStatus`, `paymentStatus`, `lastSyncStatus`, `confirmedPreparationMinutes`, `estimatedReadyAt` o `pickupTimeSyncStatus`. Es la clave del sistema de polling incremental.

---

### `GET /order-sessions/{orderSessionId}/events`

Devuelve el historial completo de eventos de auditoría de una `OrderSession`. Solo lectura — no crea eventos ni muta la sesión.

**Autenticación:** requiere token de sesión válido de `orders` (JWT Supabase). En fase local puede exponerse vía `local-server` sin auth mientras no exista Supabase Auth real.

**Parámetros de path:**

| Parámetro | Tipo | Requerido | Descripción |
|---|---|:---:|---|
| `orderSessionId` | `string` (UUID) | ✅ | ID de la `OrderSession` |

**Sin parámetros de query en fase 1.** El endpoint devuelve todos los eventos de la sesión sin paginación. Si en fases futuras el volumen lo requiere, se añadirá `limit`/`cursor` — no diseñar para eso ahora.

**Respuesta exitosa `200 OK`:**

```ts
interface OrderSessionEventsResponse {
  orderSessionId: string;
  events: OrderSessionEvent[];  // ver §Contrato base: OrderSessionEvent
}
```

**Ordenación:** `createdAt` ascendente — el evento más antiguo primero. El cliente no debe asumir ningún otro orden.

**Contenido:** el backend devuelve todos los eventos, tanto funcionales como técnicos. La UI de `orders` decide cuáles mostrar según la clasificación en `docs/domain/order-lifecycle.md §Modelo de auditoría — Clasificación funcional vs técnico`. El backend no filtra por tipo.

**Errores:**

| Código HTTP | `code` | Cuándo |
|---|---|---|
| `404` | `session_not_found` | No existe `OrderSession` con ese `orderSessionId` |
| `401` | `unauthorized` | Sin token válido (cuando auth esté activa) |
| `403` | `forbidden` | El `locationId` del JWT no coincide con el de la sesión |

**Reglas de consistencia:**

1. Si `events` está vacío (sesión sin eventos registrados), el backend devuelve `200` con `events: []` — no `404`.
2. El endpoint no expone `rawJson` filtrado por rol — devuelve el campo completo tal como está persistido. La UI es responsable de mostrar u ocultar el detalle según el rol del usuario autenticado. Ver reglas de visibilidad en `docs/domain/order-lifecycle.md §Etiquetas de timeline en orders`.
3. Este endpoint no reemplaza ni duplica `GET /order-sessions/{orderSessionId}`. La `OrderSession` completa se consulta por separado; este endpoint solo devuelve el log de eventos.

---

### Respuesta de `GET /tables/resolve/{qrToken}`

```ts
interface TableResolveResponse {
  organizationId: string;   // campo canónico — `restaurantId` descartado como alias
  locationId: string;
  brandId: string;
  catalogId: string;
  tableId: string;        // ID interno del mapping QR
  lastTableId: string;    // ID real en Last
  tableName: string;      // Nombre de mesa desde Last o snapshot cacheado de fallback
  locationName: string;
  restaurantName: string;
}

`TableMapping` / `TableQrMapping` no representa una mesa real propia. Representa únicamente el vínculo `qrToken -> lastTableId`. Last.app sigue siendo la fuente de verdad de las mesas. Si el backend guarda `tableNameSnapshot`, ese valor es solo fallback/cache visual y no cambia el ownership.
```

### Respuesta de `GET /catalog/{catalogId}`

El backend normaliza la respuesta de Last y aplica promociones activas antes de devolver el catálogo. Los productos con `available: false` son filtrados: no llegan al cliente.

```ts
type CatalogModifierSelectionMode =
  | 'single'      // exactamente una opción (radio)
  | 'multiple';   // una o más opciones (checkbox)

interface CatalogModifierOption {
  id: string;
  name: string;
  priceExtra: number;    // precio adicional en unidad monetaria; 0 si no añade coste
  available: boolean;
}

interface CatalogModifierGroup {
  id: string;
  name: string;
  required: boolean;               // si true, el cliente debe seleccionar al menos una opción
  selectionMode: CatalogModifierSelectionMode;
  options: CatalogModifierOption[];
}

interface CatalogProductPromotion {
  promotionId: string;
  promotionName: string;
  discountAmount: number;
  displayLabel: string;    // ej: '-20%', '2x1', '-2€'
  displayPrice: number;    // precio con descuento ya aplicado
}

interface CatalogProduct {
  id: string;
  name: string;
  unitPrice: number;
  available: boolean;
  imageUrl?: string | null;
  allergens?: string[];              // solo si Last lo devuelve
  modifierGroups: CatalogModifierGroup[];
  promotion?: CatalogProductPromotion | null;
}

interface CatalogCategory {
  id: string;
  name: string;
  products: CatalogProduct[];      // solo productos con available: true
}

interface CatalogResponse {
  catalogId: string;
  fromCache: boolean;
  categories: CatalogCategory[];   // solo categorías con al menos un producto disponible
}
```

**Reglas del endpoint:**

- El backend no expone las credenciales de Last al frontend.
- El backend puede cachear la respuesta de Last con TTL de 5 minutos.
- Productos con `available: false` en Last se filtran antes de devolver la respuesta.
- Categorías que quedan vacías tras filtrar productos también se filtran.
- Las promociones activas se resuelven y se enriquecen en el objeto `promotion` del producto.
- `imageUrl` se normaliza desde los posibles campos de imagen de Last (`imageUrl`, `image.url`, `images[].url`, `photoUrl`).
- `allergens` se incluye solo si Last lo devuelve en el producto. Si Last no lo trae o no se puede mapear de forma fiable, el backend devuelve `[]` u omite el campo. El frontend no debe fallar si el campo está ausente.
- `CatalogModifierGroup.required`: si Last no proporciona este campo, el backend normaliza con `false` (modificador opcional).
- `CatalogModifierGroup.selectionMode`: si Last no proporciona regla de selección, el backend normaliza con `'multiple'`.
- `CatalogModifierGroup.options`: si Last no devuelve opciones para el grupo, el backend devuelve `[]`.
- Todos los campos de precio (`unitPrice`, `priceExtra`, `discountAmount`, `displayPrice`) están en minor units de `currency`. Ver §Unidad monetaria.

**Mapper catálogo → `OrderSessionItem`:**

El frontend construye `OrderSessionItem` a partir de `CatalogProduct` al añadir al carrito. Conversiones canónicas:

| Campo origen (`CatalogProduct`) | Campo destino (`OrderSessionItem`) | Notas |
|---|---|---|
| `CatalogProduct.id` | `OrderSessionItem.productId` | Referencia al producto del catálogo |
| — | `OrderSessionItem.id` | ID local único de línea — generado por el frontend (p.ej. `crypto.randomUUID()`) |
| `CatalogProduct.name` | `OrderSessionItem.productName` | Snapshot del nombre en el momento de añadir al carrito |
| `'PRODUCT'` (fijo) | `OrderSessionItem.type` | `'COMBO'` solo si el producto es un combo explícito |
| `CatalogProduct.unitPrice` | `OrderSessionItem.unitPrice` | En minor units — valor directo sin conversión |
| `CatalogModifierOption.id` | `OrderSessionItemModifier.modifierId` | |
| `CatalogModifierOption.name` | `OrderSessionItemModifier.modifierName` | Snapshot del nombre |
| `CatalogModifierOption.priceExtra` | `OrderSessionItemModifier.unitPrice` | En minor units |
| `CatalogModifierOption.priceExtra × quantity` | `OrderSessionItemModifier.totalPrice` | En minor units |

**Cálculo de `OrderSessionItem.totalPrice`:**

```
totalPrice = (unitPrice + Σ selectedModifier.unitPrice) × quantity
```

- El precio de cada modificador seleccionado (`CatalogModifierOption.priceExtra`) se suma al `unitPrice` del producto antes de multiplicar por `quantity`.
- Si existe `promotion.displayPrice`, el frontend puede usarlo como precio visual; el backend recalcula y valida todos los totales al crear `OrderSession`. El frontend es orientativo, el backend es la fuente final.

---

### Especificación de `POST /order-sessions/{orderSessionId}/confirm-payment`

Confirma el cobro físico o en caja de una `OrderSession` con `paymentMode: 'cashier'`. Tras confirmar el pago, el backend intenta enviar el pedido a Last automáticamente.

**Consumidores:** `orders` (staff de caja, rol mínimo `staff`) y `kiosk-web` a través de `local-server` como broker (actorType `system`, credencial de servicio `PUBLIC_API_SERVICE_TOKEN`). Ver `docs/auth/auth-model.md` §4 y `docs/qr-order-orders-architecture.md` §Flujo de rescate QR desde kiosk-web.

**Autenticación requerida:**

| Consumidor | Mecanismo | `actorType` | `actorId` |
|---|---|---|---|
| `orders` | JWT de Supabase — rol mínimo `staff` | `'staff'` | `userId` extraído del JWT por el backend |
| `local-server` (kiosk-web) | `PUBLIC_API_SERVICE_TOKEN` — token de servicio estático | `'system'` | `null` |

El backend extrae `actorId` del JWT si está presente. El campo `actorId` en el body del request se ignora cuando hay JWT válido.

**Request body:**

```ts
interface ConfirmPaymentRequest {
  paymentMode: 'cashier';                              // Siempre 'cashier' — el backend rechaza otros valores
  paymentProvider?: 'cash' | 'cashdro' | 'stripe_terminal' | 'tap_to_pay' | 'other' | null;
  amountReceived?: number | null;                      // Minor units — importe físico recibido (para calcular cambio si aplica)
  actorType: 'staff' | 'system';                       // 'staff' cuando hay operario identificado; 'system' desde kiosco sin sesión de usuario
  actorId?: string | null;                             // userId del JWT — el backend lo ignora si hay JWT; null cuando actorType es 'system'
  idempotencyKey: string;                              // UUID generado por el cliente — obligatorio; ausente → 400 idempotency_key_required
}
```

**Reglas de validación:**

- `idempotencyKey` es obligatorio. Si está ausente el backend devuelve `400 idempotency_key_required`.
- `paymentMode` debe ser `'cashier'`. Si es otro valor el backend devuelve `400 payment_mode_invalid`.
- `OrderSession.paymentMode` debe ser `'cashier'`. Si la sesión tiene otro `paymentMode` el backend devuelve `400 cashier_payment_not_allowed`.
- `paymentStatus` de la sesión debe ser `'unpaid'`. Si ya es `'paid'`, el comportamiento es idempotente: si el `idempotencyKey` coincide con el de la llamada original, el backend devuelve `200` con la `OrderSession` actual. Si el `idempotencyKey` no coincide, el backend devuelve `409 session_already_paid`.
- `expiresAt` de la sesión no debe haber superado `now`. Si ha expirado el backend devuelve `410 session_expired`. No se puede confirmar cobro sobre una sesión expirada.
- Si `paymentProvider` no es uno de los valores permitidos, el backend devuelve `400 payment_mode_invalid`.
- Si el proveedor de pago devuelve error al procesar el cobro físico (p. ej. Cashdro rechaza), el backend devuelve `402 payment_provider_failed` sin cambiar `paymentStatus`.
- El backend es autoritativo — nunca confía en `actorId` enviado por el cliente si hay JWT; lo extrae del token.

**Respuesta exitosa (`200`):**

```ts
interface ConfirmPaymentResponse {
  orderSession: OrderSession;          // Estado actualizado: paymentStatus: 'paid'
  lastSyncStatus: LastSyncStatus;      // 'sent' si Last aceptó, 'sync_failed' si falló
  lastSyncError?: string | null;       // Descripción del error de Last — solo visible para apps internas (orders, local-server); nunca al cliente final
}
```

**Flujo interno tras confirmar pago:**

1. Validaciones de `idempotencyKey`, `paymentMode`, `paymentStatus` y `expiresAt`.
2. Si `paymentProvider` implica procesamiento físico (Cashdro, etc.) y falla: devolver `402 payment_provider_failed`. `paymentStatus` no cambia.
3. `paymentStatus → 'paid'`.
4. Evento `payment_succeeded` emitido con `actorType` y `actorId` resueltos.
5. Evento `last_sync_started` emitido.
6. Backend intenta `POST /tabs` en Last.
7. Si Last acepta: `lastSyncStatus → 'sent'` · evento `last_sync_succeeded`.
8. Si Last falla: `lastSyncStatus → 'sync_failed'` · evento `last_sync_failed` · la respuesta sigue siendo `200` — el pago está confirmado. La incidencia aparece en `orders`.

**Invariante crítica:** si el pago se confirma en el paso 3, `paymentStatus` **no se revierte** aunque Last falle en el paso 6. El cobro es firme. `orders` gestiona la incidencia operativa.

> `kiosk-web` y el cliente de `qr-order` muestran pantalla de confirmación en ambos casos (Last OK o sync_failed). El error técnico de Last no se expone al cliente final. Ver `docs/domain/order-lifecycle.md` §Reglas de UI, regla 5.

---

### Especificación de `GET /order-sessions/recovery/{tokenOrCode}`

Recupera una `OrderSession` cashier pendiente de cobro por `pin4` o código de rescate secundario.

**Métodos de búsqueda (por prioridad):**

| Prioridad | Tipo | Descripción |
|---:|---|---|
| 1 | `pin4` | 4 dígitos numéricos — método principal; el cliente lo ve en `qr-order` tras crear el pedido cashier |
| 2 | Código de rescate | Código alfanumérico secundario — alternativa si el cliente tiene el QR/código impreso o en pantalla |

El nombre del cliente no es un método de búsqueda — no es único. Puede usarse como verificación adicional tras localizar la sesión, pero nunca como clave principal.

**Condiciones para devolver la sesión:**
- La `OrderSession` existe.
- `paymentMode` es `'cashier'`.
- `paymentStatus` es `'unpaid'`.
- `expiresAt` no ha sido superado (o es `null`).

**Condiciones de rechazo:**

| Condición | Código de error | HTTP |
|---|---|---|
| No encontrada | `session_not_found` | 404 |
| Expirada | `session_expired` | 410 |
| Ya cobrada | `session_already_paid` | 409 |
| Cancelada | `session_not_found` | 404 |

**Respuesta exitosa (`200`):**

```ts
interface RecoveryResponse {
  orderSession: OrderSession;   // Estado actual — paymentStatus: 'unpaid'
  tableName?: string | null;    // Nombre de mesa del local si está disponible
}
```

**Eventos emitidos:**
- `recovery_started` — al recibir el request, antes de buscar.
- `recovery_order_found` — si la sesión se localiza correctamente.
- `recovery_failed` — si no se encuentra, expiró, ya está pagada o cancelada.

**Quién puede llamar a este endpoint:**

| Consumidor | Mecanismo de auth |
|---|---|
| `orders` (staff) | JWT de Supabase — rol mínimo `staff` |
| `local-server` (kiosk-web) | `PUBLIC_API_SERVICE_TOKEN` |

---

### Especificación de `PATCH /order-sessions/{orderSessionId}/status`

Cambia el `operationalStatus` de una `OrderSession` activa. Solo válido cuando el pedido está en el flujo operativo post-sincronización.

**Autenticación requerida:** JWT de Supabase. Rol mínimo según la transición solicitada — ver `docs/auth/auth-model.md` §4.

**Request body:**

```ts
interface PatchStatusRequest {
  status: OperationalStatus;   // Nuevo estado deseado
  reason?: string | null;      // Motivo — recomendado para cancelaciones; opcional para el resto
}
```

**Precondiciones — el backend rechaza si no se cumplen:**

| Precondición | Código de error |
|---|---|
| `paymentStatus: 'paid'` | `400 payment_required` |
| `lastSyncStatus: 'sent'` | `400 sync_required` |
| La transición es válida según tabla de transiciones de `docs/domain/order-lifecycle.md` | `400 invalid_status_transition` |
| El rol del JWT tiene permiso para esta transición | `403 forbidden` |

**Transiciones y rol mínimo:**

| Desde | Hacia | Rol mínimo |
|---|---|---|
| `pending` | `accepted` | `staff` |
| `accepted` | `preparing` | `kitchen` |
| `accepted` | `ready` | `kitchen` |
| `preparing` | `ready` | `kitchen` |
| `ready` | `delivered` | `manager` |
| cualquier no-final | `cancelled` | `manager` |

**Respuesta exitosa (`200`):**

```ts
interface PatchStatusResponse {
  orderSession: OrderSession;   // Estado actualizado
}
```

**Evento emitido:** `operational_status_changed` con `actorType: 'staff'`, `actorId` del JWT, y `rawJson: { from, to }`.

**Nota sobre cancelación:** `PATCH /status` con `{ status: 'cancelled' }` es la forma canónica de cancelar un pedido desde `orders`. Ver reglas completas en `docs/domain/order-lifecycle.md` §Cancelaciones.

---

### Respuesta de error canónica

Todos los endpoints devuelven errores con esta forma:

```ts
interface ApiError {
  code: string;           // Código de error interno, ej: "session_expired", "qr_invalid"
  message: string;        // Descripción legible
  details?: unknown;      // Información adicional de depuración (solo en dev)
}
```

Códigos de error definidos:

| `code` | HTTP | Significado |
|---|---|---|
| `qr_invalid` | 404 | El token QR no existe o está revocado |
| `qr_expired` | 410 | El token QR expiró (mesa desactivada) |
| `session_not_found` | 404 | `orderSessionId` no existe |
| `session_expired` | 410 | La sesión superó `expiresAt` |
| `session_already_paid` | 409 | Intento de pago sobre sesión ya cobrada |
| `payment_mode_invalid` | 400 | El `paymentMode` del request no corresponde al modo de la sesión o no está permitido en este endpoint |
| `last_sync_failed` | 502 | Fallo al crear tab en Last (pedido guardado internamente) |
| `payment_failed` | 402 | Stripe rechazó el cobro |
| `unauthorized` | 401 | Token de autenticación ausente o inválido |
| `forbidden` | 403 | El usuario autenticado no tiene permiso para esta acción |
| `stripe_checkout_failed` | 502 | El backend no pudo crear la Checkout Session en Stripe |
| `stripe_webhook_invalid` | 400 | Firma del webhook inválida o timestamp fuera de tolerancia |
| `stripe_payment_failed` | 402 | Stripe rechazó el cobro — recibido vía webhook |
| `stripe_session_not_found` | 400 | `metadata.orderSessionId` del evento Stripe no corresponde a ninguna `OrderSession` |
| `stripe_amount_mismatch` | 400 | `amount_total` del evento Stripe no coincide con `OrderSession.total` |
| `stripe_event_duplicate` | — | Evento ya procesado — respuesta idempotente `200`, sin reprocessing (log interno, no se devuelve en body) |
| `payment_provider_failed` | 402 | El proveedor de pago físico (Cashdro, terminal) rechazó o falló el cobro — `paymentStatus` no cambia |
| `cashier_payment_not_allowed` | 400 | La `OrderSession` no tiene `paymentMode: 'cashier'` — este endpoint no aplica |
| `idempotency_key_required` | 400 | El campo `idempotencyKey` es obligatorio y está ausente |
| `payment_required` | 400 | El pedido no está cobrado (`paymentStatus != 'paid'`) — no puede avanzar operativamente |
| `sync_required` | 400 | El pedido no está en Last (`lastSyncStatus != 'sent'`) — no puede avanzar operativamente |
| `invalid_status_transition` | 400 | La transición de `operationalStatus` solicitada no está permitida desde el estado actual |

> Códigos `stripe_*` definidos y documentados en `docs/contracts/stripe-webhook.md` §11.

---

## Reglas de idempotencia

| Caso | Clave idempotente recomendada |
|---|---|
| Crear `OrderSession` | `externalId` |
| Crear PaymentIntent en Stripe | `orderSessionId` |
| Procesar webhook de Stripe | `stripePaymentIntentId` + event id |
| Crear tab en Last | `externalId` / `orderSessionId` |
| Registrar pago en Last | `orderSessionId` + `stripePaymentIntentId` |
| Confirmar cobro cashier (`confirm-payment`) | `idempotencyKey` enviado en el request — segunda llamada con el mismo key y sesión ya `'paid'` devuelve `200` con `OrderSession` actual |

---

## Campos pendientes de decisión

Los siguientes campos aparecen en la documentación de arquitectura pero no están aún en el contrato canónico. Deben resolverse antes de implementar.

| Campo | Contexto | Decisión pendiente |
|---|---|---|
| `restaurantSlug` | URL pública `order.peaksmash.com/r/{slug}` | No operativo en fase 1. El identificador operativo de entrada en `qr-order` es `qrToken`. Reservado para routing futuro. |
| `source` | Mencionado como campo de multi-local | ¿Distinto de `channel`? ¿Se elimina? |
| `currency` | Presente en `OrderSession` | Código ISO 4217 (`EUR`, `USD`). Queda como `string` temporal hasta definir `CurrencyCode` como tipo canónico. Ver §Unidad monetaria. |
| ~~`lastBillId` / `lastPaymentId`~~ | ~~En tabla de IDs pero no en `OrderSession`~~ | **DECIDIDO 2026-05-15:** viven únicamente en `LastOrderLink`. Eliminados de `Identificadores canónicos`. |

---

## Reglas de implementación

1. Ningún pedido público debe crear `lastTabId` antes de estar cobrado.
2. Todo pedido debe tener `orderSessionId` y `externalId`.
3. Todo estado mostrado en UI debe salir de los enums canónicos.
4. Todo canal debe salir del enum `Channel`.
5. La sincronización con Last debe ser reintentable.
6. Los errores de Last no deben perder el pedido ni el cobro.
7. `pin4` nunca debe ser la clave real de seguridad; solo ayuda visual.
8. `qrToken` debe ser largo, no predecible y revocable.
9. `pin4` debe ser único por `locationId` dentro de una ventana de tiempo activa (mínimo 2h). La estrategia de generación debe detectar colisiones y regenerar, nunca persistir un pin4 duplicado activo.
10. Todo error de API debe devolver el formato `ApiError` canónico definido en este documento.
11. El webhook de Stripe debe verificar la firma (`Stripe-Signature` header) antes de procesar cualquier evento.
12. `lastTabId`, `lastBillId`, `lastPaymentId` y `lastCode` solo deben persistirse en `LastOrderLink`. `OrderSession` no los contiene.
13. `channel` es inmutable tras la creación de `OrderSession`. El punto de cobro no modifica `channel`. Ver `docs/domain/order-lifecycle.md` §Regla de canal.
14. Un pedido `cashier` con `paymentStatus: 'unpaid'` no debe enviarse a Last, cocina ni aparecer como pedido operativo en `orders`. Solo es una sesión pendiente de cobro.
15. El backend solo crea el tab en Last tras recibir `confirm-payment` exitoso (cashier) o `checkout.session.completed` de Stripe (online). Nunca antes.
16. El rescate cashier usa `pin4` como método principal. El nombre del cliente no es método de búsqueda principal.
17. `orders` no debe mostrar pedidos `cashier unpaid` en la lista principal de pedidos activos — deben aparecer en una bandeja separada de cobros pendientes.
