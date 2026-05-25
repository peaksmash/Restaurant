# QR Order + Orders App

## Objetivo

Definir una arquitectura clara para dos nuevas aplicaciones:

- `qr-order`: app de cliente para pedir desde QR de mesa o desde enlace directo
- `orders`: app interna de operación para gestionar pedidos, tiempos, estados, rescate de cobros y mini comandero

La idea base es buena, pero conviene ordenar responsabilidades para no mezclar:

- captura de pedido
- pago
- creación de `tab` en Last.app
- operación diaria del restaurante

La recomendación principal es esta:

- Para `qr-order`, usar **Opción A**: el pedido **no entra en Last hasta que está pagado**
- Para `orders`, permitir un flujo controlado de **pedido pendiente de cobro** solo para operación interna

Así evitamos llenar Last con pedidos fantasma o abandonados.

---

## Resumen ejecutivo

## Decisión de infraestructura

Se toma esta decisión base para seguir avanzando sin complicaciones:

- frontend público en **Cloudflare Pages**
- dominio público bajo `peaksmash.com`
- API pública en **Render**
- Last.app como sistema operativo del pedido final
- Stripe como sistema de cobro online

### Por qué esta decisión

Se prioriza:

- facilidad de despliegue
- bajo coste inicial
- poco mantenimiento
- estabilidad suficiente para arrancar
- posibilidad de crecer a más locales

### Elección recomendada

#### Frontend público: Cloudflare Pages

Se usará para:

- `order.peaksmash.com`
- en el futuro también podría servir para `ops.peaksmash.com` si conviene

Motivos:

- plan gratuito muy bueno para frontend
- CDN rápida
- fácil de conectar con dominio
- ideal para app pública de cliente

#### API pública: Render

Se recomienda Render antes que Railway para esta fase.

Motivos:

- más simple de entender
- despliegue muy directo
- suele ser más predecible para empezar
- encaja mejor con “quiero algo fácil y sin líos”

Railway sigue siendo opción válida, pero para este proyecto y este momento:

- **Render = opción recomendada por simplicidad**
- **Railway = opción alternativa si más adelante interesa pagar solo por uso**

### Lo que no se hará por ahora

No se adaptará la API pública a Cloudflare Workers en esta fase.

Motivo:

- añade más complejidad
- obliga a adaptar runtime y almacenamiento
- no es la ruta más fácil ahora mismo

El objetivo es sacar el sistema adelante con el menor rozamiento posible.

### App 1: `qr-order`

Es la app del cliente.

Sirve para:

- escanear QR de mesa
- ver catálogo
- añadir productos
- aplicar promociones visibles de Last
- pagar online con Stripe
- o generar un pedido pendiente con código/QR para pagar después

No debe crear un `tab` en Last si el pedido aún no está pagado.

### App 2: `orders`

Es la app interna del restaurante.

Sirve para:

- ver todos los pedidos operativos
- aceptar pedidos
- asignar tiempo estimado
- cambiar estados
- rescatar pedidos pendientes de cobro
- crear pedidos rápidos manuales

Esta app sí puede manejar flujos internos que el cliente no ve.

---

## Propuesta mejorada

Tu propuesta tiene sentido, pero la mejoraría así:

### Pestaña 1: `Orders`

Es la vista principal de cocina / operación.

Aquí entran:

- pedidos creados en Last desde `qr-order` ya pagados
- pedidos creados desde kiosko
- pedidos creados desde Last POS
- pedidos de Uber, Glovo y otros integradores

Funciones:

- ver pedido
- ver canal de origen
- poner tiempo estimado
- aceptar pedido
- cambiar estados
- marcar listo / entregado

Esta pestaña debe trabajar sobre pedidos que **ya existen en Last**.

### Pestaña 2: `Mini Comandero`

Es una herramienta rápida para personal.

Sirve para:

- tomar un pedido manualmente
- ayudar a clientes que no saben pedir solos
- crear un pedido rápido en barra o sala

Recomendación:

- aquí sí puedes crear un pedido pendiente en tu sistema
- luego enviarlo a Last solo cuando se confirme el cobro
- o permitir un modo interno especial:
  - crear `tab` en Last
  - dejarlo pendiente de cobro
  - rescatarlo después desde TPV interno

Importante:

- este flujo debe estar reservado a personal
- no al cliente

### Pestaña 3: `Rescate / Cobros pendientes`

Aquí se ven pedidos no pagados que están retenidos en tu sistema o en Last según el flujo.

Sirve para:

- buscar por código de 4 dígitos
- escanear QR
- abrir pedido pendiente
- cobrarlo
- completar su entrada operativa

Aquí hay dos subcasos:

1. Pedido pendiente solo en tu base de datos
2. Pedido ya creado en Last pero pendiente de cobro

La recomendación es priorizar el caso 1 para cliente y usar el caso 2 solo para operación interna.

---

## Reglas de negocio

> Flujos completos, transiciones de estado, reembolsos y expiración de sesión en `domain/order-lifecycle.md`.

Principios clave de este proyecto:

1. `qr-order` no crea tabs impagados en Last — el tab se crea solo tras pago confirmado.
2. `orders` puede gestionar flujos internos de cobro diferido bajo control de staff.
3. Last es la verdad del pedido operativo una vez sincronizado.
4. Backend propio es la verdad de sesiones, QR, PIN, pagos pendientes y sincronización.
5. Stripe confirma el cobro; no gestiona la operación del restaurante.

---

## Arquitectura funcional

## Arquitectura de despliegue recomendada

### Dominio

El dominio principal es:

- `peaksmash.com`

No importa si el dominio está comprado en Hostinger o en otro proveedor.

Lo importante es que el proveedor permita gestionar DNS o apuntar DNS a otro sitio.

### Subdominios recomendados

- `order.peaksmash.com`
  - app pública del cliente
  - QR de mesa
  - carrito
  - Stripe
  - pago diferido

- `api.peaksmash.com`
  - backend público
  - sesiones de pedido
  - Stripe webhook
  - integración con Last
  - rescate por código
  - lógica multi-restaurante y multi-local

- `ops.peaksmash.com`
  - futura app `orders`
  - uso interno con login

### Qué vive en Cloudflare

Cloudflare Pages servirá principalmente para:

- frontend público
- despliegue rápido del cliente web
- servir la app con HTTPS

### Qué vive en Render

Render alojará:

- API pública
- base de datos pública de pedidos temporales
- integración con Stripe
- integración con Last

### Backend local

El backend local sigue teniendo sentido, pero queda para:

- kiosko físico
- hardware local
- impresión
- soporte interno del restaurante
- posibles utilidades offline o semilocales

No será la pieza que atiende al cliente móvil por QR.

#### Flujo de rescate QR desde kiosk-web — comunicación local-server ↔ public API

Cuando un cliente paga en kiosco un pedido creado desde `qr-order` con `paymentMode: 'cashier'`, el flujo involucra dos backends:

