# Stripe Webhook Contract — qr-order fase 1

## Propósito

Este documento define el contrato de integración con Stripe para `qr-order` fase 1.

**No es documentación pública de Stripe.**
**No duplica el ciclo de vida de `OrderSession`** — ese vive en `docs/domain/order-lifecycle.md`.
**No duplica el contrato de pedidos** — ese vive en `docs/contracts/order-api.md`.

El objetivo es establecer qué hace el backend propio con Stripe: qué eventos espera, cómo los verifica, cómo los procesa con idempotencia y cómo se relaciona con `OrderSession` y con Last.

---

## 1. Propósito

### Qué cubre este documento

- **Stripe Checkout hosted** para `qr-order` con `paymentMode: 'online'`
- **Creación de Checkout Session** desde el backend propio
- **Webhook de confirmación de pago**: recepción, verificación de firma, procesamiento idempotente
- **Relación con `OrderSession`**: cuándo cambia `paymentStatus`, qué se hace con Last
- **Errores y códigos de API**: nuevos códigos específicos de Stripe
- **Idempotencia**: garantías ante eventos duplicados y reintentos de Stripe

### Qué queda fuera de este documento

- **Reembolsos avanzados**: el endpoint `POST /order-sessions/{id}/refund` existe en `order-api.md` pero su implementación queda fuera de fase 1. Ver §12.
- **Stripe Terminal / Tap to Pay**: dispositivos físicos de cobro. Fuera de fase 1.
- **Pagos cashier o kiosk**: flujos con `paymentMode: 'cashier'` o `'kiosk'` — usan `POST /order-sessions/{id}/confirm-payment`, no Stripe Checkout. Ver `docs/contracts/order-api.md` §`confirm-payment`.
- **Facturación avanzada**: emisión de facturas, IVA desglosado, datos fiscales del cliente. Fuera de fase 1.
- **Apple Pay / Google Pay**: Stripe Checkout hosted los gestiona automáticamente sin código adicional. No requieren documentación específica aquí.
- **Conciliación contable**: exportación de cobros a sistemas contables. Fuera de fase 1.

---

## 2. Ownership

| Concepto | Owner |
|---|---|
| `OrderSession` (ciclo de vida, estados, auditoría) | Backend propio — `docs/contracts/order-api.md` |
| `paymentStatus` | Backend propio — escrito únicamente por el backend tras evento de pago confirmado |
| `stripePaymentIntentId` | Stripe — el backend lo recibe y persiste en `OrderSession` para trazabilidad |
| `stripeCheckoutSessionId` | Stripe — el backend lo recibe al crear la Checkout Session y lo persiste en `OrderSession` |
| Verificación de firma de webhook | Backend propio — con `STRIPE_WEBHOOK_SECRET` |
| Procesamiento de eventos Stripe | Backend propio — nunca el frontend |
| Creación de tab en Last | Backend propio — solo después de `paymentStatus: 'paid'` confirmado por webhook |
| Reembolsos | Backend propio (llamada a Stripe API) + Stripe (ejecución) — ver §12 |
| Metadatos de Stripe Checkout Session | Backend propio — define qué incluir en `metadata` |
| `LastOrderLink` | Backend propio — `docs/contracts/order-api.md` |

---

## 3. Flujo online fase 1

El flujo corresponde al **Flujo A** de `docs/domain/order-lifecycle.md`. Se describe aquí únicamente la parte técnica de Stripe.

