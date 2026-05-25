# Auth Model — orders fase 1

## Objetivo

Definir el modelo de autenticación, roles y permisos para la app `orders` (`ops.peaksmash.com`).

Este documento es normativo. Ninguna ruta protegida, acción operativa, permiso por rol o mecanismo de sesión debe implementarse si no está definido aquí o referenciado desde este documento.

---

## 1. Propósito

### Qué protege este modelo

- **Acceso a `orders`**: la app de operación interna solo puede usarse por personal autenticado del restaurante.
- **Acciones operativas**: aceptar pedidos, cambiar estado, marcar listo/entregado son acciones que afectan directamente la cocina y la sala. Solo personal autorizado puede ejecutarlas.
- **Cobros cashier**: confirmar que un cliente ha pagado en efectivo implica un cambio de `paymentStatus` irreversible y el envío a Last. Requiere actorId auditado.
- **Cancelaciones**: cancelar un pedido es una acción con consecuencias operativas y potencialmente económicas. Requiere confirmación explícita y rol suficiente.
- **Reintentos de sync con Last**: reenviar un pedido a Last puede crear tabs duplicados si no está correctamente controlado. Solo roles con capacidad de diagnóstico deben poder hacerlo.
- **Visibilidad de datos sensibles**: datos de cliente (`CustomerInfo`), importes, historial de auditoría (`OrderSessionEvent[]`) y errores técnicos de sync no deben ser visibles sin acceso autenticado.

### Qué queda fuera de este modelo

- **`qr-order` público**: no requiere login de usuario. La validación de acceso se hace vía `qrToken` en cada request. Ver `docs/contracts/order-api.md` §Reglas de implementación.
- **Stripe webhook**: autenticado mediante verificación de firma (`Stripe-Signature` header). Ver `docs/contracts/order-api.md` §Reglas de implementación, regla 11.
- **Last API**: autenticado mediante `Authorization: Bearer {token}` gestionado por el backend. Ver `docs/contracts/last-api.md` §Configuración del cliente.
- **Gestión avanzada de usuarios**: creación en lote, panel de gestión de usuarios en `orders`, multi-local con roles distintos por `locationId` — aplazado a fase posterior. Recovery y revocación básicos sí están cubiertos en fase 1 vía Supabase. Ver §8 y §11.
- **Permisos de configuración de catálogo, QR y mesas**: fuera del scope de `orders` fase 1.

---

## 2. Apps afectadas

| App | Requiere auth | Motivo | Fase |
|---|---|---|---|
| `qr-order` | No (usuario) | App pública para cliente final. Acceso controlado por `qrToken` de mesa, no por login. | Fase 1 |
| `orders` | **Sí** | App de operación interna. Acceso restringido a staff del restaurante. | Fase 1 |
| `kiosk-web` | Parcial (pendiente) | Flujos públicos de pago no requieren login; posibles flujos operativos (rescate, cobro) sí pueden requerirlo. Fuera del scope de este documento. | Fase posterior |
| `admin-web` | **Sí** | Configuración de catálogo, mesas, promociones. Modelo de auth propio — fuera del scope de este documento. | Fase posterior |
| `local-server` / backend local | No (red local) | Acceso restringido a red local del restaurante. Sin auth por usuario en fase 1. | Fase 1 |
| Backend público (`api.peaksmash.com`) | Por endpoint | Endpoints de `qr-order` usan `qrToken`. Endpoints de `orders` requieren token de sesión de staff. Endpoints de webhook usan firma Stripe. | Fase 1 |

---

## 3. Roles canónicos fase 1

### `staff`

**Descripción:** Personal de sala, barra o caja. Gestiona el flujo básico de pedidos y cobra en efectivo.

**Uso típico:** Caja de un restaurante. Tablet en sala para ver estado de pedidos.

