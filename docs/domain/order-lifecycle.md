# Order Lifecycle Domain

## Objetivo

Definir el ciclo de vida canónico de un pedido para `qr-order`, `orders`, backend propio, Stripe y Last.app.

Este documento es normativo. Ningún flujo debe introducir estados nuevos sin actualizar esta especificación.

---

## Principios

1. El cliente público no crea pedidos impagados en Last.
2. El pedido interno puede existir antes que el pedido en Last.
3. El cobro y la operación son dominios separados.
4. Last es la verdad final del pedido operativo una vez sincronizado.
5. El backend propio conserva trazabilidad y estados de sincronización.
6. Un pedido `cashier` con `paymentStatus: 'unpaid'` no existe como entidad operativa en Last, cocina, ni TPV — solo existe como sesión pendiente de cobro en el backend propio.

---

## Estados

> Enums canónicos (`operationalStatus`, `paymentStatus`, `lastSyncStatus`) definidos en `contracts/order-api.md` §Estados canónicos.

### Visibilidad de `operationalStatus` por app

| Estado | Visible en `qr-order` | Visible en `orders` |
|---|---:|---:|
| `pending` | Sí, si aplica | Sí |
| `accepted` | Sí | Sí |
| `preparing` | Sí | Sí |
| `ready` | Sí | Sí |
| `delivered` | No necesariamente | Sí |
| `cancelled` | Sí | Sí |

---

## Transiciones operativas válidas

| Desde | Hacia permitido | Motivo |
|---|---|---|
| `pending` | `accepted`, `cancelled` | Aceptación o cancelación inicial |
| `accepted` | `preparing`, `ready`, `cancelled` | Inicio de preparación, pedido rápido o cancelación |
| `preparing` | `ready`, `cancelled` | Preparación completada o cancelación |
| `ready` | `delivered`, `cancelled` | Entrega o anulación excepcional |
| `delivered` | — | Estado final |
| `cancelled` | — | Estado final |

No se permite volver de `delivered` a estados anteriores salvo operación administrativa explícita, que deberá registrarse como evento de auditoría.

### Precondiciones globales de transición operativa

Para que **cualquier** transición de `operationalStatus` sea válida, el backend exige AMBAS condiciones:

1. `paymentStatus: 'paid'` — el pedido está cobrado.
2. `lastSyncStatus: 'sent'` — el tab existe en Last.

Si alguna no se cumple, el backend rechaza la transición. Ver códigos de error en `docs/contracts/order-api.md` §Respuesta de error canónica.

**Ejecutores por transición:**

| Transición | Precondición adicional | Rol mínimo | App |
|---|---|---|---|
| `pending → accepted` | — | `staff` | `orders` |
| `accepted → preparing` | — | `kitchen` | `orders` |
| `accepted → ready` | Pedido rápido — sin etapa de preparación | `kitchen` | `orders` |
| `preparing → ready` | — | `kitchen` | `orders` |
| `ready → delivered` | — | `manager` | `orders` |
| cualquier no-final → `cancelled` | Ver §Cancelaciones | `manager` | `orders` |

> Rol mínimo según `docs/auth/auth-model.md` §4. La UI oculta botones por UX; el backend valida el rol del JWT en cada request.

---

## Flujo A: QR con pago online

| Paso | Acción | `paymentStatus` | `lastSyncStatus` | `operationalStatus` |
|---:|---|---|---|---|
| 1 | Cliente crea carrito | `unpaid` | `not_sent` | `pending` |
| 2 | Backend crea `OrderSession` | `unpaid` | `not_sent` | `pending` |
| 3 | Cliente inicia Stripe | `payment_pending` | `not_sent` | `pending` |
| 4 | Stripe confirma pago | `paid` | `not_sent` | `pending` |
| 5 | Backend crea tab en Last | `paid` | `sent` | `pending` |
| 6 | Operación acepta pedido | `paid` | `sent` | `accepted` |
| 7 | Cocina prepara | `paid` | `sent` | `preparing` |
| 8 | Pedido listo | `paid` | `sent` | `ready` |
| 9 | Pedido entregado | `paid` | `sent` | `delivered` |

### Regla crítica