| Capa | Responsabilidad |
|---|---|
| `kiosk-web` | UI del flujo de rescate — nunca llama directamente al public API |
| `local-server` | Broker: recupera `OrderSession` del public API, procesa pago físico con hardware local, notifica confirmación al public API |
| `api.peaksmash.com` (public API) | Owner de `OrderSession` · marca `paymentStatus: 'paid'` · crea tab en Last |
| Last.app | Recibe el tab solo tras pago confirmado |

**local-server debe poder comunicarse con el public API.** Esto requiere:

- `PUBLIC_API_BASE_URL` — variable de entorno configurable en local-server (ej. `https://api.peaksmash.com`).
- `PUBLIC_API_SERVICE_TOKEN` — credencial de servicio que identifica al local-server ante el public API. **No es un JWT de usuario** — es un token de servicio estático con scope limitado (solo llamadas de rescate y confirmación de cobro).

**Endpoints que local-server expone a kiosk-web (infraestructura local — no son contrato público de dominio):**

| Método | Endpoint en local-server | Qué hace |
|---|---|---|
| `GET` | `/rescue/{code}` | Proxy a `GET /order-sessions/recovery/{code}` en public API |
| `POST` | `/rescue/{orderSessionId}/pay` | Orquesta: procesa pago físico (hardware) → llama `POST /order-sessions/{id}/confirm-payment` en public API |

**Regla invariante:** local-server **no** crea un tab en Last para pedidos `qr_order`. El public API es el único que lo hace. Si local-server creara el tab también, el pedido quedaría duplicado en Last.

**`channel` y `paymentMode` no cambian:** el local-server no modifica estos campos. El pedido sigue siendo `channel: 'qr_order'`, `paymentMode: 'cashier'` en el public API.

#### KioskConfig — flags del flujo de rescate

Los siguientes flags se añaden a `KioskConfig` en `local-server` y se consumen en `kiosk-web`. No están en el contrato de `order-api.md` porque son configuración de producto del kiosco físico, no del dominio de pedidos.

| Campo | Tipo | Descripción | Default |
|---|---|---|---|
| `kiosk.features.qrRescue` | `boolean` | Activa el botón "Paga aquí tu pedido" en la welcome screen del kiosco y todo el flujo de rescate | `false` — opt-in |
| `kiosk.features.qrCamera` | `boolean` | Activa la opción de escanear QR en la pantalla de búsqueda (solo si el hardware tiene cámara) | `false` |
| `kiosk.rescue.buttonText` | `string?` | Texto del botón de rescate (por defecto: "Paga aquí tu pedido") | `undefined` |
| `kiosk.rescue.subtitleText` | `string?` | Subtexto del botón (por defecto: "Escanea el QR o introduce el código que recibiste al hacer tu pedido.") | `undefined` |
| `kiosk.rescue.autoResetSeconds` | `number?` | Segundos de inactividad en pantalla de confirmación antes de volver a la welcome screen | `30` |

> Estos flags se sirven desde `local-server` junto con el resto de `KioskConfig`. Cuando se formalice el esquema de `KioskConfig` como contrato propio, estos campos deben trasladarse a ese documento.

---

## Multi-local y escalabilidad

Sí, esta arquitectura sirve para más locales.

De hecho, conviene diseñarla ya así desde el principio.

### Qué significa multi-local aquí

Que una sola plataforma pueda trabajar con:

- varios restaurantes
- varios locales por restaurante
- varias marcas por local
- varios catálogos si hace falta
- muchas mesas por local

### Qué debe soportar la API pública

Cada pedido o sesión debe quedar ligado a:

- `organizationId`
- `locationId`
- `brandId`
- `catalogId`
- `tableId` si aplica

Y además:

- `channel`
- `source`
- `restaurantSlug` o identificador público

### Cómo identificar cada local

La forma recomendable es usar en la URL o en el token QR una referencia que permita resolver:

- restaurante
- local
- mesa

Ejemplo conceptual:

- `order.peaksmash.com/r/abc123`

Ese `abc123` no tiene por qué ser la mesa visible.
Puede ser un token que tu backend resuelva internamente.

### Qué ventaja tiene esto

Que no necesitas una app distinta por local.

Puedes tener una sola infraestructura pública para:

- Local A
- Local B
- Local C

y luego cada sesión se resuelve al local correcto.

### ¿Render sirve para esto?

Sí.

Para arrancar con varios locales pequeños o medianos, Render puede servir sin problema si la arquitectura está bien organizada.

Más adelante, si creciera mucho el volumen, ya podrías:

- subir plan
- mover base de datos
- separar servicios

Pero para empezar y crecer ordenadamente:

- **sí, Render vale**

## App `qr-order`

### Qué hace

- recibe contexto de mesa desde QR
- consulta catálogo desde backend
- muestra promociones
- construye carrito
- permite dos caminos:
  - pagar online
  - generar código/QR para pagar después

### Qué no debe hacer

- no debe crear directamente tabs sin pagar en Last
- no debe cambiar estados operativos
- no debe rescatar cobros internos

### Flujo 1: pedido con pago online

1. Cliente escanea QR de mesa
2. `qr-order` identifica restaurante, local y mesa
3. Cliente arma pedido
4. Backend crea pedido local con estado `pending_payment`
5. Cliente paga con Stripe
6. Stripe confirma
7. Backend:
   - crea `tab` en Last
   - crea o usa `bill`
   - registra `payment` en Last
8. El pedido ya aparece operativo
9. La app `orders` lo muestra en la pestaña `Orders`

### Flujo 2: pedido para pagar después

1. Cliente escanea QR
2. arma pedido
3. elige “pagar después”
4. backend guarda pedido local `pending_kiosk_payment`
5. backend genera:
   - `orderCode`
   - `pin4`
   - `qrToken`
6. cliente recibe QR/código
7. cliente va al kiosko o a un punto de cobro
8. allí se recupera el pedido
9. se cobra
10. backend:
    - crea `tab` en Last
    - registra `payment` en Last
11. la app `orders` ya lo trata como pedido operativo

### Flujo 3: pedido desde mesa con ayuda del personal

1. cliente no sabe usar QR
2. empleado abre `Mini Comandero`
3. crea pedido en nombre del cliente
4. se cobra o se deja pendiente según modo interno

---

## App `orders`

## Pestaña 1: `Orders`

Es el centro operativo.

### Qué muestra

- pedidos activos
- canal de origen:
  - QR Order
  - Kiosk
  - POS
  - Uber
  - Glovo
  - otros
- estado actual
- tiempo estimado
- forma de pago
- si está pagado o no

### Acciones principales

- aceptar pedido
- asignar tiempo estimado
- actualizar estado
- marcar listo
- marcar entregado
- cancelar si aplica

### Estados sugeridos

Para simplificar mucho:

- `pending`
- `accepted`
- `preparing`
- `ready`
- `delivered`
- `cancelled`

Si Last tiene estados concretos, esta app debe mapearlos claramente.

### Tiempo de pedido

Para pedidos que entren en Last, el tiempo puede apoyarse en:

- `pickupTime` si quieres reflejar hora estimada
- lógica operativa interna para mostrar “10 min”, “15 min”, “20 min”