**Acciones permitidas:**
- Ver lista de pedidos activos
- Ver detalle de pedido (incluidos ítems, notas, importe, estado)
- Aceptar pedido (`pending → accepted`)
- Rescatar pedido cashier por `pin4` o código
- Confirmar cobro en efectivo (confirmar pago cashier)
- Cambiar tiempo de preparación

**Acciones prohibidas:**
- Cancelar pedidos
- Reembolsar pedidos
- Reintentar sync con Last
- Ver errores técnicos de sync detallados
- Ver historial completo de eventos de auditoría
- Cambiar configuración
- Gestionar usuarios

**Riesgo operativo si se usa mal:** Un `staff` con acceso no controlado podría confirmar cobros de pedidos que el cliente no ha pagado realmente. El actorId auditado en `payment_succeeded` mitiga el impacto.

---

### `kitchen`

**Descripción:** Personal de cocina. Gestiona únicamente el estado de preparación. No ve datos de cobro ni datos de cliente más allá del nombre y la mesa.

**Uso típico:** Pantalla o tablet en cocina — vista de pedidos en preparación.

**Acciones permitidas:**
- Ver lista de pedidos en `accepted` y `preparing`
- Ver detalle de pedido (ítems, notas, mesa — sin importe ni datos de pago)
- Cambiar estado: `accepted → preparing` y `preparing → ready`

**Acciones prohibidas:**
- Aceptar pedido (transición `pending → accepted` — reservada a `staff` y `manager`)
- Cambiar estado a `delivered` o `cancelled`
- Ver importe del pedido ni datos del cliente más allá de nombre y mesa
- Confirmar cobros
- Cancelar, reembolsar, reintentar sync
- Ver incidencias de Last ni auditoría

**Riesgo operativo si se usa mal:** Cocina podría marcar `ready` pedidos no terminados si el dispositivo está compartido con roles mayores. La separación de vista restringe el daño.

---

### `manager`

**Descripción:** Responsable de turno o encargado de sala. Gestiona excepciones operativas, cancelaciones e incidencias de sincronización con Last.

**Uso típico:** Encargado de turno con tablet. Resuelve incidencias en hora punta.

**Acciones permitidas:**
- Todo lo de `staff` y `kitchen`
- Cambiar estado a `delivered`
- Cancelar pedido (requiere confirmación explícita en UI)
- Reintentar sync con Last
- Ver errores técnicos de sync
- Ver historial completo de eventos de auditoría (`OrderSessionEvent[]`)
- Ver incidencias `lastSyncStatus: 'sync_failed'`

**Acciones prohibidas:**
- Reembolsar pedidos (pendiente de decisión — ver §11)
- Cambiar configuración del sistema
- Gestionar usuarios

**Riesgo operativo si se usa mal:** Un `manager` podría cancelar pedidos ya pagados sin iniciar reembolso. La auditoría obligatoria y la confirmación explícita en UI mitigan el impacto.

---

### `admin`

**Descripción:** Administrador del sistema. Acceso total a `orders` en fase 1. En fases posteriores gestionará usuarios, configuración y permisos.

**Uso típico:** Propietario del restaurante o responsable técnico. No opera pedidos en el día a día.

**Acciones permitidas:**
- Todo lo anterior
- Reembolsar pedidos
- Cambiar configuración (fase posterior)
- Gestionar usuarios (fase posterior)

**Acciones prohibidas:**
- Ninguna dentro del scope de `orders` fase 1.

**Riesgo operativo si se usa mal:** Acceso total — credenciales de `admin` deben protegerse especialmente. No deben compartirse entre empleados.

---

## 4. Matriz de permisos