Si Stripe confirma el cobro pero Last falla, el pedido debe quedar así:

| Campo | Valor |
|---|---|
| `paymentStatus` | `paid` |
| `lastSyncStatus` | `sync_failed` |
| `operationalStatus` | `pending` |

Este caso debe aparecer en `orders` como incidencia operativa.

---

## Flujo B: QR con pago diferido

| Paso | Acción | `paymentStatus` | `lastSyncStatus` | `operationalStatus` |
|---:|---|---|---|---|
| 1 | Cliente crea pedido | `unpaid` | `not_sent` | `pending` |
| 2 | Backend genera `pin4` y `qrToken` | `payment_pending` | `not_sent` | `pending` |
| 3 | Cliente paga en kiosko/caja | `paid` | `not_sent` | `pending` |
| 4 | Backend crea tab en Last | `paid` | `sent` | `pending` |
| 5 | Operación acepta pedido | `paid` | `sent` | `accepted` |

**Aclaración de canal:** En Flujo B el `channel` sigue siendo `qr_order` — el cliente inició el pedido desde un QR público. El campo `paymentMode` puede ser `kiosk` o `cashier` según dónde se efectúe el cobro. Cobrar en un kiosko o en caja no convierte el canal en `kiosk`.

### Regla crítica

El pedido no debe aparecer como pedido operativo de cocina hasta que esté cobrado y enviado a Last, salvo decisión explícita de operación interna.

### Estado pre-pago — visibilidad y restricciones

Mientras `paymentStatus` sea `'unpaid'` (antes de `confirm-payment`), la `OrderSession` cashier:

| Sistema | Visibilidad | Motivo |
|---|---|---|
| Last.app | ❌ No existe | No se ha creado el tab |
| Cocina / KDS | ❌ No visible | No hay tab en Last |
| TPV de Last | ❌ No puede rescatarlo | El pedido solo existe en el backend propio |
| `orders` app | ⚠️ Solo como cobro pendiente | No como pedido operativo aceptado |
| `kiosk-web` (rescue) | ✅ Visible para cobrar | Accede al backend propio por `pin4` o código |

**El TPV de Last no puede ver ni rescatar un pedido `cashier unpaid`.** El rescate existe únicamente en `kiosk-web` y `orders`. Esta es una consecuencia directa del principio 6: el pedido no ha sido enviado a Last todavía.

### Rescue — método de identificación

| Prioridad | Método | Descripción |
|---:|---|---|
| 1 | `pin4` | Código numérico de 4 dígitos generado al crear la `OrderSession`. Método principal — el cliente lo ve en `qr-order` y lo introduce en el kiosko. |
| 2 | QR / código de rescate | QR o código alfanumérico secundario. Útil si el cliente tiene el QR en pantalla. |
| — | Nombre del cliente | **No** usar como método principal de búsqueda — no es único. Solo puede usarse como filtro de verificación tras localizar la sesión por `pin4` o código. |
| — | `orderSessionId` | **No** exponer como UX principal — UUID demasiado largo. Solo para uso interno/técnico. |

El endpoint canónico de rescate es `GET /order-sessions/recovery/{tokenOrCode}`. Ver `docs/contracts/order-api.md` §Endpoints internos recomendados.

### Reglas de `confirm-payment` para flujo cashier

El paso 3 ("cliente paga en kiosko/caja") se ejecuta mediante `POST /order-sessions/{id}/confirm-payment`. Las siguientes reglas son invariantes:

1. **`paymentStatus: 'unpaid' → 'paid'`** — única transición permitida por este endpoint. El backend rechaza si `paymentStatus` no es `'unpaid'` (salvo idempotencia por `idempotencyKey` — ver regla 5).
2. **`lastSyncStatus: 'not_sent' → 'sent'` o `'sync_failed'`** — el backend intenta crear el tab en Last inmediatamente después de confirmar el pago. El resultado determina `lastSyncStatus`.
3. **Si Last falla, `paymentStatus` no se revierte.** El cobro es firme. `lastSyncStatus → 'sync_failed'`. La incidencia operativa aparece en `orders`. El tab se puede reenviar desde `orders` con `POST /order-sessions/{id}/send-to-last`.
4. **Si `expiresAt` ha superado `now`, `confirm-payment` devuelve `410 session_expired`.** No se puede confirmar cobro sobre una sesión expirada. El cliente debe crear un nuevo pedido.
5. **Idempotencia por `idempotencyKey`:** si el mismo `idempotencyKey` llega dos veces y la sesión ya está `'paid'`, el backend devuelve `200` con la `OrderSession` actual sin re-procesar. Si el `idempotencyKey` es distinto y la sesión ya está `'paid'`, devuelve `409 session_already_paid`.
6. **Secuencia de eventos:** `payment_succeeded` → `last_sync_started` → `last_sync_succeeded` o `last_sync_failed`. Ver §Eventos de auditoría recomendados.

---

## Flujo C: Mini Comandero cobrar primero

| Paso | Acción | `paymentStatus` | `lastSyncStatus` | `operationalStatus` |
|---:|---|---|---|---|
| 1 | Staff crea pedido | `unpaid` | `not_sent` | `pending` |
| 2 | Staff cobra | `paid` | `not_sent` | `pending` |
| 3 | Backend crea tab en Last | `paid` | `sent` | `accepted` |
| 4 | Cocina prepara | `paid` | `sent` | `preparing` |

Este es el modo interno recomendado por defecto.

---

## Flujo D: Mini Comandero enviar primero y cobrar después

| Paso | Acción | `paymentStatus` | `lastSyncStatus` | `operationalStatus` |
|---:|---|---|---|---|
| 1 | Staff crea pedido | `unpaid` | `not_sent` | `pending` |
| 2 | Backend crea tab en Last | `unpaid` | `sent` | `accepted` |
| 3 | Pedido queda pendiente de cobro | `payment_pending` | `sent` | `accepted` |
| 4 | Staff rescata y cobra | `paid` | `sent` | `accepted` |

### Restricción

Este flujo solo puede estar disponible para personal autorizado.

---

## Flujo operativo post-sincronización (`paid + sent`)

Cuando un pedido alcanza `paymentStatus: 'paid'` + `lastSyncStatus: 'sent'`, entra en el flujo operativo normal. En este punto el tab existe en Last, el pedido aparece en la bandeja de Pedidos activos de `orders`, y `operationalStatus` avanza según las acciones del equipo.

### Flujo estándar

| Paso | Acción | `operationalStatus` | Ejecutor | Desde |
|---:|---|---|---|---|
| 1 | Pedido llega a `orders` tras sync | `pending` | Sistema | Automático tras `confirm-payment` o webhook Stripe |
| 2 | Staff acepta el pedido | `accepted` | `staff`+ | `orders` |
| 3 | Cocina inicia preparación | `preparing` | `kitchen`+ | `orders` |
| 4 | Pedido listo para entrega o recogida | `ready` | `kitchen`+ | `orders` |
| 5 | Pedido entregado al cliente | `delivered` | `manager`+ | `orders` |

### Variante: pedido rápido

Cuando no hay etapa de preparación (ej. bebida en mostrador):

| Paso | `operationalStatus` |
|---:|---|
| 1 | `pending` |
| 2 | `accepted` |
| 3 | `ready` (directo — sin `preparing`) |
| 4 | `delivered` |

La transición `accepted → ready` está permitida en la tabla de transiciones operativas para cubrir este caso.

---

## Estados operativos bloqueados

Dos combinaciones de `(paymentStatus, lastSyncStatus)` bloquean el avance operativo. Ninguna transición de `operationalStatus` distinta de `→ cancelled` es válida mientras persistan.

### `paid + not_sent` — transitorio

| Campo | Valor |
|---|---|
| `paymentStatus` | `paid` |
| `lastSyncStatus` | `not_sent` |
| `operationalStatus` | `pending` (bloqueado) |

**Qué significa:** el cobro está confirmado, pero el backend aún no ha intentado crear el tab en Last. Es un estado transitorio que solo debe existir durante la transacción de `confirm-payment` o del webhook Stripe.

**Regla:** este estado no debe persistir. El backend debe intentar `POST /tabs` en Last inmediatamente después de confirmar el pago. Si el intento falla, el estado pasa a `sync_failed`.

