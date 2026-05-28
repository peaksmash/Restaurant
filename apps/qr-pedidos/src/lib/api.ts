// src/lib/api.ts
// Todas las llamadas van al local-server en /api/*
// En dev, Vite proxy redirige /api → localhost:3001

const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// ── Bootstrap desde qr-server ─────────────────────────────────
const QR_SERVER_URL = import.meta.env.VITE_QR_SERVER_URL ?? 'http://localhost:3005'
const QR_SERVER_TENANT = import.meta.env.VITE_QR_SERVER_TENANT ?? ''
const QR_SERVER_LOCATION_KEY = import.meta.env.VITE_QR_SERVER_LOCATION_KEY ?? ''

export interface BootstrapDeliveryArea {
  id: string
  name: string
  enabled: boolean
  type: string
  deliveryFee: number
  minimumBasket: number
  estimatedDeliveryMinutes: number
  deliveryExtraMinutes: number | null
  /** Raw geometry from Last.app — polygon points or circle. Used for client-side zone matching. */
  geometry: unknown
}

export interface BootstrapModifier {
  id: string
  name: string
  priceImpact: number
  organizationModifierId?: string
}

export interface BootstrapModifierGroup {
  id: string
  name: string
  min: number
  max: number
  allowRepeat: boolean
  modifiers: BootstrapModifier[]
}

export interface BootstrapProduct {
  id: string
  name: string
  type: string
  price: number
  enabled: boolean
  imageUrl: string | null
  modifierGroups: string[]
}

export interface BootstrapCategory {
  id: string
  name: string
  enabled: boolean
  productsCount: number
  products: BootstrapProduct[]
}

export interface BootstrapResponse {
  mode: 'resolved'
  tenant: {
    tenantId: string
    tenantSlug: string
    displayName: string
    branding: { logoUrl: string | null; primaryColor: string | null; secondaryColor: string | null }
    features: { qrEnabled: boolean; deliveryEnabled: boolean; pickupEnabled: boolean; tableQrEnabled: boolean }
  }
  location: {
    locationKey: string
    slug: string
    displayName: string
    timezone: string | null
    lastApp: { organizationId: string; locationId: string; brandId: string }
    online: { enabled: boolean; deliveryEnabled: boolean; pickupEnabled: boolean; tableQrEnabled: boolean }
  }
  lastLocation: {
    preparationMinutes: number
    deliveryAreas: BootstrapDeliveryArea[]
    workingTimesKeys: string[]
    paymentMethods: unknown[]
    offlinePaymentMethods: unknown[]
  }
  catalog: {
    catalogId: string
    orderMode: string
    categoriesCount: number
    modifierGroupsCount: number
    modifierGroups: BootstrapModifierGroup[]
    categories: BootstrapCategory[]
  }
}

// ── OrderSession draft ────────────────────────────────────────

export interface OrderSessionDraftItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  modifiers?: {
    modifierId: string
    modifierName: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }[]
  notes?: string | null
}

export interface LastDeliveryInput {
  address: string
  details?: string | null
  latitude: number
  longitude: number
  fee: number
  comments?: string | null
  external?: boolean
  needCutlery?: boolean
}

export interface LastDeliveryAreaSnapshot {
  id: string | null
  name: string | null
  deliveryFee: number
  minimumBasket: number
  estimatedDeliveryMinutes: number
}

export interface OrderSessionDraftBody {
  tenant: string
  locationKey: string
  orderMode: 'delivery' | 'pickup' | 'table'
  paymentMode: 'online' | 'cashier'
  items: OrderSessionDraftItem[]
  totals: {
    subtotal: number
    deliveryFee: number
    total: number
    currency: 'EUR'
  }
  lastDeliveryInput?: LastDeliveryInput | null
  lastDeliveryAreaSnapshot?: LastDeliveryAreaSnapshot | null
}

export interface OrderSessionDraftResponse {
  orderSessionId: string
  operationalStatus: 'draft'
  paymentStatus: 'unpaid'
  lastSyncStatus: 'not_sent'
  totals: { subtotal: number; deliveryFee: number; total: number; currency: string }
  createdAt: string
}

export async function createOrderSessionDraft(
  body: OrderSessionDraftBody,
): Promise<OrderSessionDraftResponse> {
  const url = `${QR_SERVER_URL}/api/order-sessions`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => 'Error desconocido')
    throw new Error(`OrderSession ${res.status}: ${text}`)
  }
  return res.json() as Promise<OrderSessionDraftResponse>
}

export async function getBootstrap(orderMode: 'table' | 'pickup' | 'delivery'): Promise<BootstrapResponse> {
  if (!QR_SERVER_TENANT || !QR_SERVER_LOCATION_KEY) {
    throw new Error('VITE_QR_SERVER_TENANT / VITE_QR_SERVER_LOCATION_KEY not configured')
  }
  const url = `${QR_SERVER_URL}/api/tenant/bootstrap?tenant=${encodeURIComponent(QR_SERVER_TENANT)}&locationKey=${encodeURIComponent(QR_SERVER_LOCATION_KEY)}&orderMode=${orderMode}`
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) {
    const text = await res.text().catch(() => 'Error desconocido')
    throw new Error(`Bootstrap ${res.status}: ${text}`)
  }
  return res.json() as Promise<BootstrapResponse>
}

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
    externalId?: string | null
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

export const createPaymentIntent = (orderSessionId: string): Promise<{ clientSecret: string }> => {
  const url = `${QR_SERVER_URL}/api/order-sessions/${orderSessionId}/payment-intent`
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => 'Error')
      throw new Error(`PaymentIntent ${res.status}: ${text}`)
    }
    return res.json() as Promise<{ clientSecret: string }>
  })
}

export interface QrOrderSessionStatus {
  orderSessionId: string
  operationalStatus: string
  paymentStatus: string
  totals: { subtotal: number; deliveryFee: number; total: number; currency: string }
  createdAt: string
}

export const getQrOrderSession = (orderSessionId: string): Promise<QrOrderSessionStatus> => {
  const url = `${QR_SERVER_URL}/api/order-sessions/${orderSessionId}`
  return fetch(url).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => 'Error')
      throw new Error(`OrderSession ${res.status}: ${text}`)
    }
    return res.json() as Promise<QrOrderSessionStatus>
  })
}

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
  phoneNumber?: string
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

export const getMyOrders = (externalId: string) =>
  request<{ orders: import('@/types').StoredOrder[] }>(
    `/api/mis-pedidos?externalId=${encodeURIComponent(externalId)}`
  )
