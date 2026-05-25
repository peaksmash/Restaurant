# Preparation Times Domain

## Objetivo

Definir el modelo canónico de tiempos de preparación para `orders`, `qr-order`, backend propio y sincronización con Last.app.

Este documento es normativo. Ningún campo de tiempos debe implementarse con otro nombre sin actualizar esta especificación.

---

## Principios

1. El dominio de tiempos debe existir aunque la integración final con Last no esté cerrada.
2. La app `orders` debe poder operar tiempos internamente sin depender del endpoint final de Last.
3. El tiempo sugerido, el tiempo confirmado y la hora estimada son conceptos distintos.
4. `pickupTime` es un detalle de integración con Last, no el modelo interno completo.
5. Toda sincronización de tiempos debe ser trazable y reintentable.

---

## Conceptos canónicos

| Concepto | Campo | Descripción |
|---|---|---|
| Modo de tiempo | `preparationTimeMode` | Define cómo se ha determinado el tiempo |
| Tiempo sugerido | `suggestedPreparationMinutes` | Minutos propuestos por el sistema |
| Tiempo confirmado | `confirmedPreparationMinutes` | Minutos aceptados o modificados por el operador |
| Hora estimada interna | `estimatedReadyAt` | Fecha/hora calculada a partir del tiempo confirmado |
| Hora enviada a Last | `pickupTimeSyncedToLast` | Valor sincronizado finalmente con Last |
| Estado de sync de tiempo | `pickupTimeSyncStatus` | Estado de sincronización del tiempo con Last |

---

## Campos técnicos

| Campo | Tipo | Obligatorio | Owner | Descripción |
|---|---|---:|---|---|
| `preparationTimeMode` | `enum` | No | Backend / `orders` | Modo de cálculo o selección |
| `suggestedPreparationMinutes` | `number` / `nullable` | No | Backend | Tiempo sugerido por reglas |
| `confirmedPreparationMinutes` | `number` / `nullable` | No | Operador / Backend | Tiempo final confirmado |
| `estimatedReadyAt` | `datetime` / `nullable` | No | Backend | Hora estimada interna |
| `pickupTimeSyncedToLast` | `datetime` / `nullable` | No | Backend | Hora realmente enviada a Last |
| `pickupTimeSyncStatus` | `enum` / `nullable` | No | Backend | Estado de sincronización |

---

## Valores de `preparationTimeMode`

| Valor | Descripción | Caso típico |
|---|---|---|
| `auto` | Tiempo calculado por reglas del sistema | Canal, carga, franja horaria |
| `manual` | Tiempo elegido manualmente por operador | Operador selecciona 20 min |
| `inherited` | Tiempo heredado de Last u otra integración | Pedido externo ya trae hora |

---

## Valores de `pickupTimeSyncStatus`

> Ver type `PickupTimeSyncStatus` en `contracts/order-api.md` §Contrato base OrderSession.

---

## Regla de cálculo principal

Cuando el operador confirma un tiempo:

```txt
estimatedReadyAt = createdAt + confirmedPreparationMinutes
```

Si el pedido ya fue aceptado más tarde que `createdAt`, el producto puede decidir usar `acceptedAt` como base. Esta decisión debe documentarse antes de implementarse.

Recomendación inicial:

```txt
estimatedReadyAt = createdAt + confirmedPreparationMinutes
```

Motivo: es más simple, estable y suficiente para la primera versión.

---

## Tiempos rápidos iniciales

La UI de `orders` debe ofrecer botones rápidos:

| Valor | Uso |
|---:|---|
| `10` | Pedido rápido |
| `15` | Tiempo estándar corto |
| `20` | Tiempo estándar alto |
| `25` | Pico o preparación lenta |

Estos valores deben configurarse, no hardcodearse en componentes de UI.

---

## Tiempo por defecto por canal

Configuración inicial recomendada:

| Canal | Tiempo por defecto |
|---|---:|
| `qr_order` | `15` |
| `kiosk` | `10` |
| `pos` | `15` |
| `uber` | `20` |
| `glovo` | `20` |
| `deliveroo` | `20` |
| `just_eat` | `20` |
| `manual` | `15` |

---

## Configuración futura por carga o franja

No implementar en primera fase salvo necesidad real, pero dejar el dominio preparado.

