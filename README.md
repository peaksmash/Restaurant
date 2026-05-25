# Restaurant Kiosk Platform

Base modular para kiosko, QR, orders y admin conectados a Last.app.

## Apps

- `apps/local-server`: backend local. Guarda secretos, configura Last.app y orquesta OrderSession, tickets e impresion.
- `apps/kiosk-web`: kiosko para cliente final.
- `apps/admin-web`: panel de control del local.
- `apps/qr-order`: pedido desde QR de mesa.
- `apps/orders`: operacion, tickets e incidencias.

## Packages

- `packages/types`: tipos compartidos.
- `packages/last-app`: cliente API Last.app.

## Arranque rapido

```bash
npm install
npm run dev
```

## Scripts principales

- `npm run dev`
- `npm run dev:server`
- `npm run dev:kiosk`
- `npm run dev:admin`
- `npm run dev:qr-order`
- `npm run dev:orders`

## Documentacion operativa

- [docs/production-controlada.md](C:/Users/smashme/Documents/New%20project%203/docs/production-controlada.md)
- [docs/e2e-checklist.md](C:/Users/smashme/Documents/New%20project%203/docs/e2e-checklist.md)
- [docs/README.md](C:/Users/smashme/Documents/New%20project%203/docs/README.md)
