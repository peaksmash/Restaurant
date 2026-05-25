# E2E checklist

## Admin

- [ ] abre sin errores
- [ ] muestra modo demo de pagos
- [ ] muestra pagos
- [ ] muestra impresion

## Kiosko

- [ ] abre
- [ ] crea cesta
- [ ] pide cliente
- [ ] muestra pago
- [ ] crea `payment_job`
- [ ] pago demo completa

## Orders

- [ ] ve cobros pendientes
- [ ] ve incidencias
- [ ] ve tickets
- [ ] sonido una vez
- [ ] impresion browser

## QR

- [ ] abre con `qrToken`
- [ ] crea pedido
- [ ] no manda a Last antes de pago

## Last

- [ ] si esta configurado, recibe pedido tras pago
- [ ] si falla, queda `sync_failed`

## Impresion

- [ ] con `PRINTER_MODE=browser` abre vista imprimible
- [ ] con `PRINTER_MODE=disabled` muestra error claro

## Cola de pagos

- [ ] un dispositivo solo procesa un cobro a la vez
- [ ] un segundo cobro entra en espera
- [ ] locales distintos no se bloquean entre si

## Incidencias operativas

- [ ] un pedido `paid + sync_failed` aparece como incidencia
- [ ] no se vuelve a cobrar
- [ ] se puede reintentar el envio a Last

## Artemis mock / test futuro

- [ ] mock server levantado
- [ ] `payment_device` Artemis configurado
- [ ] `payment_job` con `provider=artemis`
- [ ] approved -> paid -> `tx_confirmation`
- [ ] declined -> failed sin `paid`

## CashDro futuro

- [ ] device configurado
- [ ] cola por device
- [ ] cobro demo o `real_pending`
- [ ] no operaciones paralelas