| Paso | Quién | Acción | Estado resultante |
|---:|---|---|---|
| 1 | `qr-order` | Crea carrito en cliente (localStorage) | — |
| 2 | `qr-order` → Backend | `POST /order-sessions` con `paymentMode: 'online'` → backend crea `OrderSession` | `paymentStatus: 'unpaid'`, `lastSyncStatus: 'not_sent'` |
| 3 | `qr-order` → Backend | `POST /order-sessions/{id}/checkout/stripe` → backend crea Stripe Checkout Session | `paymentStatus: 'payment_pending'`; backend persiste `stripeCheckoutSessionId` en `OrderSession` |
| 4 | `qr-order` | Redirige al cliente a la Stripe Checkout Session URL | Cliente en página de pago de Stripe |
| 5 | Stripe → Cliente | Cliente introduce datos de pago en la página de Stripe | — |
| 6 | Stripe → Cliente | Stripe redirige a `success_url` o `cancel_url` según resultado | — |
| 7 | Stripe → Backend | Stripe envía `checkout.session.completed` al webhook del backend | Backend procesa el evento |
| 8 | Backend | Verifica firma · verifica idempotencia · carga `OrderSession` por `metadata.orderSessionId` | — |
| 9 | Backend | Valida `amount_total` y `currency` contra `OrderSession.total` y `OrderSession.currency` | — |
| 10 | Backend | `paymentStatus → 'paid'` · persiste `stripePaymentIntentId` · emite `payment_succeeded` | `paymentStatus: 'paid'` |
| 11 | Backend | Intenta `POST /tabs` en Last | — |
| 12a | Backend (Last OK) | `lastSyncStatus → 'sent'` · emite `last_sync_succeeded` | `lastSyncStatus: 'sent'` |
| 12b | Backend (Last falla) | `lastSyncStatus → 'sync_failed'` · emite `last_sync_failed` · responde `200` a Stripe | `lastSyncStatus: 'sync_failed'` |
| 13 | `qr-order` | Sondea `GET /order-sessions/{id}` y muestra confirmación cuando `paymentStatus: 'paid'` | Cliente ve confirmación |

### Regla crítica — redirección vs. webhook

La `success_url` no es confirmación de pago. Es solo el resultado de la navegación del usuario tras el flujo de Stripe.

**El pago solo se considera confirmado cuando el backend recibe y procesa `checkout.session.completed` con firma verificada.** El cliente puede llegar a `success_url` antes de que el webhook haya llegado. `qr-order` debe esperar hasta que `GET /order-sessions/{id}` devuelva `paymentStatus: 'paid'`.

---

## 4. Endpoints propios implicados

Los endpoints están definidos canónicamente en `docs/contracts/order-api.md`. Este apartado solo describe su papel en el flujo Stripe.

| Endpoint | Rol en el flujo Stripe |
|---|---|
| `POST /order-sessions` | Crea la `OrderSession` con `paymentMode: 'online'` antes de iniciar Stripe |
| `POST /order-sessions/{id}/checkout/stripe` | Crea la Stripe Checkout Session — ver §5 |
| `POST /stripe/webhook` | Recibe eventos Stripe con firma verificada — ver §6, §7, §8 |
| `GET /order-sessions/{id}` | `qr-order` sondea para saber cuándo `paymentStatus: 'paid'` tras redirección a `success_url` |

No se crean endpoints nuevos para Stripe en fase 1. El flujo completo está cubierto con estos cuatro.

---

## 5. Stripe Checkout Session

El backend crea la Checkout Session en respuesta a `POST /order-sessions/{id}/checkout/stripe`. El frontend nunca llama a Stripe directamente.

### Campos requeridos

| Campo Stripe | Valor | Notas |
|---|---|---|
| `mode` | `'payment'` | No `'subscription'` ni `'setup'` |
| `currency` | `OrderSession.currency` | Código ISO 4217 en minúsculas — Stripe requiere `'eur'`, no `'EUR'` |
| `line_items` | Ver abajo | Construidos desde `OrderSession.items` |
| `success_url` | `${STRIPE_SUCCESS_URL_BASE}?session_id={CHECKOUT_SESSION_ID}` | `{CHECKOUT_SESSION_ID}` es una plantilla de Stripe — se sustituye automáticamente |
| `cancel_url` | `${STRIPE_CANCEL_URL_BASE}?orderSessionId={orderSessionId}` | Permite a `qr-order` recuperar el contexto del pedido cancelado |
| `metadata` | Ver abajo | Campos propios del dominio |
| `client_reference_id` | `orderSession.orderSessionId` | Campo nativo de Stripe para vincular con entidad interna |
| `payment_intent_data.metadata` | Mismos campos que `metadata` | Stripe replica en `PaymentIntent` — útil si llega `payment_intent.succeeded` separado |

### Construcción de `line_items`