| Dimensión | Ejemplos |
|---|---|
| Carga de cocina | `normal`, `busy`, `saturated` |
| Franja horaria | `morning`, `lunch_peak`, `afternoon`, `dinner_peak`, `late_night` |
| Canal | `qr_order`, `kiosk`, `uber`, `glovo` |
| Tipo de pedido | `dine_in`, `takeaway`, `delivery` |

---

## Flujo recomendado en `orders`

| Paso | Acción | Resultado |
|---:|---|---|
| 1 | Pedido entra en `orders` | Se calcula `suggestedPreparationMinutes` |
| 2 | Operador revisa pedido | UI muestra botones rápidos |
| 3 | Operador confirma tiempo | Se guarda `confirmedPreparationMinutes` |
| 4 | Backend calcula hora | Se guarda `estimatedReadyAt` |
| 5 | Backend intenta sincronizar Last | Se actualiza `pickupTimeSyncedToLast` y `pickupTimeSyncStatus` |

---

## Sincronización con Last

### Escenario A: existe endpoint o campo claro para enviar tiempo

Se enviará la hora estimada como `pickupTime`.

| Campo interno | Campo Last |
|---|---|
| `estimatedReadyAt` | `pickupTime` |

Si Last confirma correctamente:

| Campo | Valor |
|---|---|
| `pickupTimeSyncedToLast` | valor enviado |
| `pickupTimeSyncStatus` | `synced` |

### Escenario B: no existe endpoint claro o no encaja

La app `orders` debe seguir funcionando con tiempos internos.

| Campo | Valor |
|---|---|
| `estimatedReadyAt` | Se mantiene interno |
| `pickupTimeSyncedToLast` | `null` |
| `pickupTimeSyncStatus` | `pending` o `failed`, según caso |

La capa de sincronización se adaptará después sin cambiar el dominio interno.

---

## Eventos de auditoría de tiempos

> Todos los eventos de auditoría están centralizados en `domain/order-lifecycle.md` §Eventos de auditoría recomendados.

---

## Ejemplo de pedido con tiempos

```json
{
  "orderSessionId": "ord_123",
  "channel": "qr_order",
  "createdAt": "2026-05-15T13:20:00+02:00",
  "preparationTimeMode": "manual",
  "suggestedPreparationMinutes": 15,
  "confirmedPreparationMinutes": 20,
  "estimatedReadyAt": "2026-05-15T13:40:00+02:00",
  "pickupTimeSyncedToLast": "2026-05-15T13:40:00+02:00",
  "pickupTimeSyncStatus": "synced"
}
```

---

## Nomenclatura canónica

El campo canónico para los minutos finales confirmados por el operador es `confirmedPreparationMinutes`.

El documento de arquitectura `qr-order-orders-architecture.md` usó en algún punto `estimatedPreparationMinutes` — ese nombre es incorrecto y no debe implementarse. El campo correcto es `confirmedPreparationMinutes`.

---

## Visibilidad de `estimatedReadyAt` en qr-order

En la primera fase, `estimatedReadyAt` se incluye como campo informativo en la respuesta de confirmación de pago si ya fue calculado. No se actualiza en tiempo real en el cliente.

Si el operador cambia el tiempo después de que el cliente recibió la confirmación, el cliente **no recibe la actualización** en esta fase. Esta limitación es aceptable para la versión inicial.

En fases posteriores, si se implementa SSE o WebSocket, se puede enviar el valor actualizado al cliente.

---

## Reglas de implementación

1. La UI no debe calcular definitivamente `estimatedReadyAt`; debe hacerlo el backend.
2. La UI puede mostrar una previsualización, pero el backend es la fuente final.
3. `confirmedPreparationMinutes` debe persistirse siempre que el operador confirme un tiempo.
4. `estimatedReadyAt` debe recalcularse si cambia `confirmedPreparationMinutes`.
5. No se debe enviar `suggestedPreparationMinutes` a Last como si fuera hora final.
6. `pickupTimeSyncedToLast` solo debe guardar valores realmente enviados.
7. Un fallo de sincronización de tiempo no debe bloquear la operación interna del pedido.
8. Los cambios manuales de tiempo deben generar evento de auditoría.
9. Los valores rápidos de tiempo (10/15/20/25 min) deben venir de configuración, no hardcodeados en componentes de UI. El endpoint que los sirve debe estar definido antes de implementar el selector.
