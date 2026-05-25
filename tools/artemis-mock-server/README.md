# Artemis mock server

## Que es

Servidor HTTP local de pruebas para simular ArtemisPay sin tocar hardware real ni activar cobros reales.

Sirve para probar llamadas HTTP reales del backend a:
- `POST /tx_sale`
- `POST /tx_confirmation`
- `POST /tx_revert`
- `POST /tx_query`
- `POST /tx_last`

Y tambien sirve como fuente de verdad para el panel visual:
- `docs/artemispay-tester/artemispay-mock.html`

Ese HTML ya no simula por separado. Ahora lee y controla este mismo servidor por HTTP.

## Como arrancar

Desde la raiz del repo:

```bash
node tools/artemis-mock-server/server.mjs
```

Puerto por defecto:

```text
http://localhost:2091
```

## Variables disponibles

- `ARTEMIS_MOCK_PORT=2091`
- `ARTEMIS_MOCK_RESULT=manual|approved|declined|timeout|error`
- `ARTEMIS_MOCK_DELAY_MS=1000`
- `ARTEMIS_MOCK_CARD_LABEL=VISA DEBITO`

## Configuracion recomendada del backend

```env
ARTEMIS_TEST_BASE_URL=http://localhost:2091
ARTEMIS_TEST_API_KEY=test-key
ARTEMIS_OWNER=com.local.kiosk
```

## Flujo esperado

1. `POST /tx_sale`
2. Si el resultado es `manual`, la venta queda esperando decision en `POST /__mock/decision`
3. Si la decision o el resultado es `approved`, queda operacion pendiente de confirmacion
4. `POST /tx_confirmation` confirma
5. `POST /tx_query` consulta pendiente o ultima operacion
6. `POST /tx_last` devuelve la ultima transaccion conocida

## Endpoint dev opcional

Puedes cambiar el resultado del mock sin reiniciarlo:

```bash
curl -X POST http://localhost:2091/__mock/config ^
  -H "Content-Type: application/json" ^
  -d "{\"result\":\"approved\",\"delayMs\":500}"
```

Tambien puedes consultar el estado visual que usa el HTML:

- `GET /__mock/state`
- `POST /__mock/decision`
- `POST /__mock/reset`

## Que NO es

- No es un adaptador real de ArtemisPay
- No es produccion
- No cobra dinero real
- No valida tokens reales
- No sustituye pruebas con terminal real

## Logs

Se registran:
- metodo
- path
- code
- reference
- operation

No se registran:
- Authorization
- Bearer token
- apiKey
- PAN completo
- hash_pan