```
line_items = OrderSession.items.map(item => ({
  price_data: {
    currency: OrderSession.currency.toLowerCase(),
    unit_amount: item.unitPrice + Σ(item.modifiers[].unitPrice),  // precio unitario completo en minor units
    product_data: {
      name: item.productName,
    },
  },
  quantity: item.quantity,
}))
```

> Los `line_items` de Stripe son solo visualmente informativos en la página de pago. El importe autoritativo es `OrderSession.total`. El backend valida que `amount_total` del evento de Stripe coincide con `OrderSession.total` antes de marcar `paid` — ver §8.

### `metadata` requerido

| Campo | Valor | Motivo |
|---|---|---|
| `orderSessionId` | `OrderSession.orderSessionId` | Vínculo principal entre evento Stripe y pedido interno |
| `externalId` | `OrderSession.externalId` | Referencia idempotente de la sesión |
| `locationId` | `OrderSession.locationId` | Para resolución de contexto en el webhook |
| `channel` | `OrderSession.channel` | Siempre `'qr_order'` en este flujo |

### Idempotency key para crear Checkout Session

El backend debe crear la Checkout Session usando una `Idempotency-Key` en el header de la llamada a Stripe:

```
Idempotency-Key: stripe-checkout-{orderSessionId}
```

Esto garantiza que reintentos del frontend (o del backend) ante fallos transitorios no crean dos Checkout Sessions para la misma `OrderSession`.

### Respuesta de `POST /order-sessions/{id}/checkout/stripe`

```ts
interface StripeCheckoutResponse {
  checkoutUrl: string;          // URL de la Stripe Checkout Session — frontend redirige aquí
  stripeCheckoutSessionId: string;  // Persistido en OrderSession para trazabilidad
  expiresAt: string;            // ISO 8601 — expiración de la Checkout Session (Stripe por defecto: 24h)
}
```

El backend actualiza `OrderSession.paymentStatus → 'payment_pending'` al crear la Checkout Session exitosamente.

---

## 6. Eventos Stripe relevantes en fase 1

| Evento | Cuándo ocurre | Relevancia |
|---|---|---|
| `checkout.session.completed` | El cliente completó el pago en Stripe Checkout | **Evento principal** — ver §7 |
| `payment_intent.succeeded` | El `PaymentIntent` subyacente se confirma | Respaldo — llega independientemente o junto a `checkout.session.completed` |
| `payment_intent.payment_failed` | Stripe no pudo cobrar | Marcar `paymentStatus: 'payment_failed'` y emitir `payment_failed` |
| `checkout.session.expired` | La Checkout Session expiró sin pago | Tratar como cancelación si `paymentStatus` sigue en `'payment_pending'` |

Eventos que **no** se procesan en fase 1 (no suscribirse salvo necesidad explícita):

- `charge.*`: nivel inferior al necesario para Checkout
- `customer.*`: sin modelo de cliente en fase 1
- `invoice.*`, `subscription.*`: no aplica — modo `'payment'`
- `refund.*`: ver §12

---

## 7. Decisión principal — evento de confirmación

**DECIDIDO:** `checkout.session.completed` es el evento principal para confirmar pago online en fase 1.

### Justificación

- En el flujo Stripe Checkout hosted, `checkout.session.completed` se emite exactamente cuando el cliente termina el pago — es el evento semánticamente correcto para este modo.
- `checkout.session.completed` lleva en su payload el `payment_status` de la sesión. El backend verifica que sea `'paid'` antes de procesar (una Checkout Session puede completarse en modo `'setup'` con `payment_status: 'no_payment_required'` — no aplica aquí pero se valida).
- `payment_intent.succeeded` puede llegar antes, después o simultáneamente. En Checkout hosted, Stripe garantiza que `checkout.session.completed` llega si el pago tiene éxito — es el evento suficiente.

### Regla de procesamiento dual

Si el backend recibe `payment_intent.succeeded` para un `PaymentIntent` vinculado a una `OrderSession` que ya tiene `paymentStatus: 'paid'` (procesado por `checkout.session.completed` antes), el backend **descarta el evento** por idempotencia — no crea un segundo tab en Last, no emite un segundo `payment_succeeded`. Ver §9.