| Acción | `staff` | `kitchen` | `manager` | `admin` |
|---|:---:|:---:|:---:|:---:|
| Ver pedidos activos | Sí | Sí (solo `accepted`/`preparing`) | Sí | Sí |
| Ver detalle de pedido | Sí (completo) | Sí (sin importe ni datos de pago) | Sí (completo) | Sí (completo) |
| Aceptar pedido (`pending → accepted`) | Sí | No | Sí | Sí |
| Cambiar a `preparing` | No | Sí | Sí | Sí |
| Cambiar a `ready` | No | Sí | Sí | Sí |
| Cambiar a `delivered` | No | No | Sí | Sí |
| Cambiar tiempo de preparación | Sí | No | Sí | Sí |
| Rescatar pedido por PIN/QR | Sí | No | Sí | Sí |
| Confirmar cobro cashier | Sí | No | Sí | Sí |
| Cancelar pedido | No | No | Sí | Sí |
| Reembolsar pedido | No | No | Pendiente | Sí |
| Reintentar sync con Last | No | No | Sí | Sí |
| Ver errores técnicos de sync | No | No | Sí | Sí |
| Ver eventos de auditoría | No | No | Sí | Sí |
| Cambiar configuración | No | No | No | Sí (fase posterior) |
| Gestionar usuarios | No | No | No | Sí (fase posterior) |

> **`Pendiente`** en reembolso de `manager`: se aplaza la decisión a cuando se implemente el flujo de reembolso. Ver §11.

---

## 5. Recomendación de permisos fase 1

La matriz del §4 es la recomendación operativa mínima. Justificación por decisión no obvia:

**`staff` puede aceptar pedidos (no solo cocina).**
En un restaurante pequeño, sala y caja gestionan el primer estado del pedido. Reservar `accepted` solo a `manager` ralentizaría la operación en turnos sin encargado presente.

**`kitchen` no puede aceptar ni entregar.**
`pending → accepted` implica visibilidad y responsabilidad sobre el pedido completo. `delivered` requiere coordinación con sala. Cocina opera dentro del ciclo de preparación, no antes ni después.

**`staff` NO puede cancelar.**
La cancelación de un pedido pagado tiene consecuencias económicas. Un `staff` podría cancelar por error un pedido cobrado sin saber que necesita reembolso. Reservar a `manager` es la separación mínima razonable.

**`manager` puede o no reembolsar (pendiente).**
Si el `manager` puede reembolsar, aumenta la agilidad operativa pero el riesgo de reembolsos no autorizados. Si solo `admin` puede reembolsar, es más seguro pero crea dependencia del propietario para resolver incidencias en tiempo real. Decisión aplazada a cuando se implemente el flujo de reembolso.

**`kitchen` ve detalle sin importe.**
El importe del pedido es irrelevante para cocina y puede causar fricciones si los cocineros ven precios. La vista de cocina debe filtrar campos de `paymentStatus`, `total`, `CustomerInfo.phoneNumber` y `CustomerInfo.email`.

---

## 6. Modelo de sesión — análisis de opciones

| Opción | Ventajas | Riesgos | Complejidad | Encaje fase 1 |
|---|---|---|---|---|
| **JWT propio** (firmado, expiración corta, refresh token) | Sin dependencia externa · control total · estándar · compatible con cualquier frontend | Implementar correctamente refresh es complejo · revocación require lista negra o tabla de sesiones | Media | No en fase 1 — viable pero más costoso de arrancar |
| **Cookie httpOnly con sesión en backend** | Token nunca accesible desde JS · protección XSS nativa · revocación simple (eliminar sesión) | Problemas CORS si frontend y backend en dominios distintos · requiere gestión de sesiones en BD | Media-baja | No en fase 1 — alternativa futura si se quiere independencia total |
| **PIN local por dispositivo** | Sin servidor de auth · rápido para tablets de cocina | Sin identidad real de usuario · sin auditoría individual · imposible revocar sin acceder al dispositivo | Baja | No — no auditado |
| **Google OAuth** | Sin gestión de contraseñas · revocación vía Google · UX conocida | Depende de cuenta Google · require acceso a internet siempre · no todos los restaurantes usan Google Workspace | Baja (usando SDK) | Opcional — puede añadirse como proveedor OAuth en Supabase sin cambiar el contrato |
| **Auth externo — Supabase Auth** | Gestión de usuarios out-of-the-box · recovery de contraseña · JWT verificable · revocación real · tier gratuito | Dependencia de tercero · si Supabase cambia pricing afecta al proyecto | Baja-media | **DECIDIDO para fase 1** |
| **Integración con Last** | Un sistema de identidad unificado con el POS | Last no expone un OAuth propio claro · roles de Last no coinciden con roles de `orders` · acoplamiento peligroso | Alta | No |