**Visibilidad:** no debe aparecer en la bandeja de Pedidos activos de `orders` mientras no tenga `lastSyncStatus: 'sent'`. Si persiste más de lo esperado (bug de backend), el sistema de monitorización debe detectarlo.

### `paid + sync_failed` — incidencia operativa

| Campo | Valor |
|---|---|
| `paymentStatus` | `paid` |
| `lastSyncStatus` | `sync_failed` |
| `operationalStatus` | `pending` (bloqueado) |

**Qué significa:** el cobro está confirmado, pero Last rechazó o no respondió al crear el tab. El pedido no existe en Last ni en cocina.

**Regla:** `operationalStatus` permanece en `pending` y NO puede avanzar a `accepted`, `preparing`, `ready` ni `delivered` hasta que `lastSyncStatus → 'sent'`. La única transición de `operationalStatus` permitida es `→ cancelled` (`manager`+).

**Visibilidad:** aparece en la bandeja de Incidencias de `orders`. Requiere intervención de `manager`+ vía `POST /order-sessions/{id}/send-to-last`. El sistema no reintenta automáticamente en fase 1.

---

## Cancelaciones

### Cuándo se puede cancelar

| Estado del pedido | Cancelable | Quién | Efecto adicional |
|---|---|---|---|
| `unpaid + not_sent` | ✅ | Sistema (expiración) o `manager` | Sin efectos en Last ni Stripe |
| `payment_pending + not_sent` | ✅ | Sistema (expiración) o `manager` | Backend cancela PaymentIntent de Stripe si existe |
| `paid + not_sent` | ✅ `manager`+ | `manager` | Cobro firme — requiere reembolso separado (no automático) |
| `paid + sync_failed` | ✅ `manager`+ | `manager` | Tab no existe en Last — sin notificación necesaria a Last |
| `paid + sent + pending` | ✅ `manager`+ | `manager` | Backend notifica cancelación a Last |
| `paid + sent + accepted` | ✅ `manager`+ con confirmación explícita | `manager` | Backend notifica cancelación a Last — pedido ya aceptado |
| `paid + sent + preparing` | ✅ `manager`+ con confirmación explícita | `manager` | Pedido en cocina — impacto operativo alto |
| `paid + sent + ready` | ✅ `manager`+ con confirmación explícita | `manager` | Pedido listo — cancelación excepcional |
| `delivered` | ❌ Estado final | — | Solo vía operación administrativa con auditoría |
| `cancelled` | ❌ Estado final | — | — |

### Reglas invariantes de cancelación

1. **Cancelación ≠ reembolso.** Cancelar un pedido con `paymentStatus: 'paid'` no inicia automáticamente el reembolso. Son acciones separadas. El operador debe iniciar el reembolso explícitamente desde `orders` (Flujo E).

2. **Notificación a Last.** Si `lastSyncStatus: 'sent'`, el backend debe intentar notificar la cancelación a Last al ejecutar `POST /order-sessions/{id}/cancel`. Si Last no está disponible en ese momento, el backend registra el evento y lo marca como incidencia pendiente.

3. **Confirmación explícita en UI.** `orders` debe mostrar diálogo de confirmación antes de ejecutar `POST /order-sessions/{id}/cancel`. Especialmente importante cuando `operationalStatus` es `preparing` o `ready`.

4. **Auditoría obligatoria.** Toda cancelación emite evento `order_cancelled` con `actorType`, `actorId` y `reason` (campo opcional recomendado). El backend rechaza la cancelación si no hay usuario autenticado identificable.

5. **`cancelled` es terminal.** Un pedido cancelado no puede volver a un estado activo salvo operación administrativa explícita con evento de auditoría registrado.

---

## Relación con Last — modelo write-only en fase 1

**Decisión:** en fase 1, Last es write-only desde el backend propio. Last no envía cambios de estado al backend.

| Dirección | Fase 1 | Qué se envía |
|---|---|---|
| Backend → Last | ✅ | `POST /tabs` — crea el pedido en Last tras cobro |
| Backend → Last | ✅ | Notificación de cancelación si `lastSyncStatus: 'sent'` |
| Backend → Last | ✅ | Actualización de `pickupTime` si existe `estimatedReadyAt` |
| Last → Backend | ❌ No en fase 1 | Last no envía webhooks de cambio de estado al backend propio |