Si el backend recibe `payment_intent.succeeded` para una `OrderSession` que sigue en `paymentStatus: 'payment_pending'` (el `checkout.session.completed` no llegó aún o llegó tarde), el backend puede usar `payment_intent.succeeded` como respaldo para confirmar el pago. La misma lógica de validación del §8 aplica.

---

## 8. Verificación del webhook

### Verificación de firma

Todo request a `POST /stripe/webhook` debe verificarse antes de procesar.

1. El backend lee el header `Stripe-Signature` del request.
2. El backend llama a `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`.
3. Si la verificación falla (firma inválida, timestamp fuera de tolerancia): responde `400` con código `stripe_webhook_invalid` y descarta el evento.
4. Si la verificación pasa: procesa el evento.

**El body del webhook debe leerse como `raw` (Buffer), no como JSON parseado**, antes de verificar la firma. El parseo JSON ocurre después de la verificación.

### Fuentes de verdad al procesar

El backend **nunca** confía en datos del frontend para marcar `paymentStatus: 'paid'`.

- El `orderSessionId` se obtiene de `event.data.object.metadata.orderSessionId`.
- El backend carga `OrderSession` desde su propia base de datos por ese ID.
- El backend valida que `event.data.object.amount_total === OrderSession.total`.
- El backend valida que `event.data.object.currency` (en minúsculas) coincide con `OrderSession.currency` (en minúsculas).
- Si cualquier validación falla: responde `400` con código `stripe_session_not_found` o `stripe_amount_mismatch` y no procesa.

### Respuesta al webhook

- Éxito: `200` (vacío o `{ received: true }`)
- Error de firma: `400`
- Error de validación interna: `400`
- Error irrecuperable (excepción no controlada): `500` — Stripe reintentará

**Stripe espera `2xx` en menos de 30 segundos.** El backend debe responder `200` a Stripe aunque Last falle — el fallo de Last es una incidencia interna, no un error de pago.

---

## 9. Idempotencia

### Creación de Checkout Session

- El backend usa `Idempotency-Key: stripe-checkout-{orderSessionId}` en la llamada a la API de Stripe.
- Si el cliente o el backend reintenta `POST /order-sessions/{id}/checkout/stripe` para la misma sesión, Stripe devuelve la misma Checkout Session sin crear una nueva.
- El backend verifica si `stripeCheckoutSessionId` ya está persistido en `OrderSession` antes de llamar a Stripe — si existe y la sesión no ha expirado, devuelve la URL existente sin nueva llamada.

### Procesamiento de webhooks

- Stripe puede enviar el mismo evento más de una vez (reintentos ante fallo de respuesta).
- El backend persiste `stripeEventId` (`event.id`) de cada evento procesado.
- Antes de procesar un evento, el backend verifica si `stripeEventId` ya fue procesado:
  - Si ya fue procesado: responde `200` y descarta sin re-procesar.
  - Si no fue procesado: procesa y persiste el `stripeEventId`.

### Idempotencia en Last

- El tab en Last solo se crea si `lastSyncStatus` es `'not_sent'` o `'sync_failed'` al momento de procesar el webhook.
- Si `lastSyncStatus` ya es `'sent'` (otro proceso ya creó el tab): el backend no reintenta la creación en Last. Ver `docs/contracts/last-api.md` §Idempotencia.
- `LastOrderLink.lastPayloadHash` puede usarse como guardia adicional para evitar tab duplicado. Ver `docs/contracts/order-api.md` §`LastOrderLink`.

### `OrderSession.paymentStatus` — transición única

`OrderSession.paymentStatus` solo pasa a `'paid'` una vez. La lógica de procesamiento del webhook tiene un guard:

```
if (orderSession.paymentStatus === 'paid') → descartar, responder 200
```

Esta comprobación se ejecuta incluso si `stripeEventId` no está en la tabla de eventos procesados (defensa en profundidad).

---

## 10. Estados por situación