---

## 7. Decisión auth fase 1

**DECIDIDO 2026-05-16: Supabase Auth con JWT.**

### Justificación

- **Sin gestión de contraseñas propia**: Supabase Auth gestiona hashing, recovery y tokens. El backend no almacena contraseñas.
- **JWT verificable en backend**: el backend verifica el JWT con la clave pública de Supabase en cada request. El rol se resuelve a partir del JWT — nunca del body enviado por el frontend.
- **Revocación real**: Supabase permite invalidar sesiones de un usuario. Útil cuando un empleado sale.
- **Recovery de contraseña nativo**: email de recovery gestionado por Supabase. Sin implementación propia.
- **Coste fase 1**: el tier gratuito de Supabase es suficiente para un restaurante.
- **Sin lock-in severo**: si más adelante se prefiere sesión propia (cookie httpOnly), el contrato de JWT del backend puede adaptarse sin cambiar los endpoints de `orders`.

### Resolución de rol

El rol canónico (`staff`, `kitchen`, `manager`, `admin`) se resuelve en el backend mediante una de estas dos estrategias:

| Estrategia | Descripción | Cuándo usar |
|---|---|---|
| **Claim en JWT de Supabase** | El rol se almacena en `app_metadata` del usuario en Supabase. Supabase incluye el claim en el JWT. El backend lo lee directamente. | Preferido en fase 1 — sin tabla extra. |
| **Tabla de perfiles en backend** | Supabase emite el JWT con el `userId`. El backend consulta una tabla propia `user_profiles(userId, role, locationId?)` para resolver el rol. | Necesario si se implementa multi-local con roles distintos por `locationId` en fases futuras. |

En fase 1 se usa **claim en JWT** (`app_metadata.role`). La tabla de perfiles queda como extensión futura sin bloquear la arquitectura actual.

**Regla invariante:** el backend extrae `actorId`, `email` y `role` del JWT verificado. El frontend **nunca** envía `actorId` en el body para acciones críticas. El backend rechaza cualquier request sin JWT válido o con rol insuficiente.

### Flujo de sesión

1. Staff introduce email + contraseña en `orders`.
2. `orders` llama a Supabase Auth → recibe `access_token` (JWT, 15 min) + `refresh_token` (gestionado por Supabase SDK).
3. `orders` almacena `access_token` en memoria de la app (nunca en localStorage).
4. Supabase SDK gestiona el `refresh_token` y la renovación automática del `access_token` — no requiere gestión manual en la app.
5. Cada llamada al backend incluye `Authorization: Bearer {access_token}`.
6. El backend verifica el JWT con la clave pública de Supabase, extrae `userId` + `role`, y aplica la matriz de permisos.
7. El backend incluye el `userId` como `actorId` en todos los eventos de auditoría de esa acción.

> Supabase Auth soporta Google OAuth como proveedor adicional sin cambiar el contrato de JWT del backend. Se puede añadir en fases futuras si el equipo usa Google Workspace.

### Alternativa futura (no fase 1)

**Cookie httpOnly con sesión propia** es la alternativa si se quiere independencia total de Supabase. Requiere tabla de sesiones, hashing de contraseñas y recovery propio. Se documenta aquí como opción conocida — no se implementa hasta que haya una razón justificada para migrar.

---

## 8. Sesiones y seguridad

### Duración de sesión fase 1

