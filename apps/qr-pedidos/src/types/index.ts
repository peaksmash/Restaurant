// src/types/index.ts

export type OrderMode = 'mesa' | 'recoger' | 'domicilio'

export interface LastCategory {
  id: string
  name: string
  enabled: boolean
  description?: string
  products: LastProduct[]
}

export interface LastModifier {
  id: string
  name: string
  enabled: boolean
  priceImpact: number
  externalId?: string
  organizationModifierId?: string
}

export interface LastModifierGroup {
  id: string
  name: string
  enabled: boolean
  min: number
  max: number
  modifiers: LastModifier[]
  allowRepeat: boolean
}

export interface LastProduct {
  id: string
  name: string
  description?: string
  price: number
  displayPrice?: number
  enabled: boolean
  imageUrl?: string
  emoji?: string
  course?: string
  type?: string
  vatPercentage?: number
  allergens?: string[]
  specifications?: string[]
  modifierGroups?: string[] // IDs
  organizationProductId?: string
  externalId?: string
  promotion?: {
    id: string
    name?: string
    label?: string
    discountType?: string
    discountAmount?: number
  }
  // populated after catalog load
  modifierGroupsFull?: LastModifierGroup[]
}

export interface Catalog {
  fromCache: boolean
  categories: LastCategory[]
  modifierGroups: LastModifierGroup[]
}

export interface RestaurantConfig {
  restaurantName?: string
  logoUrl?: string | null
  paymentsSimulated?: boolean
  kiosk?: {
    theme?: string
  }
}

export interface CartModifier {
  id: string
  groupId: string
  name: string
  priceImpact: number
}

export interface CartItem {
  cartItemId: string       // unique per cart line
  productId: string
  name: string
  price: number            // base price in cents
  qty: number
  imageUrl?: string
  emoji?: string
  modifiers: CartModifier[]
  notes?: string
}

export interface DeliveryArea {
  id?: string
  name?: string
  type?: 'polygon' | 'circle' | string | null
  geometry: unknown
  fee?: number
  deliveryFee?: number
  minimumBasket: number
  estimatedDeliveryMinutes: number
  enabled: boolean
}

export interface LocationInfo {
  id?: string
  name: string
  address: string
  lat: number
  lng: number
  deliveryAreas: DeliveryArea[]
  paymentMethods: PaymentMethod[]
  preparationMinutes: number
  horarios?: unknown
}

export interface PaymentMethod {
  id?: string
  name?: string
  provider?: string
  financialMethod?: string
  behavior?: string
  enabled?: boolean
  type?: string
  description?: string
}

export interface OrderSession {
  id: string
  code?: string
  operationalCode?: string
  channel: 'qr' | 'takeaway' | 'delivery'
  status?: string
  lastSyncStatus?: string
  items: CartItem[]
  total: number
  mode: OrderMode
  address?: string
  tableId?: string
  tableName?: string
  notes?: string
  createdAt: string
}

export interface StoredOrderItemModifier {
  name: string
  priceImpact?: number
}

export interface StoredOrderItem {
  name?: string
  productName?: string
  qty?: number
  quantity?: number
  price?: number
  unitPrice?: number
  modifiers?: StoredOrderItemModifier[]
}

export interface StoredOrder {
  id: string
  code?: string
  operationalCode?: string
  mode: OrderMode
  items: StoredOrderItem[]
  total: number
  address?: string
  tableName?: string
  customerId?: string | null
  paymentMode?: 'online' | 'cashier' | 'kiosk'
  paymentStatus?: 'unpaid' | 'payment_pending' | 'paid' | 'payment_failed' | 'refunded'
  status?: string
  createdAt: string
  lastSyncStatus?: string
  pin4?: string | null
  qrToken?: string | null
  expiresAt?: string | null
}

export interface AuthUser {
  uid: string
  name: string
  email: string | null
  phone: string | null
  photoURL: string | null
  isAnonymous: boolean
}

export interface OrderStatusResponse {
  status: string
  delivery?: {
    courier: unknown
    statuses: Array<Record<string, unknown>>
  }
}