| Situación | `paymentStatus` | `lastSyncStatus` | UX cliente en `qr-order` | Acción en `orders` |
|---|---|---|---|---|
| Checkout Session creada, cliente en página de Stripe | `payment_pending` | `not_sent` | Spinner / "Procesando..." | No aparece aún |
| Pago exitoso, webhook procesado, Last OK | `paid` | `sent` | Pantalla de confirmación | Pedido en lista activa |
| Pago exitoso, webhook procesado, Last falla | `paid` | `sync_failed` | Pantalla de confirmación (sin error técnico) — mostrar código de pedido al cliente para que lo comunique al personal | Incidencia visible: `paymentStatus: 'paid'` + `lastSyncStatus: 'sync_failed'` → botón "Reenviar a Last" |
| Pago fallido (Stripe rechaza) | `payment_failed` | `not_sent` | Pantalla de error con opción de reintentar | No aparece (no es un pedido operativo) |
| Cliente cancela en Stripe | `payment_pending` → sin cambio automático | `not_sent` | `qr-order` detecta `cancel_url` y muestra opción de reintentar | No aparece |
| Checkout Session expira sin pago | `payment_pending` | `not_sent` | Si el cliente carga la URL expirada: pantalla `session_expired` | No aparece |
| Webhook duplicado (ya procesado) | Sin cambio | Sin cambio | Sin cambio | Sin cambio |
| Webhook tardío (pago ya marcado `paid`) | Sin cambio (guard idempotente) | Sin cambio | Sin cambio | Sin cambio |

### Regla de UI — Flujo A con Last fallido

Ver `docs/domain/order-lifecycle.md` §Reglas de UI, regla 5:

> Si `paymentStatus: 'paid'` y `lastSyncStatus: 'sync_failed'`, `qr-order` muestra la confirmación como exitosa. No expone el error técnico. El mensaje indica que el pedido está confirmado y recomienda mostrar el código al personal si hay incidencia.

---

## 11. Códigos de error

Los siguientes códigos se añaden al contrato canónico de `ApiError` de `docs/contracts/order-api.md`:

| `code` | HTTP | Significado | Emitido por |
|---|---|---|---|
| `stripe_checkout_failed` | 502 | El backend no pudo crear la Checkout Session en Stripe (error de red o de Stripe API) | `POST /order-sessions/{id}/checkout/stripe` |
| `stripe_webhook_invalid` | 400 | Firma del webhook inválida o timestamp fuera de tolerancia | `POST /stripe/webhook` |
| `stripe_payment_failed` | 402 | Stripe rechazó el cobro — `payment_intent.payment_failed` recibido | `POST /stripe/webhook` (procesamiento del evento) |
| `stripe_event_duplicate` | 200 | Evento ya procesado — respuesta idempotente, sin reprocessing | `POST /stripe/webhook` (respuesta, no es error) |
| `stripe_session_not_found` | 400 | `metadata.orderSessionId` del evento no corresponde a ninguna `OrderSession` | `POST /stripe/webhook` |
| `stripe_amount_mismatch` | 400 | `amount_total` del evento no coincide con `OrderSession.total` | `POST /stripe/webhook` |

> `stripe_event_duplicate` no es un error real — el backend responde `200`. Se documenta aquí como código interno para trazabilidad en logs. No se devuelve en el body del response.

**Relación con `order-api.md`:** estos códigos deben añadirse a la tabla de códigos de error de `docs/contracts/order-api.md` §Respuesta de error canónica. No se duplica la tabla — la fuente canónica sigue siendo `order-api.md`.

---

## 12. Reembolsos

**DECIDIDO: fuera de fase 1.**

En fase 1, los reembolsos se realizan manualmente desde el Stripe Dashboard por `admin`.

Requisitos para ejecutar un reembolso manual desde Stripe Dashboard:
- El `admin` necesita el `stripePaymentIntentId` del pedido — visible en `orders` en el detalle de la `OrderSession`.
- El reembolso en Stripe no cambia automáticamente `paymentStatus` en el sistema propio en fase 1 (no hay webhook de reembolso configurado).
- El `admin` debe actualizar el estado en `orders` manualmente si es necesario trazabilidad inmediata.

