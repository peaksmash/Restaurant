# CashDro tester

## Que es

Material de referencia del proveedor para entender el flujo de CashDro y simular operaciones de efectivo.

Importante:
- no es codigo productivo
- no debe copiarse directamente a produccion
- no activa cobros reales por si solo
- cualquier integracion real debe pasar siempre por `local-server`

## Que archivos hay en esta carpeta

- `api cashdro.pdf`: documentacion de API entregada
- `cashdro-mock.html`: simulador visual de operaciones y estados

## Flujo esperado para nuestra integracion

La integracion real NO debe hablar desde frontend a CashDro.

Flujo correcto:
1. `local-server` crea `payment_job`
2. el adapter CashDro habla con el equipo
3. la operacion se orquesta por cola de dispositivo
4. solo puede existir una operacion activa por `device`
5. en demo no se cobra dinero real
6. tras cobro aprobado, el backend confirma internamente con `completeCashierOrderSessionPayment(...)`
7. despues continua con `sendOrderSessionToLast(...)`

## Operaciones y pasos vistos en el tester

El material del tester deja claro este flujo para venta/pago:
- `startOperation`
- `acknowledgeOperationId`
- `askOperation`
- `setOperationImported`

Tambien aparecen operaciones auxiliares del equipo:
- `doTest`
- `getPiecesCurrency`
- `getAlerts`
- `getDiagnosis`
- `askPendingOperations`
- `askMovements`
- `askRunningOperations`

## Configuracion esperada o pendiente

Segun el material recibido y la configuracion legacy existente en el repo, aparecen estos campos:
- `baseUrl`
- `username`
- `password`
- `posId`
- `posUser`
- `allowInsecureTls`

En el codigo actual del repo ya existen nombres legacy equivalentes para configuracion:
- `cashdroBaseUrl`
- `cashdroUsername`
- `cashdroPassword`
- `cashdroPosId`
- `cashdroPosUser`
- `cashdroAllowInsecureTls`

Si algun nombre definitivo cambia en el adapter real, debe confirmarse en el bloque de integracion, no en esta documentacion.

## Seguridad

- no guardar password en DB si se puede evitar
- no loguear credenciales
- no devolver `configJson` con secretos
- `configJson` solo deberia guardar datos no sensibles como host, puerto, `posId` o `posUser` si hace falta
- los secretos reales deben vivir en `.env`

## Regla de arquitectura

El material de esta carpeta NO debe conectarse directo a las apps.

Cualquier integracion real debe pasar por:
1. `payment_devices`
2. `payment_jobs`
3. `paymentJobService`
4. adapter propio del proveedor
5. `completeCashierOrderSessionPayment(...)`
6. `sendOrderSessionToLast(...)`

El frontend nunca debe hablar directamente con CashDro.
Admin, Kiosko y Orders solo deben hablar con `local-server`.

## Estado actual

- CashDro real no activo
- demo/controlado por `payment_jobs`
- integracion real pendiente de bajar el flujo del tester/documentacion al adapter propio

## Riesgos a tener en cuenta

- dispositivo compartido bloqueado por otra operacion
- operaciones paralelas desde varios kioskos
- cancelacion y reintento
- conciliacion con `OrderSession`
- `paid + sync_failed` si Last falla despues del cobro

## Nota sobre secretos y ejemplos

El mock HTML contiene ejemplos visibles de IP local y credenciales de muestra.
Deben tratarse como ejemplos del material de tester y NO copiarse a produccion ni a logs.