**Consecuencia práctica:** si el personal opera el pedido directamente desde el TPV de Last (y no desde `orders`), los cambios de `operationalStatus` en Last no se reflejan en el backend propio. El `operationalStatus` en el backend puede quedar desincronizado con la realidad del tab en Last.

**En fase 1, esta divergencia es aceptada como deuda técnica controlada:**
- El cobro es firme y trazado en el backend propio — no hay riesgo de pérdida de cobro.
- La desincronización afecta solo a la vista de estado en `orders`.
- El restaurante puede operar desde el TPV de Last sin depender de `orders` para el flujo de cocina.
- `orders` es la UI de gestión de `operationalStatus` para el backend propio, no un duplicado del TPV.

**Fases futuras (no implementar ahora):**
- Recepción de webhooks de Last con cambios de `operationalStatus`.
- Polling del backend propio a Last para sincronizar estados.

**Regla de diseño:** el backend no debe asumir que Last enviará webhooks. Cualquier lógica que dependa de callbacks de Last debe marcarse como "fase futura".

---

## Modelo de auditoría y eventos de `OrderSession`

Esta sección es la fuente de verdad de todos los eventos del sistema. Ningún evento nuevo debe emitirse sin actualizarla. Los eventos se persisten en `order_session_events`. Ver `OrderSessionEvent` en `docs/contracts/order-api.md`.

### Alineación de nombres con implementación (2026-05-19)

| Nombre anterior en doc | Nombre canónico — implementación actual |
|---|---|
| `operational_status_changed` | `order_status_updated` |
| `recovery_started` | `recovery_created` |
| `order_delivered` | cubierto por `order_status_updated { to: 'delivered' }` — no emitir como evento separado |

El nombre anterior no debe emitirse. Si existe en DB histórico, se trata como alias de lectura únicamente.

---

### Catálogo canónico de eventos

| Evento | Cuándo | `actorType` | Tipo | `rawJson` — campos mínimos |
|---|---|---|---|---|
| `order_session_created` | `POST /order-sessions` crea la sesión | `customer` / `staff` / `system` | **Funcional** | `channel`, `paymentMode`, `total`, `currency`, `itemCount`, `tableId?`, `tableNameSnapshot?` |
| `payment_started` | Stripe Checkout Session creada; o sesión cashier/kiosk generada con `pin4` | `customer` (online) / `system` (cashier/kiosk) | Técnico | `paymentMode`, `stripeCheckoutSessionId?` |
| `payment_succeeded` | `confirm-payment` OK (cashier/kiosk); webhook `checkout.session.completed` (online) | `staff` / `system` / `webhook` | **Funcional** | `paymentMode`, `paymentProvider?`, `amountReceived?`, `actorId?` |
| `payment_failed` | Webhook Stripe rechazado; proveedor físico rechaza | `webhook` / `system` | **Funcional** | `paymentMode`, `errorCode?`, `errorMessage?` |
| `last_sync_started` | Backend intenta `POST /tabs` en Last (primer intento o reintento) | `system` | Técnico | `attempt` (1 = primer intento; 2+ = reintento) |
| `last_sync_succeeded` | Last confirma creación del tab | `system` | **Funcional** | `attempt`, `lastTabId`, `lastCode?` |
| `last_sync_failed` | Last devuelve error o timeout | `system` | **Funcional — incidencia** | `attempt`, `errorCode?`, `errorMessage?`, `lastHttpStatus?` |
| `order_status_updated` | `PATCH /order-sessions/{id}/status` ejecutado | `staff` | **Funcional** | `from`, `to`, `reason?` |
| `recovery_created` | Backend recibe `GET /order-sessions/recovery/{code}` — antes de buscar | `system` | Técnico | `method` (`pin4`/`token`/`code`), `source` (`orders`/`kiosk`) |
| `recovery_order_found` | Backend localiza la sesión correctamente | `system` | Técnico | `method`, `source` |
| `recovery_failed` | Backend no recupera la sesión | `system` | Técnico | `method`, `source`, `reason` (`not_found`/`expired`/`already_paid`/`cancelled`) |
| `order_cancelled` | Cancelación manual (`PATCH /status { cancelled }`) o expiración automática | `staff` / `system` | **Funcional** | `trigger` (`manual`/`expiration`), `operationalStatusBefore`, `reason?` |
| `order_refunded` | Reembolso ejecutado vía Stripe | `staff` | **Funcional** | `refundedAmount`, `currency`, `refundType` (`total`/`partial`), `actorId` |
| `preparation_time_suggested` | Sistema calcula tiempo sugerido | `system` | Técnico | `suggestedMinutes` |
| `preparation_time_confirmed` | Operador confirma tiempo (`PATCH /preparation-time`) | `staff` | **Funcional** | `confirmedMinutes`, `estimatedReadyAt` |
| `estimated_ready_at_calculated` | Backend deriva `estimatedReadyAt` de `confirmedMinutes` | `system` | Técnico | `estimatedReadyAt` |
| `pickup_time_sync_started` | Backend intenta enviar `pickupTime` a Last | `system` | Técnico | `estimatedReadyAt` |
| `pickup_time_sync_succeeded` | Last acepta la hora estimada | `system` | Técnico | `estimatedReadyAt` |
| `pickup_time_sync_failed` | Last rechaza o falla la actualización de `pickupTime` | `system` | **Funcional** | `errorMessage?`, `estimatedReadyAt` |