| Token | Duración | Decisión |
|---|---|---|
| `access_token` (JWT de Supabase) | 15 minutos (por defecto Supabase) | **Fija en fase 1** — Supabase SDK renueva automáticamente |
| Sesión activa (refresh gestionado por Supabase SDK) | 8 horas desde el último login | **Fija en fase 1** — equivale a un turno de restaurante |
| "Recordar dispositivo" / sesión extendida | — | **Fuera de fase 1.** Si se necesita en el futuro, lo configura `admin` vía Supabase settings. |

### Logout

- El logout llama a `supabase.auth.signOut()`, que invalida la sesión en el servidor de Supabase.
- El `access_token` en memoria de la app se descarta.
- El backend propio no necesita gestión adicional — el JWT revocado será rechazado en la siguiente verificación.

### Expiración por inactividad

- Recomendado: 30 minutos sin actividad en la UI → logout automático o solicitud de reautenticación.
- La app detecta inactividad mediante un timer de 30 minutos que se reinicia con cada interacción del usuario.
- En tablets de cocina con vista activa, la expiración por inactividad puede extenderse en una fase posterior si se decide, pero queda fuera de fase 1.

### Almacenamiento del token

| Token | Almacenamiento | Motivo |
|---|---|---|
| `access_token` | Memoria de la app (estado de React/contexto) — nunca localStorage | Un XSS en localStorage extrae el token de forma trivial |
| `refresh_token` | Gestionado por Supabase SDK (cookie o storage interno según configuración del SDK) | No se gestiona manualmente — Supabase SDK lo abstrae |

> El Supabase JS SDK gestiona el almacenamiento del `refresh_token` internamente. En fase 1 no se sobreescribe esa configuración. Si en el futuro se necesita `cookie httpOnly` explícita, se configura en el cliente de Supabase o se migra a sesión propia.

### Protección de rutas

- Todas las rutas de `orders` deben verificar autenticación en el backend antes de devolver datos.
- La UI puede redirigir al login si no hay token activo, pero el backend es la fuente autoritativa — la UI nunca es suficiente como control de acceso.
- Las rutas del backend que corresponden a acciones de `orders` deben verificar rol en la validación, no solo autenticación.

### Si la sesión expira durante una acción

- Si el `access_token` expira durante una llamada, Supabase SDK intenta renovarlo automáticamente con el `refresh_token`.
- Si la renovación falla (sesión revocada o expirada), el backend devuelve `401 unauthorized`.
- La app redirige al login con el mensaje: "Tu sesión ha expirado. Vuelve a entrar."
- La acción en curso se descarta — no se reintenta automáticamente tras login para evitar acciones dobles.

### Primer admin y creación de usuarios

**DECIDIDO 2026-05-16.**

- No hay registro público abierto en `orders`. No existe `/register` accesible sin autenticación de admin.
- El primer `admin` se crea mediante proceso manual controlado:
  1. Técnico crea el usuario en Supabase Dashboard (email + contraseña temporal).
  2. Técnico asigna `app_metadata.role = 'admin'` en Supabase Dashboard.
  3. El admin hace login en `orders` y cambia su contraseña.
- El resto de usuarios (`staff`, `kitchen`, `manager`) los crea el `admin` desde Supabase Dashboard o, en fases posteriores, desde un panel de gestión de usuarios en `orders`.

### Recuperación y revocación

**DECIDIDO 2026-05-16.**

- **Recovery de contraseña**: `supabase.auth.resetPasswordForEmail()`. El empleado recibe email de Supabase con enlace de reset. Sin implementación propia.
- **Revocación**: el `admin` elimina o desactiva el usuario en Supabase Dashboard. El JWT activo puede durar hasta 15 minutos más (ventana del `access_token`). Para revocación inmediata en Supabase se puede invalidar la sesión manualmente desde el Dashboard.
- Si existe tabla de perfiles en backend: desactivar el perfil del usuario también bloquea el acceso aunque el JWT no haya expirado aún.

### Multi-local

**DECIDIDO 2026-05-16: fuera de fase 1.**