Recomendación:

- guardar internamente `confirmedPreparationMinutes` (ver `domain/preparation-times.md`)
- derivar `estimatedReadyAt = createdAt + confirmedPreparationMinutes`

---

## Pestaña 2: `Mini Comandero`

### Objetivo

Permitir crear pedidos rápidos para:

- clientes que no usan QR
- incidencias
- ventas en sala o mostrador
- personal que toma nota rápida

### Modos recomendados

#### Modo A: cobrar primero, enviar después

1. empleado crea pedido
2. se cobra
3. backend crea `tab` y pago en Last

Es el modo más limpio.

#### Modo B: crear tab y cobrar después

1. empleado crea pedido
2. backend crea `tab` en Last
3. queda pendiente de cobro
4. luego se rescata en la pestaña `Rescate`

Este modo es útil, pero conviene dejarlo solo para staff.

### Recomendación

Usar Modo A por defecto y Modo B solo como excepción operativa.

---

## Pestaña 3: `Rescate / Cobros pendientes`

### Objetivo

Cobrar pedidos que quedaron pendientes.

### Búsqueda

- por PIN de 4 dígitos
- por QR
- por nombre
- por teléfono
- por código largo

### Casos que debería soportar

#### Caso 1: pedido solo local, aún no enviado a Last

Es el mejor caso para cliente.

1. recuperas pedido local
2. cobras
3. creas `tab` en Last
4. registras `payment` en Last

#### Caso 2: pedido ya creado en Last, pendiente de pago

Es útil para operación interna.

1. recuperas tab o bill
2. cobras
3. registras `payment` en Last

### Recomendación funcional

- cliente externo: solo caso 1
- personal interno: caso 1 y caso 2

---

## Modelo de datos

> Contrato canónico de entidades, campos e interfaces TypeScript en `contracts/order-api.md`.

Las cuatro entidades principales son `OrderSession`, `LastOrderLink`, `OrderSessionEvent` y `TableMapping` / `TableQrMapping`. Ver `contracts/order-api.md` §Entidades principales y §Contrato base para campos completos, tipos e identificadores canónicos.

---

## Fuentes de verdad

Para que esto escale bien, cada dato debe tener dueño.

### Last.app

Es verdad para:

- catálogo
- promociones
- productos finales del tab
- totales finales del pedido
- bills
- payments registrados en restaurante
- estados operativos del pedido

### Tu backend

Es verdad para:

- pedidos temporales no enviados aún a Last
- QR propios
- PIN de rescate
- sesiones de checkout
- Stripe payment intents
- lógica de expiración
- trazabilidad multi-canal

### Stripe

Es verdad para:

- confirmación del cobro online
- estado del pago online
- reembolsos online

---

## Integración con Last.app

## Qué usar de Last

### Para catálogo

- `GET /catalogs/{catalogId}`

### Para promociones

- `GET /promotions`
- `GET /promotions/{promotionId}`

### Para crear pedido real

- `POST /tabs`

Campos que te interesan:

- `brandId`
- `source`
- `products`
- `code`
- `operationalCode`
- `customer`
- `notes`
- `tableId`
- `pickupTime`
- `preferredPaymentMethod`
- `promotionId`
- `payments`
- `dineIn`

### Para cobrar

- `POST /payments`

### Para consultar estado

- `GET /tabs/{tabId}`
- `GET /orders/{tabId}/status`

### Para gestionar cuenta

- `POST /bills`
- `GET /bills/{billId}`

---

## Cómo usar `tableId`

Si el flujo es “pedido desde mesa”, lo correcto es vincular el pedido a mesa real.

Eso implica:

- cada QR de mesa debe apuntar a una mesa concreta
- tu sistema debe conocer el `lastTableId`

Recomendación:

- no pongas el `lastTableId` directamente visible en el QR
- usa un `qrToken`
- tu backend traduce ese token a:
  - restaurante
  - local
  - mesa
  - `lastTableId`

---

## Política recomendada de cobro

## Cliente final

### Pago online

- cobras primero
- luego creas pedido en Last

### Pago en kiosko o caja

- guardas pedido local
- luego cobras
- luego creas pedido en Last

## Personal interno

### Mini comandero

Puede tener dos modos:

- `charge_then_send`
- `send_then_collect`

Pero `send_then_collect` debe ser interno y controlado.

---

## Riesgos y cómo evitarlos

## Riesgo 1: pedidos fantasma en Last

Pasa si mandas tabs antes de cobrar.

Solución:

- para cliente, no mandar nada a Last hasta pago correcto

## Riesgo 2: cobro en Stripe pero pedido no creado en Last

Pasa si Stripe confirma y luego falla Last.

Solución:

- crear cola de reintento
- marcar estado `paid_pending_last_sync`
- alertar en `orders`

## Riesgo 3: duplicados

Pasa si el cliente repite pago o si hay doble envío.

Solución:

- usar `externalId` propio
- idempotencia en Stripe
- estado interno por sesión

## Riesgo 4: PIN de 4 dígitos muy corto

Pasa si solo dependes del PIN.

Solución:

- usar PIN de 4 dígitos solo como ayuda visual
- la clave real debe ser un `qrToken` largo y seguro

## Riesgo 5: mesa equivocada

Pasa si no mapeas bien QR -> mesa.

Solución:

- sistema robusto de `tables`
- validación visual del nombre de mesa

---

## Roadmap recomendado

## Fase 1

Base sólida.

- `order.peaksmash.com` en Cloudflare Pages
- `api.peaksmash.com` en Render
- `qr-order` con pedido local
- Stripe
- crear tab en Last solo tras pago
- app `orders` mostrando pedidos ya creados en Last

## Fase 2

Cobro diferido.

- QR + PIN de rescate
- pestaña `Rescate / Cobros pendientes`
- recuperación y cobro manual

## Fase 3

Operación interna completa.

- mini comandero
- flujo interno de tab pendiente de cobro
- tiempos dinámicos
- panel multi-canal

## Fase 4

Refinamiento.

- reintentos automáticos
- conciliación Stripe/Last
- auditoría completa
- permisos por rol

---

## Decisiones recomendadas

Si quieres que esto quede profesional y no se rompa con el tiempo, yo tomaría estas decisiones:

1. `qr-order` nunca crea tabs impagados en Last.
2. `orders` es la única app que puede gestionar excepciones internas.
3. `Rescate / Cobros pendientes` vive dentro de `orders`.
4. `Mini Comandero` es herramienta interna, no pública.
5. Last es verdad para pedido final, bill, payment y estados.
6. Tu backend es verdad para sesiones, QR, PIN y pagos pendientes.
7. Stripe solo confirma el dinero, no la operación del restaurante.
8. Cloudflare Pages será el frontend público por simplicidad y coste.
9. Render será la API pública inicial por facilidad de despliegue.
10. La arquitectura se diseñará desde ya para soportar varios locales.

---

## Decisiones pendientes bloqueantes

Estas decisiones deben estar tomadas y documentadas antes de escribir una línea de código.