---

### Clasificación funcional vs técnico

| Tipo | Definición | Ejemplos |
|---|---|---|
| **Funcional** | Hito con significado operativo o comercial — se muestra en el timeline de `orders` | `payment_succeeded`, `last_sync_failed`, `order_status_updated` |
| **Técnico** | Paso interno sin valor directo para el operador — se persiste pero nunca se muestra en UI | `payment_started`, `last_sync_started`, `recovery_created`, `estimated_ready_at_calculated` |

**Regla:** el resultado siempre es funcional; el inicio nunca lo es. `last_sync_started` es técnico; `last_sync_succeeded`/`last_sync_failed` son funcionales.

---

### Etiquetas de timeline en `orders`

El sistema de timeline muestra eventos funcionales con etiquetas legibles. Los técnicos no se muestran ni se agrupan.

| Evento | Etiqueta UI | Detalle adicional |
|---|---|---|
| `order_session_created` | "Pedido creado" | Canal + modo de pago |
| `payment_succeeded` | "Pago confirmado" | Importe + método |
| `payment_failed` | "Pago fallido" | Código de error (solo `manager`+) |
| `last_sync_succeeded` | "Enviado a cocina" | `lastCode` si disponible |
| `last_sync_failed` | "Error al enviar a cocina" | Mensaje de error — solo `manager`+ |
| `order_status_updated { to: 'accepted' }` | "Pedido aceptado" | Por quién (`actorId`) |
| `order_status_updated { to: 'preparing' }` | "En preparación" | — |
| `order_status_updated { to: 'ready' }` | "Listo para entrega" | — |
| `order_status_updated { to: 'delivered' }` | "Pedido entregado" | Por quién |
| `order_status_updated { to: 'cancelled' }` | "Pedido cancelado" | `reason` si existe |
| `preparation_time_confirmed` | "Tiempo estimado: {X} min" | `estimatedReadyAt` como hora concreta |
| `pickup_time_sync_failed` | "Error al enviar hora estimada a Last" | Solo `manager`+ |
| `order_refunded` | "Reembolso: {importe}" | Total/parcial; por quién |
| `order_cancelled { trigger: 'expiration' }` | "Cancelado por expiración" | — |
| `order_cancelled { trigger: 'manual' }` | "Cancelado por staff" | `reason` si existe |

**Visibilidad por rol:**
- `staff`: ve todos los funcionales salvo `last_sync_failed` (mensaje de error detallado) y `order_refunded`.
- `kitchen`: ve únicamente `order_status_updated` con transiciones relevantes para cocina (`accepted`, `preparing`, `ready`).
- `manager`+: ve todos los funcionales con mensajes de error completos.

---

### Diseño de timeline

