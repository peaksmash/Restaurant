# QR Order + Orders Documentation

Esta carpeta contiene la documentacion normativa y operativa del dominio de pedidos.

## Documentos principales

| Documento | Proposito |
|---|---|
| `production-controlada.md` | Arranque, variables, limites y operacion minima para produccion controlada |
| `e2e-checklist.md` | Checklist manual de validacion punta a punta |
| `qr-order-orders-architecture.md` | Arquitectura madre, decisiones generales, estado real de implementacion de `qr-order` |
| `contracts/order-api.md` | Contrato canonico de pedidos, IDs, canales, estados, endpoints, errores e idempotencia |
| `contracts/last-api.md` | Adapter tecnico Last: funciones, payloads, mappers, tipos minimos, limites y plan de migracion |
| `domain/order-lifecycle.md` | Ciclo de vida de pedidos, transiciones validas, flujos A-E, reembolsos y expiracion de sesion |
| `domain/preparation-times.md` | Modelo de tiempos de preparacion y sincronizacion con Last |
| `auth/auth-model.md` | Referencia historica del modelo de autenticacion |
| `contracts/stripe-webhook.md` | Integracion Stripe para `qr-order` online: Checkout hosted, webhook, idempotencia y estados |
| `artemispay-tester/README.md` | Material vendor/tester de ArtemisPay y reglas internas para integracion segura |
| `cashdro-tester/README.md` | Material vendor/tester de CashDro y reglas internas para integracion segura |

## Vendor / Testers

- ArtemisPay: [docs/artemispay-tester/README.md](C:/Users/smashme/Documents/New%20project%203/docs/artemispay-tester/README.md)
- CashDro: [docs/cashdro-tester/README.md](C:/Users/smashme/Documents/New%20project%203/docs/cashdro-tester/README.md)
- Artemis mock server: [tools/artemis-mock-server/README.md](C:/Users/smashme/Documents/New%20project%203/tools/artemis-mock-server/README.md)

## Regla operativa

Nada entra en codigo si antes no existe en la documentacion normativa.

Secuencia obligatoria:

1. Se decide.
2. Se documenta.
3. Se implementa.