### ~~P1~~ — ~~Autenticación de `orders`~~

**DECIDIDO 2026-05-16.** Ver `docs/auth/auth-model.md`.

- Mecanismo: Supabase Auth con JWT. Rol resuelto desde `app_metadata.role` en el JWT verificado.
- Roles canónicos: `staff`, `kitchen`, `manager`, `admin`.
- Primer admin: proceso manual en Supabase Dashboard.
- Recovery y revocación: Supabase Auth nativo.

`qr-order` es pública y no requiere autenticación de usuario, pero sí validación de `qrToken` en cada request.

### ~~P2~~ — ~~Tiempo real en `orders`~~

**DECIDIDO 2026-05-16: Polling incremental con `since=updatedAt`.**

- Intervalo normal (pestaña visible): **10 segundos**.
- Intervalo pestaña oculta (Page Visibility API): **60 segundos**.
- Fallo de conexión: backoff exponencial 15s → 30s → 60s.
- Refresh forzado tras toda acción crítica (aceptar, cambiar estado, cobrar, cancelar, reintentar sync).
- Botón refresh manual siempre visible.
- SSE y WebSocket descartados en fase 1: SSE requiere workaround de auth con JWT que añade complejidad no justificada; WebSocket es excesivo para un flujo unidireccional.
- Endpoint de consulta: `GET /order-sessions?active=true&since={isoDateTime}&limit=100`. Ver `docs/contracts/order-api.md` §Endpoints internos recomendados.
- `updatedAt` debe actualizarse en backend ante cualquier cambio de estado, pago, sync o tiempos de `OrderSession`.

### ~~P3~~ — ~~Resolución de catálogo en qr-order~~

**DECIDIDO 2026-05-16.**

- `qr-order` no llama a Last directamente.
- `qr-order` consume `GET /catalog/{catalogId}` del backend propio tras resolver el QR.
- El backend hace proxy a Last, aplica promociones activas y devuelve el catálogo normalizado.
- TTL de caché: 5 minutos.
- Productos no disponibles se filtran en el backend — no llegan al cliente.
- Contrato de respuesta: `docs/contracts/order-api.md` §Respuesta de `GET /catalog/{catalogId}`.

### ~~P4~~ — ~~Modificabilidad del carrito~~

**DECIDIDO 2026-05-16: Opción A.**

- El carrito vive en el cliente (localStorage) asociado al `qrToken` / `tableId` de la mesa.
- `OrderSession` se crea en el backend únicamente al confirmar checkout.
- Durante la navegación del catálogo no existe sesión activa en el backend.
- El cliente puede modificar el carrito libremente antes de confirmar.
- Al confirmar el pedido o al expirar una sesión `cashier`, el carrito se limpia del localStorage.

### ~~P5~~ — ~~Visibilidad de `estimatedReadyAt` en qr-order~~

**DECIDIDO 2026-05-15.** Ver `domain/preparation-times.md` §Visibilidad de `estimatedReadyAt` en qr-order.

---

## Revisión rápida pendiente

Cuando vuelvas a revisar este documento, fíjate sobre todo en estas decisiones:

1. `qr-order` público en `order.peaksmash.com`
2. API pública en `api.peaksmash.com`
3. `orders` como app separada en `ops.peaksmash.com`
4. cliente nunca crea tabs impagados en Last
5. operación interna sí puede rescatar y cobrar pendientes
6. arquitectura pensada desde el inicio para varios locales
7. autenticación de `orders`: Supabase Auth + roles por JWT (~~P1~~ — **decidido 2026-05-16**, ver `auth/auth-model.md`)
8. actualización de lista de pedidos: polling incremental 10s con `since=updatedAt` (~~P2~~ — **decidido 2026-05-16**)
9. resolución de catálogo vía proxy del backend propio (~~P3~~ — **decidido 2026-05-16**)
10. carrito vive en cliente hasta checkout — OrderSession se crea en checkout (~~P4~~ — **decidido 2026-05-16**)
10. `estimatedReadyAt` incluido en respuesta de confirmación de pago, sin tiempo real en fase 1 (~~P5~~ — **decidido 2026-05-15**)

Si estas decisiones te cuadran, la base estratégica del proyecto está bien orientada.

---

## qr-order fase 1 — Decisiones funcionales cerradas

Fecha de cierre: 2026-05-16.

### Entrada y routing

- El identificador operativo de entrada es `qrToken` (en URL o QR físico).
- `restaurantSlug` no es operativo en fase 1. El routing de entrada no depende de él.
- El backend resuelve `qrToken` con `GET /tables/resolve/{qrToken}`.
- El backend solo mantiene el mapping `qrToken -> lastTableId`; Last.app sigue siendo owner de la mesa real.
- La respuesta proporciona `organizationId`, `locationId`, `brandId`, `catalogId`, `tableId`, `lastTableId` y `tableName`.
- `tableName` viene del resolve de `qrToken`. El backend intenta obtenerlo de Last vía `fetchFloorplans(...)` (implementado en `local-server`) y cae al `tableNameSnapshot` como fallback. El endpoint y shape de mesas están confirmados — ver `docs/contracts/last-api.md` §Mesas reales de Last.

### UX inicial — pantalla de mesa

Después de resolver `qrToken` con éxito y antes de mostrar el catálogo, `qr-order` muestra una pantalla de presentación de la mesa. Esta pantalla **no es la welcome screen de `kiosk-web`**.

**Condiciones de aparición:**
- Solo si el resolve de `qrToken` fue exitoso.
- Solo si la config y el catálogo cargaron correctamente.
- Si hay error en cualquiera de esos pasos: mostrar `ErrorScreen` directamente, nunca esta pantalla.

**Contenido:**
- Fondo negro.
- Logo del restaurante centrado. Si no existe logo: nombre del restaurante.
- Nombre real de la mesa (campo `tableName` de la respuesta de resolve). Si no existe `tableName`: fallback neutro controlado (no mostrar nada incorrecto).
- Texto fijo: **"Pago en efectivo: solo en barra."**
- Countdown de 8 segundos. Al terminar: avanza al catálogo automáticamente.
- Botón "Ver menú" visible desde el inicio: salta el countdown y avanza al catálogo.

**No hay:**
- selector de "pedir aquí / llevar" — la mesa es implícita, `channel` siempre es `qr_order`
- animaciones de bienvenida
- selector de idioma
- ningún elemento interactivo salvo el botón de saltar

**Regla de `tableName`:** viene de la respuesta de `GET /tables/resolve/{qrToken}`. La fuente canónica es `tables[].name` de `GET /v2/floorplans?locationId=...` en Last. El resolve intenta obtener el nombre real desde `fetchFloorplans(...)` (implementado en `local-server`) y cae al `tableNameSnapshot` solo si falla. El texto de fallback no debe mostrar IDs técnicos al cliente.

### Catálogo

- Categorías como tabs navegables + scroll.
- Buscador de productos en fase 1.
- Productos sin imagen funcionan sin imagen — la UI no depende de ella.
- Productos no disponibles no se muestran (filtrados en el backend).
- Alérgenos e información nutricional se muestran si el backend los devuelve; se omiten si no.