1. **Orden cronológico ascendente** — el evento más antiguo arriba; el estado actual siempre al final.
2. **Los técnicos no aparecen** — nunca se agrupan ni se muestran como "N eventos internos". Se omiten completamente del timeline.
3. **`last_sync_started` nunca aparece.** Su resultado (`last_sync_succeeded` o `last_sync_failed`) sí.
4. **Múltiples `last_sync_failed` + `last_sync_succeeded` se muestran todos** — el historial de intentos es útil para diagnóstico de `manager`.
5. **`rawJson` accesible en expansión** — no inline. El operador hace clic en el evento para ver el detalle.
6. **Eventos de `actorType: 'staff'`** muestran el `actorId` como "por {nombre o ID}".
7. **`order_session_created` es siempre el primer evento visible.**

---

### Reglas de incidencia visible

Una incidencia activa genera badge en la tarjeta del pedido y lo mueve a la bandeja de Incidencias.

| Condición | Etiqueta incidencia | Acción requerida | Rol |
|---|---|---|---|
| `lastSyncStatus: 'sync_failed'` | "Error al enviar a cocina" | `POST /order-sessions/{id}/send-to-last` | `manager`+ |
| `paymentStatus: 'payment_failed'` | "Pago fallido" | Informativo — el cliente debe reiniciar el pedido | `staff`+ |
| `pickup_time_sync_failed` reciente | "Error al enviar hora estimada" | Informativo — solo en detalle del pedido | `manager`+ |

**Resolución automática de incidencias:**
- `sync_failed` → se resuelve cuando `lastSyncStatus → 'sent'` (evento `last_sync_succeeded`). El badge desaparece en el siguiente polling.
- `payment_failed` → no se resuelve automáticamente. Estado terminal hasta que el cliente crea un nuevo pedido.
- `pickup_time_sync_failed` → no genera badge en la lista — solo aparece en el detalle del pedido para `manager`+.

---

## Ownership de estados

| Campo | Owner principal | Puede modificarlo |
|---|---|---|
| `operationalStatus` | Last / Backend mapped | `orders`, sync Last |
| `paymentStatus` | Backend / Stripe / Last mapped | Webhooks, staff autorizado |
| `lastSyncStatus` | Backend propio | Jobs de sync, backend |
| `pickupTimeSyncStatus` | Backend propio | Jobs de sync, backend |

### Ownership por dominio

| Dominio | Owner | Cuándo tiene autoridad |
|---|---|---|
| Sesiones pendientes de cobro (`cashier unpaid`) | Backend propio | Siempre — Last no sabe de esta sesión |
| Pedido operativo (tab en Last) | Last.app | Solo después de `paymentStatus: 'paid'` + `lastSyncStatus: 'sent'` |
| Confirmación de cobro online | Stripe | Solo el webhook confirma — nunca el frontend |
| Confirmación de cobro físico | Backend propio (via `confirm-payment`) | Con `actorType: 'staff'` o `'system'` auditado |
| Incidencias `sync_failed` | `orders` app | Gestiona reenvío a Last |
| Rescate cashier (UX) | `kiosk-web` + `orders` | Ambos pueden rescatar; `orders` también puede cobrar |

> La máquina de estados completa de `OrderSession` — combinaciones válidas e inválidas de `(paymentStatus, lastSyncStatus, operationalStatus)`, transiciones de `paymentStatus` y `lastSyncStatus`, e invariantes — está en `docs/contracts/order-api.md` §Modelo de estados de `OrderSession`. Este documento define el dominio; el contrato de la entidad vive en el contrato de API.

### Regla de canal

`channel` describe el origen del pedido, no el punto de cobro.

| Caso | `channel` | `paymentMode` |
|---|---|---|
| Cliente pide por QR, paga online | `qr_order` | `online` |
| Cliente pide por QR, paga en kiosko | `qr_order` | `kiosk` |
| Cliente pide por QR, paga en caja | `qr_order` | `cashier` |
| Staff crea pedido interno | `manual` | `staff_internal` |

Cobrar en un kiosco o en barra **nunca convierte `channel` en `kiosk`**. El `channel` lo establece el origen del pedido al crear la `OrderSession` y es inmutable.