Cuando se implemente el flujo de reembolso:
- El endpoint ya está definido: `POST /order-sessions/{orderSessionId}/refund` — ver `docs/contracts/order-api.md` §Endpoints internos recomendados.
- El evento de webhook a suscribir: `charge.refunded` o `refund.created`.
- El flujo está definido en `docs/domain/order-lifecycle.md` §Flujo E.
- Añadir `STRIPE_WEBHOOK_SECRET` específico para reembolsos si se configura un webhook endpoint separado.

---

## 13. Seguridad

1. **`STRIPE_SECRET_KEY` nunca sale del backend.** El frontend no llama a Stripe directamente. El frontend solo recibe la `checkoutUrl` devuelta por el backend.

2. **`STRIPE_PUBLISHABLE_KEY` en frontend solo si se usa Stripe.js.** En Stripe Checkout hosted, el frontend no necesita `STRIPE_PUBLISHABLE_KEY` — solo la URL de redirección. Si en el futuro se usa Stripe Elements o Payment Element integrado, `STRIPE_PUBLISHABLE_KEY` se expone al frontend de forma segura (es público por diseño de Stripe).

3. **`STRIPE_WEBHOOK_SECRET` solo en backend.** Nunca en variables de entorno del frontend ni en el repositorio.

4. **El webhook solo escucha en el backend.** Ningún frontend tiene endpoint de webhook.

5. **`metadata` no es fuente de verdad única.** Los campos de `metadata` de la Checkout Session son convenientes pero manipulables si el endpoint de Stripe no está correctamente configurado. El backend siempre carga `OrderSession` desde su propia base de datos por `metadata.orderSessionId` y valida los importes antes de procesar.

6. **Validación de `amount_total` y `currency`** — ver §8. Un evento de Stripe con importes distintos a los de la `OrderSession` se rechaza con `stripe_amount_mismatch`. Esto previene procesamiento de eventos manipulados o erróneos.

7. **Tolerancia de timestamp de Stripe.** La verificación de firma de Stripe incluye una comprobación de timestamp (por defecto ±300 segundos). No desactivar esta comprobación ni ampliar la tolerancia.

8. **HTTPS obligatorio para el endpoint de webhook.** Stripe no enviará eventos a endpoints HTTP en producción.

---

## 14. Relación con Last

La relación entre Stripe y Last es **inexistente** — Stripe no sabe de Last y Last no sabe de Stripe.

El backend propio es el único punto de coordinación:

1. Stripe confirma pago → backend recibe `checkout.session.completed`.
2. Backend marca `paymentStatus: 'paid'` en `OrderSession`.
3. Backend llama a Last (`POST /tabs`) para crear el tab operativo.
4. Si Last falla: el pago no se revierte. `paymentStatus` permanece `'paid'`. `lastSyncStatus → 'sync_failed'`.
5. `orders` gestiona la incidencia: botón "Reenviar a Last" en la vista de incidencias.

**Regla:** un fallo de Last nunca debe causar un reembolso automático en Stripe en fase 1. Son dominios separados. El cobro es firme. La incidencia operativa se resuelve desde `orders`.

---

## 15. Variables de entorno

| Variable | Obligatoria | Uso |
|---|---|---|
| `STRIPE_SECRET_KEY` | Sí | Llamadas desde backend a la API de Stripe (crear Checkout Session, etc.) |
| `STRIPE_WEBHOOK_SECRET` | Sí | Verificación de firma en `POST /stripe/webhook` |
| `STRIPE_PUBLISHABLE_KEY` | No (fase 1) | Solo necesaria si se implementa Stripe Elements en frontend — no se usa en Checkout hosted |
| `STRIPE_SUCCESS_URL_BASE` | Sí | Base de la URL de éxito — ej: `https://order.peaksmash.com/order/success` |
| `STRIPE_CANCEL_URL_BASE` | Sí | Base de la URL de cancelación — ej: `https://order.peaksmash.com/order/cancel` |

### Formato de URLs

```
success_url = {STRIPE_SUCCESS_URL_BASE}?session_id={CHECKOUT_SESSION_ID}
cancel_url  = {STRIPE_CANCEL_URL_BASE}?orderSessionId={orderSessionId}
```