### Modificadores

- Modificador obligatorio sin selección bloquea añadir al carrito.
- Modificador opcional no bloquea.
- Precio adicional de cada modificador visible, con total del producto actualizado en tiempo real.
- Imágenes de modificadores fuera de fase 1.

### Carrito

- Carrito persiste en localStorage asociado al `qrToken` / `tableId`.
- Nota por producto mediante icono de notas (campo `notes` de `OrderSessionItem`).
- Nota general del pedido al final de la cesta (campo `notes` de `OrderSession`).
- Descuentos/promociones desglosados si existen.
- El cliente puede cambiar método de pago antes de confirmar.
- Sin límite de items por pedido en fase 1.
- Al confirmar el pedido o al expirar sesión `cashier`, el carrito se limpia.

### Cliente

- El nombre del cliente (`customer.name`) es obligatorio antes de pagar.
- `customer.surname`, `customer.phoneNumber` y `customer.email` no son obligatorios en fase 1.
- El contrato canónico de `CustomerInfo` está en `docs/contracts/order-api.md`.

### Métodos de pago

- Disponibles en fase 1: `online` y `cashier`.
- `online` es el método recomendado y se muestra por defecto.
- `cashier` se muestra como "Pagar en efectivo". Mensaje al cliente: "Puedes pagar en caja o en el kiosko con tu código o QR."
- Pago online: Stripe Checkout hosted (recomendado fase 1).
- Pago `cashier`: crea `OrderSession` local con `paymentStatus: 'unpaid'` — no se manda tab a Last hasta que staff confirme cobro.
- Expiración `cashier`: 30 minutos desde creación de `OrderSession` (campo `expiresAt`).
- Al expirar, el backend cancela la sesión automáticamente. El cliente debe crear un nuevo pedido.

### Confirmación

- Mostrar código de pedido (`orderSessionId` o código legible).
- Mostrar mesa (`tableName`).
- Mostrar `estimatedReadyAt` si existe: como hora concreta y/o minutos aproximados.
- Botón "Nuevo pedido": limpia carrito del localStorage y vuelve al catálogo de la misma mesa.
- La pantalla de confirmación no expira visualmente en fase 1.

### Sincronización con Last fallida

- Si `paymentStatus: 'paid'` y `lastSyncStatus: 'sync_failed'`: mostrar confirmación como exitosa.
- No exponer el error técnico al cliente.
- Mensaje: el pedido está confirmado; si hay incidencia, mostrar código al personal.
- `orders` gestiona la incidencia operativa.
- Ver `docs/domain/order-lifecycle.md` §Reglas de UI, regla 5.

### Persistencia del carrito (localStorage)

- Clave de almacenamiento: `qr-order-cart:{qrToken}:{tableId}`.
- Si el usuario abre dos pestañas del navegador con la misma mesa, comparten el mismo carrito local — comportamiento aceptado en fase 1.
- Al confirmar el pedido, se elimina esa clave del localStorage.
- Al detectar que una sesión `cashier` ha expirado, la app elimina esa clave del localStorage.

### Visual y configuración

- Español únicamente en fase 1.
- Modo oscuro permitido.
- Nombre del restaurante visible en cabecera.
- `qr-order` debe consumir la misma configuración visual que `kiosk-web` y `admin` (temas, colores, logo).
- El mecanismo técnico de propagación de configuración visual está pendiente de auditoría del repositorio actual. No bloquea el scaffold inicial, pero sí bloquea el diseño visual final.

### Admin de QR mappings (fase inicial)

- `admin-web` no crea, edita ni borra mesas reales.
- `admin-web` solo gestiona mappings QR -> `lastTableId`.
- El endpoint de mesas de Last está confirmado: `GET /v2/floorplans?locationId=...` devuelve mesas reales con `id` y `name`. Ver `docs/contracts/last-api.md` §Mesas reales de Last.
- `fetchFloorplans(...)` está implementado en `local-server`. El endpoint `/api/last/tables` devuelve mesas reales de Last con `id` y `name`.
- `tableNameSnapshot` sigue siendo fallback visual cuando el fetch falla; no es la fuente de verdad.
- El input manual de `lastTableId` debe sustituirse por un selector de mesas reales desde `admin-web` — pendiente de implementar en la UI de admin.

---

## Conclusión

La idea general es buena y tiene mucho sentido comercial.

La mejora principal es separar bien:

- experiencia de cliente
- operación interna
- pagos
- sincronización con Last

La estructura final recomendada queda así:

- `qr-order`
  - cliente
  - pedido local
  - pago online o pago diferido
  - no crea tab impagado en Last

- `orders`
  - operación interna
  - pedidos reales ya sincronizados
  - tiempos y estados
  - rescate de cobros
  - mini comandero

Con eso puedes crecer sin bloquearte y sin ensuciar Last con flujos mixtos mal cerrados.

---

## qr-order — Estado de implementación real (2026-05-18)

Esta sección documenta qué está realmente implementado, qué existe solo como demo en desarrollo y qué queda pendiente. Se actualiza con cada sesión de trabajo.

### Reglas de esta sección

- **Implementado**: funciona en producción contra datos reales.
- **Demo/dev**: existe código, pero con simulación explícita. No llega a backend real. Marcado con prefijo `DEMO-` o equivalente. No visible en producción.
- **Pendiente**: no existe. El contrato está documentado, pero el código no está escrito.

**Regla invariante:** ninguna confirmación real puede venir de datos simulados. Cualquier pantalla de confirmación en producción debe derivar de una `OrderSession` persistida en el backend. El botón de checkout en producción debe estar bloqueado hasta que el flujo real esté implementado.

---

### Tabla de estado

#### qr-order

| Flujo | Estado | UI | Backend | Observación |
|---|---|---|---|---|
| Resolver mesa por `qrToken` | **Implementado** | ✅ | ✅ | `GET /api/tables/resolve/:qrToken` real con datos del local |
| Pantalla de mesa (mesa intro screen) | **Implementado** | ✅ | — | `TableIntroScreen.tsx`: logo real, tableName real, fallback "Tu mesa", countdown 8s, botón "Ver menú", texto "Pago en efectivo: solo en barra." |
| Cargar configuración visual | **Implementado** | ✅ | ✅ | Config real cargada desde backend; misma interfaz que `kiosk-web` |
| Cargar catálogo | **Implementado** | ✅ | ✅ | Catálogo real desde Last vía proxy backend |
| Navegar productos y modificadores | **Implementado** | ✅ | — | Catálogo real, selección local en cliente |
| Carrito local | **Implementado** | ✅ | — | Carrito en localStorage; cálculo de totales local (solo display) |
| Selección de método de pago (online/cashier) | **Implementado** | ✅ | — | Visual funcional; no dispara flujo real |
| `POST /order-sessions` — crear sesión | **Pendiente** | — | — | Contrato definido en `order-api.md`; no implementado |
| Checkout online — `POST /order-sessions/{id}/checkout/stripe` | **Pendiente** | — | — | Contrato en `order-api.md` y `stripe-webhook.md`; no implementado |
| Pago en Stripe Checkout hosted | **Pendiente** | — | — | Requiere endpoint anterior |
| Webhook Stripe — `POST /stripe/webhook` | **Pendiente** | — | — | Contrato en `stripe-webhook.md`; no implementado |
| Confirmación real (`paymentStatus: 'paid'`) | **Pendiente** | — | — | Requiere webhook Stripe procesado por backend |
| Flujo cashier — crear sesión y generar `pin4` | **Pendiente** | — | — | Requiere `POST /order-sessions` con `paymentMode: 'cashier'` |
| Pantalla cashier — mostrar `pin4` y QR rescate | **Pendiente** | — | — | Post-creación cashier; antes de que se cobre |
| Confirmación cashier — `POST /confirm-payment` | **Pendiente** | — | — | Contrato en `order-api.md`; no implementado |
| Sync con Last — crear tab | **Pendiente** | — | — | Solo se ejecuta tras pago confirmado por backend |