---

## Reglas de UI

1. `qr-order` no debe mostrar estados internos de sync salvo error recuperable para el cliente.
2. `orders` sí debe mostrar errores de sync, cobro y Last.
3. Los estados visibles deben derivarse de los campos canónicos.
4. La UI no debe inventar estados agregados sin mapearlos explícitamente.
5. En `qr-order`, si `paymentStatus: 'paid'` y `lastSyncStatus: 'sync_failed'`, mostrar la pantalla de confirmación como exitosa. No exponer el error técnico al cliente. El mensaje debe indicar que el pedido está confirmado y, si hay alguna incidencia, muestre su código al personal. `orders` gestionará la incidencia operativa.
6. En `qr-order`, tras confirmar un pedido `cashier`, mostrar únicamente el `pin4` y/o QR de rescate — no un estado operativo. El pedido no existe en Last todavía: no hay número de pedido de cocina, no hay tiempo estimado. El mensaje debe instruir al cliente a acudir a barra o kiosko para pagar.
7. `orders` no debe mostrar pedidos `cashier unpaid` como pedidos operativos activos. Deben aparecer en una bandeja específica de "cobros pendientes" separada de la lista de pedidos en preparación.
8. El comportamiento funcional completo de `orders` — vistas, filtros, acciones, transición cashier y tabla scaffold→backend — está definido en `docs/qr-order-orders-architecture.md` §orders — Comportamiento funcional real. Este documento solo define las reglas de dominio; la especificación de UX vive en el documento de arquitectura.

---

## Flujo E: Reembolso

Solo disponible para staff autorizado desde `orders`.

| Paso | Acción | `paymentStatus` | `operationalStatus` |
|---:|---|---|---|
| 1 | Staff inicia reembolso desde `orders` | `paid` | cualquier estado no-final |
| 2 | Backend llama a Stripe refund API | `refunded` (parcial o total) | `cancelled` |
| 3 | Backend registra evento en Last si aplica | `refunded` | `cancelled` |

### Reglas de reembolso

- Solo se puede reembolsar un pedido con `paymentStatus: 'paid'`.
- Un reembolso parcial debe documentarse con `refundedAmount` en el evento de auditoría.
- Si el tab ya fue creado en Last, el backend debe notificar a Last antes de marcar `refunded`.
- El reembolso total convierte `operationalStatus` a `cancelled` automáticamente.
- El reembolso parcial no cambia `operationalStatus`; la operación continúa.
- Todo reembolso genera evento `order_refunded` con `actorType: 'staff'` y el `actorId` del operador.

---

## Comportamiento de sesión expirada

Una sesión de pago diferido tiene `expiresAt`. Para `paymentMode: 'cashier'` en fase 1, `expiresAt = createdAt + 30 minutos`. El cliente dispone de 30 minutos para ir a pagar en caja desde que se crea la `OrderSession`. Cuando se supera este campo:

| Estado de la sesión | Comportamiento |
|---|---|
| `paymentStatus: 'unpaid'` + expirada | El backend cancela la sesión automáticamente vía job periódico. `operationalStatus → 'cancelled'`. |
| `paymentStatus: 'payment_pending'` + expirada | El backend cancela la sesión. Si Stripe tiene un PaymentIntent asociado, se cancela también. |
| `paymentStatus: 'paid'` + expirada | La sesión NO se cancela. El pago es firme. La expiración es irrelevante si ya se cobró. |

### Lo que ve el cliente en qr-order

Si el cliente carga la URL con una sesión expirada: se muestra pantalla de error `session_expired` con opción de empezar de nuevo (sin recuperar el carrito anterior).

### Regla de UI

`qr-order` no debe intentar pagar una sesión con `expiresAt` ya superado. Debe consultarlo al backend antes de iniciar Stripe.

---

## Estados finales

| Estado final | Campo | Significado |
|---|---|---|
| `delivered` | `operationalStatus` | Pedido completado operativamente |
| `cancelled` | `operationalStatus` | Pedido cancelado |
| `refunded` | `paymentStatus` | Cobro reembolsado |

Un pedido puede estar `cancelled` y `refunded`, pero son dominios distintos: operación y cobro.
