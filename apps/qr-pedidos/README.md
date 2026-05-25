# qr-pedidos

App de pedidos para Smashme: mesa, recoger y domicilio.

## Arrancar en desarrollo

```bash
cd apps/qr-pedidos
npm install
npm run dev
# -> http://localhost:3003
```

Requiere que el `local-server` esté corriendo en `http://localhost:3001`.

## Modo QR mesa

Añade los params en la URL:

```text
http://localhost:3003/menu?table=UUID_DE_LA_MESA&tableName=Mesa+1
```

El `table` es el `tables[].id` que devuelve `GET /api/last/tables`.

## Variables de entorno

Configura Firebase en `.env.local`:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=pide.smashme.es
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_APP_MODE=single
```

Para activar autocompletado de Google Maps en checkout y validar zonas de reparto con coordenadas reales:

```bash
VITE_GOOGLE_MAPS_API_KEY=tu_api_key
```

Sin esa clave, la app sigue funcionando con entrada manual de dirección y aplica la lógica de zonas cuando la ubicación queda resuelta.

## Estructura

```text
src/
  components/
    checkout/ -> selector de direccion y validacion de zona
    layout/   -> AppShell, BottomNav
    menu/     -> ModeSelector, ProductModal
    ui/       -> Toast
  pages/
    MenuPage          -> catalogo + categorias
    CartPage          -> cesta + checkout
    OrdersPage        -> historial
    OrderTrackingPage -> seguimiento en tiempo real
    ProfilePage       -> perfil + auth + puntos
    WelcomePage       -> login Google / telefono / invitado
  store/
    useAuthStore      -> Firebase Auth
    useCartStore      -> carrito persistido
    useToastStore     -> notificaciones
  lib/
    api.ts            -> llamadas al local-server
    delivery.ts       -> calculo de zonas y tarifas
    firebase.ts       -> config Firebase
    utils.ts          -> formatEuro, etc.
  types/
    index.ts          -> tipos TypeScript
```