#### orders — app de operación interna

**`orders` no existe todavía.** El dominio está documentado y los contratos están definidos, pero no hay implementación.

El primer paso es un **scaffold visual/mock explícito** — sin backend real conectado — que permita validar la estructura de pantallas antes de implementar los endpoints.

| Funcionalidad | Estado | Observación |
|---|---|---|
| Login con Supabase Auth | **Pendiente** | Decisión cerrada en `docs/auth/auth-model.md` |
| Lista de pedidos activos (polling `since=updatedAt`) | **Pendiente** | Contrato en `order-api.md` §`GET /order-sessions` |
| Bandeja de cobros cashier pendientes | **Pendiente** | `paymentStatus: 'unpaid'` + `paymentMode: 'cashier'` — separada de pedidos operativos |
| Bandeja de incidencias `sync_failed` | **Pendiente** | `paymentStatus: 'paid'` + `lastSyncStatus: 'sync_failed'` |
| Rescate por `pin4` / código | **Pendiente** | `GET /order-sessions/recovery/{tokenOrCode}`; `pin4` es el método principal |
| Confirmar cobro cashier desde `orders` | **Pendiente** | `POST /order-sessions/{id}/confirm-payment` con JWT staff |
| Cambiar estado operativo | **Pendiente** | `PATCH /order-sessions/{id}/status`; rol mínimo según transición |
| Reenviar a Last (`sync_failed`) | **Pendiente** | `POST /order-sessions/{id}/send-to-last`; rol mínimo `manager` |
| Reembolso | **Pendiente** | Flujo E; manual en Stripe Dashboard en fase 1 |

**Reglas de separación de bandejas en `orders`:**
- Pedidos `cashier unpaid`: bandeja "Cobros pendientes" — no son pedidos operativos, no aparecen en la lista principal.
- Pedidos `paid + sync_failed`: bandeja "Incidencias" — sí son pedidos cobrados, pero con fallo de sync.
- Pedidos con `operationalStatus` en `['accepted', 'preparing', 'ready']`: lista principal de pedidos activos.

---

## orders — Comportamiento funcional real

Esta sección define cómo debe comportarse `orders` cuando esté conectado a backend real. El scaffold visual construido por Codex debe implementar el layout, la navegación entre vistas y los estados visuales ya en esta fase, de forma que conectar el backend no requiera rehacer la UI — solo activar las llamadas y retirar los stubs.

### Principio de diseño

`orders` es una app de lectura y acción, no de creación. No crea pedidos, no crea tabs en Last, no modifica `channel` ni `paymentMode`. Su dominio: visualizar `OrderSession` del backend propio y ejecutar acciones autorizadas sobre ellas.

---

### Vista 1 — Pedidos activos (bandeja principal)

**Filtro:**
```
paymentStatus = 'paid'
AND lastSyncStatus = 'sent'
AND operationalStatus IN ['pending', 'accepted', 'preparing', 'ready']
```

**Qué muestra por pedido:** `operationalStatus`, `channel` (badge), `tableName`, `customer.name`, `total`, `estimatedReadyAt` (si existe), `createdAt`. Para `staff` y `manager`: importe. Para `kitchen`: sin importe, sin `paymentStatus`, sin `CustomerInfo.phoneNumber`/`email`.

**Qué NO muestra:** pedidos `unpaid` (→ Cobros pendientes), pedidos `sync_failed` (→ Incidencias), pedidos en `delivered`/`cancelled` (estados finales — bandeja de historial opcional, no lista activa).

**Acciones por estado:**

| `operationalStatus` | Acción | Endpoint | Rol mínimo |
|---|---|---|---|
| `pending` | Aceptar | `PATCH /order-sessions/{id}/status` `{ status: 'accepted' }` | `staff` |
| `accepted` | Marcar preparando | `PATCH /order-sessions/{id}/status` `{ status: 'preparing' }` | `kitchen` |
| `accepted` | Asignar tiempo estimado | endpoint por definir en `order-api.md` | `staff` |
| `preparing` | Marcar listo | `PATCH /order-sessions/{id}/status` `{ status: 'ready' }` | `kitchen` |
| `ready` | Marcar entregado | `PATCH /order-sessions/{id}/status` `{ status: 'delivered' }` | `manager` |
| cualquier no-final | Cancelar | `POST /order-sessions/{id}/cancel` + confirmación explícita en UI | `manager` |

**En scaffold:** botones presentes, deshabilitados, tooltip "Requiere conexión a backend". Estado visual del pedido estático.

**Con backend:** cada acción llama al endpoint con `Authorization: Bearer {jwt}`. La lista hace refresh forzado inmediato — no espera el siguiente polling.

---

### Vista 2 — Kitchen

**Filtro:**
```
paymentStatus = 'paid'
AND lastSyncStatus = 'sent'
AND operationalStatus IN ['accepted', 'preparing']
```

Es un subconjunto estricto de la bandeja principal. Diseñada para pantalla de cocina — sin datos de cobro.

**Qué muestra:** items del pedido, notas por ítem, nota general, `tableName`, `customer.name`, `operationalStatus`, `estimatedReadyAt`.

**Qué NO muestra:** `total`, `unitPrice`, `totalPrice`, `paymentStatus`, `lastSyncStatus`, `CustomerInfo.phoneNumber`, `CustomerInfo.email`, canal de origen.

**Acciones:**

| Acción | Endpoint | Rol mínimo |
|---|---|---|
| Marcar preparando | `PATCH /order-sessions/{id}/status` `{ status: 'preparing' }` | `kitchen` |
| Marcar listo | `PATCH /order-sessions/{id}/status` `{ status: 'ready' }` | `kitchen` |

Sin botón de cancelar, entregar, ni cobrar en esta vista.

**En scaffold:** mismo patrón — botones presentes, deshabilitados, tooltip.

---

### Vista 3 — Incidencias

**Filtro:**
```
paymentStatus = 'paid'
AND lastSyncStatus = 'sync_failed'
```

