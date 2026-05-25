// src/lib/api.ts
// Todas las llamadas van al local-server en /api/*
// En dev, Vite proxy redirige /api → localhost:3001

const BASE = ''  // proxy en dev, relativo en prod

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => 'Error desconocido')
    throw new Error(err)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return res.json() as Promise<T>
}

// ── Catálogo ─────────────────────────────────────────────────
export const getCatalog = () =>
  fetch(BASE + '/api/catalog-with-promotions')
    .then(async (res) => {
      if (res.ok) {
        return res.json() as Promise<import('@/types').Catalog>
      }
      return request<import('@/types').Catalog>('/api/catalog')
    })
    .catch(() => request<import('@/types').Catalog>('/api/catalog'))

export const getConfig = () =>
  request<import('@/types').RestaurantConfig>('/api/config')

// ── Localización y zonas de reparto ──────────────────────────
export const getLocation = () =>
  request<import('@/types').LocationInfo>('/api/location')

// ── Pedidos ───────────────────────────────────────────────────
export interface CreateOrderBody {
  externalId: string
  channel: 'qr_order'
  paymentMode: 'online' | 'cashier' | 'kiosk'
  customer?: {
    name?: string | null
    surname?: string | null
    phoneNumber?: string | null
    email?: string | null
  } | null
  items: {
    id: string
    productId: string
    productName: string
    quantity: number
    unitPrice: number
    totalPrice: number
    modifiers: {
      modifierId: string
      modifierName: string
      quantity: number
      unitPrice: number
      totalPrice: number
    }[]
    notes?: string | null
  }[]
  subtotal: number
  discountTotal: number
  total: number
  currency: string
  tableId?: string
  lastTableId?: string
  tableNameSnapshot?: string
  notes?: string | null
  source?: string | null
  restaurantSlug?: string | null
  suggestedPreparationMinutes?: number | null
  confirmedPreparationMinutes?: number | null
}

export const createOrder = (body: CreateOrderBody) =>
  request<{
    orderSessionId: string
    code?: string
    operationalCode?: string
    lastSyncStatus?: string
    paymentStatus?: string
    pin4?: string | null
    qrToken?: string | null
    expiresAt?: string | null
  }>(
    '/api/order-sessions',
    { method: 'POST', body: JSON.stringify(body) }
  )

export const getOrderStatus = (id: string) =>
  request<import('@/types').OrderStatusResponse>(
    `/api/orders/${id}/status`
  )

export const getOrderSession = (id: string) =>
  request<import('@/types').StoredOrder>(`/api/order-sessions/${id}`)

export const createStripeCheckout = (
  orderSessionId: string,
  successUrl: string,
  cancelUrl: string,
) =>
  request<{ checkoutUrl: string; stripeCheckoutSessionId: string; expiresAt: number }>(
    `/api/order-sessions/${orderSessionId}/checkout/stripe`,
    { method: 'POST', body: JSON.stringify({ successUrl, cancelUrl }) }
  )

// ── Clientes y puntos ─────────────────────────────────────────
export interface CreateCustomerBody {
  name: string
  phoneNumber: string
  email?: string
  externalId?: string
}

export const createOrGetCustomer = (body: CreateCustomerBody) =>
  request<{ id: string; name: string; points?: number }>(
    '/api/customers',
    { method: 'POST', body: JSON.stringify(body) }
  )

export const getCustomerPoints = (customerId: string) =>
  request<{ points: number }>(`/api/customers/${customerId}/points`)

export const addCustomerPoints = (customerId: string, points: number, concept: string) =>
  request<void>(
    `/api/customers/${customerId}/points`,
    { method: 'PUT', body: JSON.stringify({ points, concept }) }
  )
