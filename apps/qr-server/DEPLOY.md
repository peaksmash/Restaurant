# qr-server — Deploy Guide

Backend Fastify API for the PideAhora QR ordering system.
Connects to Firebase Admin SDK (Firestore) and Last.app API.

---

## Environment variables

See `.env.example` for the full list. All variables are **required** unless marked optional.

### Server

| Variable | Required | Description |
|---|---|---|
| `PORT` | auto | Port to listen on. Render/Railway set this automatically. |
| `ALLOWED_ORIGINS` | yes | Comma-separated list of frontend origins for CORS. |

**Production example:**
```
ALLOWED_ORIGINS=https://qr.yourdomain.com,https://qr-staging.yourdomain.com
```

### Firebase Admin

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_PROJECT_ID` | yes | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | yes | Service account client email |
| `FIREBASE_PRIVATE_KEY` | yes | Private key — paste as single line with `\n` (not literal newlines) |

Get these from: **Firebase Console → Project Settings → Service Accounts → Generate new private key**.

### Last.app

| Variable | Required | Description |
|---|---|---|
| `LAST_TOKEN` | yes | Bearer token for Last.app v2 API |
| `LAST_BASE_URL` | yes | Default: `https://api.last.app/v2` |

---

## Build and start

```bash
# Type-check (no compiled output — server runs via tsx)
npm run build --workspace=apps/qr-server

# Start (uses tsx, reads .env automatically via dotenv/config)
npm run start --workspace=apps/qr-server

# Dev (watch mode)
npm run dev --workspace=apps/qr-server

# Seed Firestore from real Last.app data (run once per tenant)
npm run seed:tenant --workspace=apps/qr-server
```

> **Note:** The server uses `tsx` at runtime — no separate compile step needed before `start`.
> Ensure `tsx` is available in `dependencies` (not just `devDependencies`) for production.

---

## Health check

```
GET /health
→ 200 { "status": "ok", "service": "qr-server" }
```

Use this as the Render/Railway health check path: `/health`

---

## Bootstrap smoke test

Replace `<TENANT>` and `<LOCATION>` with the values from `seed:tenant` output:

```bash
curl "https://<QR_SERVER_PUBLIC_DOMAIN>/api/tenant/bootstrap?tenant=<TENANT>&locationKey=<LOCATION>&orderMode=delivery"
```

Expected: `200` with `mode: "resolved"`, full catalog, and `lastLocation.deliveryAreas`.

---

## CORS configuration

`ALLOWED_ORIGINS` is a comma-separated list. The server rejects any origin not in this list.

```
# Local dev
ALLOWED_ORIGINS=http://localhost:3003

# Staging
ALLOWED_ORIGINS=https://qr-staging.yourdomain.com

# Production
ALLOWED_ORIGINS=https://qr.yourdomain.com

# Multiple
ALLOWED_ORIGINS=https://qr.yourdomain.com,https://qr-staging.yourdomain.com
```

---

## Firestore data setup

Firestore is **not auto-migrated**. After deploying, run the seed script once:

```bash
# Reads real org/location from Last.app and writes /tenants/{slug}/locations/{key}
npm run seed:tenant --workspace=apps/qr-server
```

The script also updates `apps/qr-pedidos/.env` with the derived `VITE_QR_SERVER_TENANT` and
`VITE_QR_SERVER_LOCATION_KEY`. Rebuild qr-pedidos after re-seeding.

---

## Security notes

- **Never commit `.env`** — it's listed in `.gitignore`. Use your host's secret manager.
- **`FIREBASE_PRIVATE_KEY`** must be kept secret. Do not log it or expose it in responses.
- **`LAST_TOKEN`** is a bearer token — treat it like a password.

---

## Future: Stripe webhook

When Stripe integration is activated, the webhook endpoint will be:

```
POST https://<QR_SERVER_PUBLIC_DOMAIN>/api/webhooks/stripe
```

Add to Stripe Dashboard → Developers → Webhooks → Add endpoint.
Add the following env vars at that point:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## qr-pedidos (frontend) — env vars for production build

| Variable | Description |
|---|---|
| `VITE_QR_SERVER_URL` | Public URL of this qr-server (e.g. `https://qr-server.yourdomain.com`) |
| `VITE_QR_SERVER_TENANT` | Tenant slug from seed output |
| `VITE_QR_SERVER_LOCATION_KEY` | Location key from seed output |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key (restrict by domain in Google Cloud Console) |

**Google Maps key domain restriction:**
In Google Cloud Console → APIs & Services → Credentials → select your API key →
Application restrictions → HTTP referrers → add:
```
https://qr.yourdomain.com/*
https://qr-staging.yourdomain.com/*
```
This prevents the key from being used on other domains even if exposed in the JS bundle.

**Build command for qr-pedidos:**
```bash
npm run build --workspace=qr-pedidos
# Output: apps/qr-pedidos/dist/ — deploy as static files (Netlify, Vercel, Render Static Site, etc.)
```