Pedidos cobrados que no llegaron a Last. El cliente ya pagó; el pedido no existe en cocina todavía. Son incidencias operativas activas — no historial.

**Qué muestra:** `customer.name`, `tableName`, `total`, `createdAt`, tiempo transcurrido desde el fallo, mensaje de error del último intento (texto del backend — no stacktrace bruto). El mensaje de error solo es visible para `manager` y `admin`.

**Acciones:**

| Acción | Endpoint | Rol mínimo |
|---|---|---|
| Reintentar sync con Last | `POST /order-sessions/{id}/send-to-last` | `manager` |
| Ver historial de eventos | `GET /order-sessions/{id}/events` | `manager` |

**Tras reintento exitoso:** `lastSyncStatus` → `'sent'`. El pedido desaparece de Incidencias y aparece en Pedidos activos con `operationalStatus: 'pending'`. Refresh forzado inmediato.

**Tras reintento fallido:** `lastSyncStatus` sigue `'sync_failed'`. El pedido permanece en Incidencias con el nuevo mensaje de error.

**En scaffold:** datos mock. Botón "Reintentar" presente, deshabilitado (solo `manager`+, aunque en scaffold no hay distinción real de rol).

---

### Vista 4 — Cobros pendientes

**Filtro:**
```
paymentStatus = 'unpaid'
AND lastSyncStatus = 'not_sent'
```

> En fase 1, esta bandeja contendrá principalmente pedidos con `channel: 'qr_order'` y `paymentMode: 'cashier'`. El filtro no excluye otros canales — se usa como está para no acoplar la vista a un canal específico.

**Regla crítica:** estos pedidos NO existen en Last, NO están en cocina, NO están en el TPV de Last. Existen únicamente en el backend propio. **Nunca deben aparecer en Pedidos activos.** Ver `docs/domain/order-lifecycle.md` §6, §Reglas de UI regla 7.

**Qué muestra:** `pin4`, `customer.name`, `tableName`, items del pedido (para verificar antes de cobrar), `expiresAt` con cuenta atrás. Si ya expiró: badge "Expirado" — el pedido no puede cobrarse.

**Qué NO muestra:** `lastSyncStatus` (irrelevante para el cajero), ningún estado operativo de cocina (el pedido aún no tiene estado operativo real).

**Búsqueda:**

| Método | Descripción | Prioridad |
|---|---|---|
| `pin4` | 4 dígitos numéricos — método principal | 1 |
| Código de rescate | Código alfanumérico — método secundario | 2 |
| Nombre del cliente | Solo para verificación tras localizar por pin4/código — nunca como búsqueda principal | — |

Endpoint: `GET /order-sessions/recovery/{tokenOrCode}`. Ver `docs/contracts/order-api.md` §Endpoints internos recomendados.

**Acción principal — Confirmar cobro:**

| Acción | Endpoint | Rol mínimo |
|---|---|---|
| Confirmar cobro | `POST /order-sessions/{id}/confirm-payment` | `staff` |

Body: `{ paymentMethod: 'cash', idempotencyKey: string, actorType: 'staff' }`. El backend extrae `actorId` del JWT — el frontend no lo envía. Ver `docs/contracts/order-api.md` §`confirm-payment`.

**En scaffold:** formulario de búsqueda visible, sin llamada real. Botón "Confirmar cobro" presente, deshabilitado.

---

### Regla crítica de transición — cashier

Este es el punto más sensible del flujo de `orders`. La UI debe reflejar correctamente el estado antes y después de `confirm-payment`.

#### Antes de `confirm-payment`

| Campo | Valor |
|---|---|
| `paymentStatus` | `unpaid` |
| `lastSyncStatus` | `not_sent` |
| `operationalStatus` | `pending` |
| Existe en Last | No |
| Visible en cocina | No |
| Visible en TPV de Last | No |
| Bandeja en `orders` | **Cobros pendientes** |
| Acciones operativas disponibles | Ninguna |

#### Después de `confirm-payment`

| Resultado de sync con Last | `paymentStatus` | `lastSyncStatus` | Bandeja en `orders` | Siguiente acción |
|---|---|---|---|---|
| Last acepta el tab | `paid` | `sent` | **Pedidos activos** (`operationalStatus: 'pending'`) | Aceptar pedido para operación normal |
| Last falla | `paid` | `sync_failed` | **Incidencias** | Reintentar sync (`manager`+) |

**Invariantes irrompibles:**
1. Si Last falla, `paymentStatus` **no se revierte** — el cobro es firme.
2. El pedido desaparece de Cobros pendientes en ambos casos (ya está `paid`).
3. Si Last OK, el pedido entra en flujo operativo normal desde `operationalStatus: 'pending'`.
4. `orders` debe hacer refresh forzado de las tres bandejas afectadas tras `confirm-payment`.
5. Un `confirm-payment` sobre sesión expirada (`expiresAt` pasado) devuelve `410 session_expired` — `orders` debe mostrar el error y no intentar cobrar.
6. Un segundo `confirm-payment` con el mismo `idempotencyKey` devuelve `200` idempotente si ya está `paid`. Con `idempotencyKey` distinto devuelve `409 session_already_paid`.

---

### Comportamiento de actualización de datos

| Condición | Intervalo |
|---|---|
| Pestaña visible | Polling cada **10 segundos** |
| Pestaña oculta (Page Visibility API) | Polling cada **60 segundos** |
| Tras acción crítica (aceptar, cambiar estado, cobrar, cancelar, reintentar) | Refresh forzado inmediato |
| Fallo de red | Backoff exponencial: 15s → 30s → 60s |

Endpoint: `GET /order-sessions?active=true&since={isoDateTime}&limit=100`. Ver §~~P2~~ Tiempo real.

Botón de refresh manual siempre visible en todas las vistas.

**En scaffold:** datos estáticos. Polling ausente. Refresh manual recarga datos mock.

---

### Relación con `kiosk-web`

Ambas apps comparten el mismo backend y los mismos endpoints de rescate y cobro. No hay doble sistema.

| Operación | `orders` | `kiosk-web` |
|---|---|---|
| Buscar por `pin4` | `GET /order-sessions/recovery/{code}` directo | Mismo endpoint vía proxy `local-server` |
| Confirmar cobro | `POST /order-sessions/{id}/confirm-payment` con JWT staff (`actorType: 'staff'`) | Mismo endpoint con `actorType: 'system'` via `local-server` y `PUBLIC_API_SERVICE_TOKEN` |
| Crear tab en Last | ❌ No — efecto del backend tras `confirm-payment` | ❌ No — ídem |
| Ver bandejas | ✅ Todas las vistas | ❌ Solo el flujo de rescate |

La idempotencia por `idempotencyKey` garantiza que si `kiosk-web` y `orders` intentan cobrar el mismo pedido, solo uno tiene efecto. El segundo recibe `200` (mismo key) o `409` (key distinto).

---

### Roles y permisos en `orders`