- Fase 1 asume un contexto operativo único por instalación (`locationId` fijo por deploy de `orders`).
- El modelo de roles no implementa permisos por `locationId` en fase 1.
- La arquitectura deja hueco: si en el futuro se añade tabla de perfiles con `locationId`, el contrato de endpoints no cambia — solo se amplía la validación en el middleware de backend.

---

## 9. Auditoría

Los eventos de auditoría específicos de operación de pedidos están centralizados en `docs/domain/order-lifecycle.md` §Eventos de auditoría recomendados.

Los eventos específicos de autenticación y gestión de acceso que deben registrarse en el sistema propio son:

| Evento | `actorType` | `actorId` | Cuándo se emite |
|---|---|---|---|
| `login_success` | `staff` | ID del usuario | Login correcto en `orders` |
| `login_failed` | `system` | — (IP o dispositivo si disponible) | Intento de login fallido |
| `logout` | `staff` | ID del usuario | Cierre de sesión explícito o por expiración |
| `session_expired` | `system` | ID del usuario si disponible | Sesión expirada sin logout explícito |
| `user_role_changed` | `admin` | ID del admin que ejecuta el cambio | Cambio de rol de un usuario — fase posterior |
| `configuration_changed` | `admin` | ID del admin | Cambio de configuración del sistema — fase posterior |

Los siguientes eventos ya están definidos en `docs/domain/order-lifecycle.md` y **no se duplican aquí**; `orders` debe registrarlos con `actorType: 'staff'` y el `actorId` del usuario autenticado:

- `payment_succeeded` — al confirmar cobro cashier
- `order_cancelled` — al cancelar un pedido desde `orders`
- `operational_status_changed` — al cambiar estado operativo
- `preparation_time_confirmed` — al confirmar tiempo de preparación
- `last_sync_started` / `last_sync_succeeded` / `last_sync_failed` — al reintentar sync con Last
- `order_refunded` — al ejecutar reembolso (fase posterior)

> El campo `actorId` debe propagarse desde el token de sesión al backend en toda acción crítica. El backend no debe confiar en el `actorId` enviado por el frontend — debe extraerlo del JWT verificado.

---

## 10. Reglas de seguridad mínimas

1. **No exponer errores técnicos a clientes de `qr-order`**: los errores de `lastSyncStatus: 'sync_failed'`, stacktraces o IDs internos nunca deben llegar a la respuesta del cliente público. `qr-order` recibe solo el código de error canónico (`ApiError.code`). Ver `docs/domain/order-lifecycle.md` §Reglas de UI, regla 5.

2. **No almacenar `access_token` en localStorage**: usar memoria de la app. El `refresh_token` en localStorage es una excepción aceptada solo en tablets de restaurante bajo red controlada, con duración máxima de un turno (8h) salvo "recordar dispositivo" explícito.

3. **Operaciones críticas requieren rol suficiente verificado en backend**: la UI puede ocultar botones, pero el backend valida el rol en cada endpoint. Una UI manipulada no debe poder ejecutar una acción prohibida.

4. **Cobro cashier requiere `actorId` auditado**: `POST /order-sessions/{id}/confirm-payment` extrae el `actorId` del JWT (cuando el consumidor es `orders`, rol mínimo `staff`) o acepta `actorType: 'system'` con `actorId: null` cuando el consumidor es `local-server` con `PUBLIC_API_SERVICE_TOKEN`. El `actorId` se persiste en el evento `payment_succeeded`. Ver `docs/contracts/order-api.md` §`confirm-payment`.

5. **Cancelación requiere confirmación explícita**: la UI debe mostrar un diálogo de confirmación antes de ejecutar `POST /order-sessions/{id}/cancel`. El backend también puede exigir un campo `{ reason?: string }` en el body para facilitar la auditoría, aunque no es obligatorio en fase 1.

6. **Reintento de sync requiere rol `manager` o `admin`**: `POST /order-sessions/{id}/send-to-last` desde `orders` debe rechazarse con `403 forbidden` si el token del solicitante corresponde a `staff` o `kitchen`.

