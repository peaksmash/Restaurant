# Produccion controlada

## Objetivo

Este documento describe como arrancar y probar el sistema en modo controlado sin activar pagos reales.

Estado esperado:
- Admin operativo
- Orders operativo
- QR operativo
- Kiosko en correccion de flujo de pago por otro bloque
- Last conectado si la configuracion del local es valida
- pagos reales NO activos
- impresion real NO activa por defecto

## Que esta permitido usar

- Admin
- Orders
- QR mesa
- Kiosko en modo controlado
- OrderSession
- payment_devices
- payment_jobs
- tickets operativos
- impresion temporal desde navegador

## Que NO esta activo

- Stripe real
- CashDro real
- Artemis real
- impresion por hardware real
- sistema de usuarios propio

## Variables que debes revisar

Backend real:
- `LAST_TOKEN`
- `ALLOWED_ORIGINS`
- `PAYMENTS_DEMO_MODE`
- `PRINTER_MODE`

Inventario operativo / despliegue:
- `LAST_API_TOKEN`
- `LAST_ORGANIZATION_ID`
- `LAST_LOCATION_ID`
- `LAST_BRAND_ID`
- `LAST_CATALOG_ID`
- `ARTEMIS_TEST_BASE_URL`
- `ARTEMIS_TEST_API_KEY`
- `ARTEMIS_OWNER`

Frontend:
- `VITE_API_BASE_URL`

## Donde poner las variables

Backend:
- raiz del repo en `.env`

Frontend:
- cada app Vite lee su propio `.env.local`
- si no defines `VITE_API_BASE_URL`, en desarrollo se usa el proxy `/api`

Apps front:
- `apps/admin-web/.env.local`
- `apps/kiosk-web/.env.local`
- `apps/orders/.env.local`
- `apps/qr-order/.env.local`

## Como arrancar todo

Desde la raiz:

```bash
npm install
npm run dev
```

## Como arrancar por separado

Backend:

```bash
npm run dev:server
```

Admin:

```bash
npm run dev:admin
```

Kiosko:

```bash
npm run dev:kiosk
```

Orders:

```bash
npm run dev:orders
```

QR Order:

```bash
npm run dev:qr-order
```

## URLs locales actuales

- Kiosko: `http://localhost:3000`
- Admin: `http://localhost:3002`
- QR Order: `http://localhost:3003`
- Orders: `http://localhost:3004`
- API: `http://localhost:3001`

## Modo demo

`PAYMENTS_DEMO_MODE=true` significa:
- no se cobra dinero real
- no se llama al hardware real
- payment_jobs pueden completar en demo
- el flujo sigue pasando por la logica central de confirmacion y envio a Last

## Como probar flujo demo

1. Arranca backend y frontends.
2. Abre Admin.
3. Verifica que pagos estan en demo.
4. Crea o revisa dispositivos demo del local.
5. Crea un pedido de prueba.
6. Comprueba que el cobro se completa en demo.
7. Revisa en Orders el ticket operativo y la impresion navegador.

## Si Last falla

Sintoma esperado:
- la sesion puede quedar `paid + sync_failed`

Que hacer:
1. No volver a cobrar.
2. Abrir Orders.
3. Revisar la incidencia.
4. Reintentar envio a Last desde el flujo operativo disponible.
5. Revisar token, location, catalogo y conectividad del backend.

## Si la impresion falla

Revisa `PRINTER_MODE`:
- `disabled`: devolvera "Impresora no configurada"
- `browser`: abrira vista imprimible temporal en navegador

Si falla en browser:
1. Revisar bloqueo de popups.
2. Revisar que Orders este abriendo la vista previa.
3. Reintentar desde reimpresion.

## Si Kiosko no muestra metodos de pago

Revisa:
1. que el local tenga `payment_devices` activos
2. que Admin los muestre en el local correcto
3. que `locationId` de config coincida con el local de esos dispositivos
4. que el backend este actualizado
5. que el flujo de kiosko este ya en la version corregida

Nota:
- El kiosko esta siendo corregido en paralelo para forzar pago obligatorio y una sola verdad.

## Si Orders no muestra ticket

Revisa:
1. que el pedido haya llegado a `paid + sent`
2. que Last este devolviendo el pedido o exista `last_order_link`
3. que el backend este corriendo con la version actual
4. que `OperationalTicket` se haya generado
5. que Orders pueda leer `/api/operational-tickets`

## Si queda paid + sync_failed

Esto significa:
- el cobro ya es firme
- Last no se actualizo correctamente

Accion correcta:
1. no volver a cobrar
2. tratarlo como incidencia operativa
3. reintentar el envio a Last
4. revisar configuracion de Last y conectividad

## Notas importantes

- CashDro y Artemis reales no estan activos salvo activacion posterior explicita.
- `preferredPaymentMethod` legacy no debe considerarse activacion de cobro real.
- Este documento no sustituye la configuracion funcional de cada local dentro de Admin.
- Artemis y CashDro reales no se activan nunca directamente desde frontend.
- Su integracion debe pasar por `payment_devices` y `payment_jobs`.
- El material vendor esta en `docs/artemispay-tester` y `docs/cashdro-tester`.
- Las credenciales reales deben ir siempre por ENV, no en docs ni en SQLite.