> Matriz completa de permisos en `docs/auth/auth-model.md` §4. Esta tabla resume solo lo relevante para las vistas de `orders`.

| Acción | `staff` | `kitchen` | `manager` | `admin` |
|---|:---:|:---:|:---:|:---:|
| Ver Pedidos activos | ✅ | ✅ (sin importes) | ✅ | ✅ |
| Ver Cobros pendientes | ✅ | ❌ | ✅ | ✅ |
| Ver Incidencias | ❌ | ❌ | ✅ | ✅ |
| Aceptar pedido (`pending → accepted`) | ✅ | ❌ | ✅ | ✅ |
| `accepted → preparing` | ❌ | ✅ | ✅ | ✅ |
| `preparing → ready` | ❌ | ✅ | ✅ | ✅ |
| `ready → delivered` | ❌ | ❌ | ✅ | ✅ |
| Asignar tiempo estimado | ✅ | ❌ | ✅ | ✅ |
| Buscar y confirmar cobro cashier | ✅ | ❌ | ✅ | ✅ |
| Cancelar pedido | ❌ | ❌ | ✅ | ✅ |
| Reintentar sync con Last | ❌ | ❌ | ✅ | ✅ |
| Ver error técnico de sync | ❌ | ❌ | ✅ | ✅ |
| Reembolsar pedido | ❌ | ❌ | Pendiente decisión | ✅ |

El backend valida el rol en cada endpoint. La UI puede ocultar botones por UX, pero no es la frontera de seguridad.

---

### Reglas de una sola verdad

1. **`orders` nunca crea `OrderSession`** — solo visualiza y actúa sobre las existentes.
2. **`orders` nunca llama a Last directamente** — solo el backend propio llama a `POST /tabs`.
3. **`orders` nunca modifica `channel` ni `paymentMode`** — son inmutables desde la creación de la sesión.
4. **`orders` nunca crea un tab en Last** — el tab es un efecto del backend tras `confirm-payment`.
5. **`orders` no es owner de `paymentStatus`** — lo controlan Stripe (webhook) y `confirm-payment` en backend. `orders` solo muestra el estado.
6. **La fuente de verdad de `operationalStatus` es Last** para pedidos sincronizados. El backend mapea estados de Last al enum canónico.
7. **El rol del JWT determina qué acciones puede ejecutar el usuario** — el backend rechaza con `403` si el rol no alcanza. Ver `docs/auth/auth-model.md` §10.

---

### Scaffold → backend real: tabla de activación

Para cada elemento interactivo, el scaffold ya tiene la estructura; conectar el backend es reemplazar el stub por la llamada real.

| Elemento UI | En scaffold | Con backend real |
|---|---|---|
| Lista Pedidos activos | Mock estático | `GET /order-sessions?paymentStatus=paid&lastSyncStatus=sent&active=true&since=...` |
| Lista Cobros pendientes | Mock estático | `GET /order-sessions?paymentStatus=unpaid&lastSyncStatus=not_sent` |
| Lista Incidencias | Mock estático | `GET /order-sessions?paymentStatus=paid&lastSyncStatus=sync_failed` |
| Botón "Aceptar" | Visible, deshabilitado | `PATCH /order-sessions/{id}/status` `{ status: 'accepted' }` + refresh |
| Botón "Preparando" | Visible, deshabilitado | `PATCH /order-sessions/{id}/status` `{ status: 'preparing' }` + refresh |
| Botón "Listo" | Visible, deshabilitado | `PATCH /order-sessions/{id}/status` `{ status: 'ready' }` + refresh |
| Botón "Entregado" | Visible, deshabilitado (solo `manager`+) | `PATCH /order-sessions/{id}/status` `{ status: 'delivered' }` + refresh |
| Botón "Cancelar" | Visible, deshabilitado (solo `manager`+) | `POST /order-sessions/{id}/cancel` + diálogo confirmación + refresh |
| Campo búsqueda `pin4` | Visible, sin llamada real | `GET /order-sessions/recovery/{pin4}` → mostrar resultado |
| Botón "Confirmar cobro" | Visible, deshabilitado | `POST /order-sessions/{id}/confirm-payment` + `idempotencyKey` + refresh 3 bandejas |
| Botón "Reintentar sync" | Visible, deshabilitado (solo `manager`+) | `POST /order-sessions/{id}/send-to-last` + refresh |
| Polling automático | Ausente | Activar `GET /order-sessions?since=...` cada 10s + Page Visibility API |
| Login | Pantalla visible | Supabase Auth `signInWithPassword` → JWT → `Authorization: Bearer {jwt}` |

---

### Riesgos y TODOs pendientes

| Riesgo / pendiente | Impacto | Estado |
|---|---|---|
| Endpoint de tiempo estimado no definido en `order-api.md` | Acción "asignar tiempo" no activable | Pendiente — definir en `order-api.md` antes de conectar backend |
| ~~Endpoint de historial de eventos no definido~~ | ~~Vista de auditoría en Incidencias no activable~~ | Resuelto — `GET /order-sessions/{id}/events` definido en `order-api.md` |
| Parámetros de query de `GET /order-sessions` no especificados | Las tres bandejas dependen de filtros no formalizados | Pendiente — formalizar en `order-api.md` §Endpoints internos recomendados |
| Scaffold sin distinción real de roles | En scaffold todos ven todo — con backend el JWT determina acceso real | Aceptado para scaffold — corregir al conectar Supabase Auth |
| Vista Kitchen como vista separada vs tab con permisos reducidos | Afecta arquitectura de routing del frontend | Decisión abierta en `docs/auth/auth-model.md` §11 |
| Reembolso: rol `manager` pendiente de decisión | El botón de reembolso no puede habilitarse hasta decidir | Ver `docs/auth/auth-model.md` §11 |

---

### Estado del botón de checkout

| Entorno | Comportamiento |
|---|---|
| **Producción** | Botón bloqueado con mensaje claro al usuario. No se puede completar ningún pedido. |
| **Desarrollo** | Simulación demo explícita con pedidos marcados con prefijo `DEMO-`. No llama a backend real. No crea `OrderSession`. No envía a Last. |

La simulación de desarrollo **no debe** presentar una pantalla de confirmación que parezca una confirmación real. Debe indicar visualmente que es una demo.

---

### Pendientes para completar qr-order fase 1

En orden de dependencia:

1. `POST /order-sessions` — crear `OrderSession` real en backend
2. `POST /order-sessions/{id}/checkout/stripe` — crear Stripe Checkout Session
3. Redirección a Stripe y gestión de `success_url` / `cancel_url`
4. `POST /stripe/webhook` — procesar `checkout.session.completed` con firma verificada
5. Polling de confirmación en `qr-order` — `GET /order-sessions/{id}` hasta `paymentStatus: 'paid'`
6. Pantalla de confirmación real derivada de `OrderSession` del backend
7. Flujo cashier: crear sesión con `paymentMode: 'cashier'`, mostrar `pin4` / QR de rescate
8. Sync con Last desde backend tras pago confirmado

Los contratos de todos estos pasos están completos en `docs/contracts/`.