7. **Cambios de permisos requieren `admin`**: ningún rol puede elevar sus propios permisos ni los de otro usuario sin ser `admin`. Aplica en fase posterior cuando exista gestión de usuarios.

8. **Toda acción crítica debe auditarse con `actorType` y `actorId`**: aceptar, cobrar, cancelar, reintentar sync — ninguna de estas acciones puede ejecutarse sin registro en `OrderSessionEvent`. El backend rechaza si no hay usuario autenticado identificable.

9. **El backend es la frontera de autorización**: la lógica de permisos no vive en el frontend. La UI muestra u oculta acciones por UX, no por seguridad.

10. **Endpoints de `orders` deben requerir token de sesión válido**: ningún endpoint de `PATCH /order-sessions/{id}/status`, `POST /order-sessions/{id}/cancel`, `POST /order-sessions/{id}/send-to-last` ni `POST /order-sessions/{id}/confirm-payment` puede responder sin token verificado. El backend devuelve `401` si el token está ausente o expirado, y `403` si el rol no tiene permiso.

---

## 11. Decisiones pendientes

Las siguientes decisiones están **cerradas** en fase 1 y no deben reabrirse sin actualizar este documento:

| Decisión | Estado | Referencia |
|---|---|---|
| Mecanismo de auth | **DECIDIDO:** Supabase Auth con JWT | §7 |
| Almacenamiento de `refresh_token` | **DECIDIDO:** gestionado por Supabase SDK, sin intervención manual | §8 |
| Duración de sesión | **DECIDIDO:** 15 min `access_token`, 8h sesión activa, sin "recordar dispositivo" en fase 1 | §8 |
| Creación del primer `admin` | **DECIDIDO:** proceso manual en Supabase Dashboard + `app_metadata.role = 'admin'` | §8 |
| Recuperación de contraseña | **DECIDIDO:** `supabase.auth.resetPasswordForEmail()` | §8 |
| Revocación de usuarios | **DECIDIDO:** Supabase Dashboard + desactivación de perfil en backend si existe tabla | §8 |
| Multi-local con roles distintos | **DECIDIDO:** fuera de fase 1 — hueco dejado en modelo | §8 |
| PIN por dispositivo | **DECIDIDO:** no en fase 1. Si se añade en el futuro, siempre derivado de sesión backend válida, nunca auth principal | §8 |

Las siguientes decisiones siguen **abiertas**:

| Decisión | Opciones | Impacto si no se cierra |
|---|---|---|
| **`manager` puede reembolsar** | Sí · No (solo `admin`) | Afecta la matriz de permisos cuando se implemente el flujo de reembolso — no bloquea scaffold |
| **Vista separada para `kitchen`** | Misma app con permisos reducidos · vista dedicada tipo KDS | Afecta la arquitectura del frontend de `orders` — puede decidirse durante scaffold |

---

## 12. Documentos que deben referenciar este auth-model

Los siguientes documentos deben apuntar a `docs/auth/auth-model.md` cuando describan acciones que requieren autenticación o permisos:

| Documento | Qué debe referenciar |
|---|---|
| `docs/qr-order-orders-architecture.md` | §P1 — Autenticación de `orders` marcado como **DECIDIDO 2026-05-16**. §orders — Comportamiento funcional real incluye tabla de roles y referencia a §4 de este documento para la matriz completa. |
| `docs/contracts/order-api.md` | Los endpoints de `orders` (`PATCH /status`, `POST /cancel`, `POST /send-to-last`, `POST /confirm-payment`) deben indicar que requieren token de sesión autenticado y rol mínimo. `POST /confirm-payment` está especificado — ver §`confirm-payment`. |
| `docs/domain/order-lifecycle.md` | Las transiciones que requieren rol específico (`cancelled` → solo `manager`, `delivered` → solo `manager` o superior) deben referenciar la matriz de permisos de este documento. |

> No modificar el contenido canónico de esos documentos desde aquí. Añadir solo una referencia de una línea en la sección pertinente, cuando se actualicen.