`{CHECKOUT_SESSION_ID}` es una plantilla de Stripe que se sustituye automáticamente por el ID de la Checkout Session al redirigir. `{orderSessionId}` es el ID del sistema propio, incluido manualmente en la URL de cancelación para que `qr-order` pueda recuperar el contexto.

### Modo test vs. live

- `STRIPE_SECRET_KEY` empieza por `sk_test_` en test y por `sk_live_` en producción.
- `STRIPE_WEBHOOK_SECRET` empieza por `whsec_`.
- En test, usar el Stripe CLI para reenviar webhooks: `stripe listen --forward-to localhost:3000/stripe/webhook`.
- No mezclar claves test y live en el mismo entorno.

---

## 16. Eventos de auditoría

Los eventos relevantes para el flujo de pago online están definidos en `docs/domain/order-lifecycle.md` §Eventos de auditoría recomendados.

El backend emite los siguientes eventos al procesar el webhook de Stripe:

| Evento | `actorType` | Cuándo | Referencia |
|---|---|---|---|
| `payment_started` | `customer` | Al crear la Stripe Checkout Session en `POST /order-sessions/{id}/checkout/stripe` | `order-lifecycle.md` |
| `payment_succeeded` | `webhook` | Al procesar `checkout.session.completed` con `payment_status: 'paid'` | `order-lifecycle.md` |
| `payment_failed` | `webhook` | Al procesar `payment_intent.payment_failed` | `order-lifecycle.md` |
| `last_sync_started` | `system` | Antes de llamar a Last tras confirmar pago | `order-lifecycle.md` |
| `last_sync_succeeded` | `system` | Si Last acepta el tab | `order-lifecycle.md` |
| `last_sync_failed` | `system` | Si Last devuelve error o timeout | `order-lifecycle.md` |

> `actorType: 'webhook'` en `payment_succeeded` indica que la confirmación provino de Stripe, no de un usuario ni del sistema propio. El `actorId` en este caso puede ser el `event.id` de Stripe para trazabilidad.

No se definen eventos nuevos específicos de Stripe en este documento — los definidos en `order-lifecycle.md` cubren el dominio completo.

---

## 17. Pendientes

| Decisión | Estado | Impacto si no se cierra |
|---|---|---|
| **Checkout hosted vs. Stripe Payment Element embebido** | **DECIDIDO:** Checkout hosted para fase 1. Payment Element aplazado. | Sin impacto en fase 1. Si se cambia, el backend devuelve `clientSecret` en lugar de `checkoutUrl` y el frontend integra `@stripe/stripe-js`. |
| **Reembolsos en fase 1** | **DECIDIDO:** fuera de fase 1 — manual desde Stripe Dashboard. Ver §12. | Sin impacto en fase 1. Añadir webhook `charge.refunded` y endpoint `POST /refund` cuando se implemente. |
| **Apple Pay / Google Pay** | **No decisión pendiente.** Stripe Checkout hosted los activa automáticamente si el dominio está verificado en el Stripe Dashboard. No requiere código adicional. | — |
| **Modo test/live en CI/staging** | Pendiente — no bloqueante para implementar. | Definir política de claves por entorno antes del primer deploy a staging. |
| **Conciliación contable** | Fuera de fase 1. | Sin impacto en fase 1. |

---

## 18. Veredicto

**Listo para implementar Stripe fase 1.**

Todas las decisiones necesarias para la implementación están cerradas:

- Flujo: Stripe Checkout hosted con `paymentMode: 'online'`
- Evento principal: `checkout.session.completed`
- Verificación: firma con `STRIPE_WEBHOOK_SECRET`
- Idempotencia: por `stripeEventId` + guard en `paymentStatus`
- Relación con Last: backend propio como coordinador, post-pago confirmado
- Errores: códigos canónicos definidos, pendiente añadir en `order-api.md`
- Variables de entorno: definidas
- Auditoría: referenciada desde `order-lifecycle.md`, sin duplicación
- Reembolsos: aplazados, endpoint ya existe en `order-api.md`

Lo único pendiente antes de deploy a producción es la verificación del dominio de `success_url` y `cancel_url` en el Stripe Dashboard y la configuración del webhook endpoint con los eventos `checkout.session.completed` y `payment_intent.payment_failed`.
