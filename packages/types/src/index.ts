// -----------------------------------------------------------------------------
// Canonical constants
// -----------------------------------------------------------------------------

export const ORDER_CHANNELS = [
  'qr_order',
  'kiosk',
  'pos',
  'uber',
  'glovo',
  'deliveroo',
  'just_eat',
  'manual'
] as const;

export const OPERATIONAL_STATUSES = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'delivered',
  'cancelled'
] as const;

export const PAYMENT_STATUSES = [
  'unpaid',
  'payment_pending',
  'paid',
  'payment_failed',
  'refunded'
] as const;

export const LAST_SYNC_STATUSES = [
  'not_sent',
  'sent',
  'sync_failed'
] as const;

export const PREPARATION_TIME_MODES = [
  'auto',
  'manual',
  'inherited'
] as const;

export const PICKUP_TIME_SYNC_STATUSES = [
  'pending',
  'synced',
  'failed'
] as const;

export const PAYMENT_MODES = [
  'online',
  'kiosk',
  'cashier',
  'staff_internal'
] as const;

export const PAYMENT_PROVIDERS = [
  'cashdro',
  'artemis'
] as const;

export const PAYMENT_DEVICE_MODES = [
  'demo',
  'real_pending',
  'real'
] as const;

export const PAYMENT_JOB_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled'
] as const;

export const ORDER_SOURCES = [
  'qr_order',
  'kiosk',
  'manual',
  'pos',
  'last_pos',
  'glovo',
  'uber',
  'deliveroo',
  'just_eat',
  'unknown'
] as const;

export const SOUND_POLICIES = [
  'sound',
  'silent'
] as const;

export const PRINT_STATUSES = [
  'not_queued',
  'pending',
  'printing',
  'printed',
  'failed',
  'cancelled'
] as const;

export const ORDER_SESSION_ITEM_TYPES = [
  'PRODUCT',
  'COMBO'
] as const;

export const ORDER_SESSION_EVENT_ACTOR_TYPES = [
  'customer',
  'staff',
  'system',
  'webhook'
] as const;

// -----------------------------------------------------------------------------
// Canonical union types
// -----------------------------------------------------------------------------

export type Channel = typeof ORDER_CHANNELS[number];
export type OrderChannel = Channel;
export type OperationalStatus = typeof OPERATIONAL_STATUSES[number];
export type PaymentStatus = typeof PAYMENT_STATUSES[number];
export type LastSyncStatus = typeof LAST_SYNC_STATUSES[number];
export type PreparationTimeMode = typeof PREPARATION_TIME_MODES[number];
export type PickupTimeSyncStatus = typeof PICKUP_TIME_SYNC_STATUSES[number];
export type PaymentMode = typeof PAYMENT_MODES[number];
export type PaymentProvider = typeof PAYMENT_PROVIDERS[number];
export type PaymentDeviceMode = typeof PAYMENT_DEVICE_MODES[number];
export type PaymentJobStatus = typeof PAYMENT_JOB_STATUSES[number];
export type OrderSource = typeof ORDER_SOURCES[number];
export type SoundPolicy = typeof SOUND_POLICIES[number];
export type PrintStatus = typeof PRINT_STATUSES[number];
export type OrderSessionItemType = typeof ORDER_SESSION_ITEM_TYPES[number];
export type OrderSessionEventActorType = typeof ORDER_SESSION_EVENT_ACTOR_TYPES[number];

// -----------------------------------------------------------------------------
// Shared primitive/domain helpers
// -----------------------------------------------------------------------------

export type EntityId = string;
export type IsoDateTimeString = string;
export type Nullable<T> = T | null;

// -----------------------------------------------------------------------------
// Customer and pricing
// -----------------------------------------------------------------------------

export interface CustomerInfo {
  name?: Nullable<string>;
  surname?: Nullable<string>;
  phoneNumber?: Nullable<string>;
  email?: Nullable<string>;
  lastCustomerId?: Nullable<string>;
}

export interface OrderPricingSummary {
  subtotal: number;
  discountTotal: number;
  total: number;
  currency: string;
  // TODO: cerrar currency como ISO 4217 / CurrencyCode cuando el contrato lo confirme.
}

// -----------------------------------------------------------------------------
// Catalog and table contracts
// -----------------------------------------------------------------------------

export type CatalogModifierSelectionMode = 'single' | 'multiple';

export interface CatalogModifierOption {
  id: EntityId;
  name: string;
  priceExtra: number;
  // `priceExtra` se expresa en minor units de `currency`.
  available: boolean;
}

export interface CatalogModifierGroup {
  id: EntityId;
  name: string;
  required: boolean;
  selectionMode: CatalogModifierSelectionMode;
  options: CatalogModifierOption[];
}

export interface CatalogProductPromotion {
  promotionId: EntityId;
  promotionName: string;
  discountAmount: number;
  // `discountAmount` y `displayPrice` se expresan en minor units de `currency`.
  displayLabel: string;
  displayPrice: number;
}

export interface CatalogProduct {
  id: EntityId;
  name: string;
  type: OrderSessionItemType;
  unitPrice: number;
  // `unitPrice` se expresa en minor units de `currency`.
  available: boolean;
  imageUrl?: Nullable<string>;
  allergens?: string[];
  modifierGroups: CatalogModifierGroup[];
  promotion?: Nullable<CatalogProductPromotion>;
}

// Temporary alias while parts of the repo/docs still refer to catalog items by the older noun.
export type CatalogItem = CatalogProduct;

export interface CatalogCategory {
  id: EntityId;
  name: string;
  products: CatalogProduct[];
}

export interface CatalogResponse {
  catalogId: EntityId;
  fromCache: boolean;
  categories: CatalogCategory[];
}

export interface TableResolveResponse {
  organizationId: EntityId;
  locationId: EntityId;
  brandId: EntityId;
  catalogId: EntityId;
  tableId: EntityId;
  lastTableId: EntityId;
  tableName: string;
  locationName: string;
  restaurantName: string;
}

// -----------------------------------------------------------------------------
// Preparation times
// -----------------------------------------------------------------------------

export interface PreparationTimeConfig {
  preparationTimeMode?: Nullable<PreparationTimeMode>;
  suggestedPreparationMinutes?: Nullable<number>;
  confirmedPreparationMinutes?: Nullable<number>;
  estimatedReadyAt?: Nullable<IsoDateTimeString>;
  pickupTimeSyncedToLast?: Nullable<IsoDateTimeString>;
  pickupTimeSyncStatus?: Nullable<PickupTimeSyncStatus>;
}

// -----------------------------------------------------------------------------
// Order items
// -----------------------------------------------------------------------------

export interface OrderSessionItemModifier {
  modifierId: EntityId;
  modifierName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderSessionItemPromotion {
  promotionId: EntityId;
  promotionName: string;
  discountAmount: number;
  // Compatibility aliases for older transport shapes still in migration.
  id?: EntityId;
  name?: string;
  discountType?: Nullable<string>;
  label?: Nullable<string>;
}

export interface OrderSessionItem {
  id: EntityId;
  productId: EntityId;
  productName: string;
  type: OrderSessionItemType;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: Nullable<string>;
  promotionId?: Nullable<EntityId>;
  promotion?: Nullable<OrderSessionItemPromotion>;
  modifiers: OrderSessionItemModifier[];
}

// -----------------------------------------------------------------------------
// Source context
// -----------------------------------------------------------------------------

export interface OrderSourceContext {
  channel: Channel;
  source?: Nullable<string>;
  // TODO: `source` sigue pendiente de decisión documental. No asumir semántica distinta de `channel`.
  restaurantSlug?: Nullable<string>;
  // TODO: `restaurantSlug` sigue pendiente de decisión documental.
}

// -----------------------------------------------------------------------------
// Order session
// -----------------------------------------------------------------------------

export interface OrderSession extends OrderPricingSummary, PreparationTimeConfig, OrderSourceContext {
  orderSessionId: EntityId;
  externalId: string;

  organizationId: EntityId;
  locationId: EntityId;
  brandId: EntityId;
  catalogId: EntityId;
  tableId?: Nullable<EntityId>;
  lastTableId?: Nullable<EntityId>;
  tableNameSnapshot?: Nullable<string>;

  operationalStatus: OperationalStatus;
  paymentStatus: PaymentStatus;
  lastSyncStatus: LastSyncStatus;

  customer?: Nullable<CustomerInfo>;
  notes?: Nullable<string>;

  items: OrderSessionItem[];

  paymentMode: PaymentMode;
  stripePaymentIntentId?: Nullable<string>;
  stripeCheckoutSessionId?: Nullable<string>;

  pin4?: Nullable<string>;
  // Rescue token for the order session. Distinct from `TableQrMapping.qrToken`, which resolves a physical table.
  qrToken?: Nullable<string>;
  expiresAt?: Nullable<IsoDateTimeString>;

  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

// -----------------------------------------------------------------------------
// Audit/link/table entities
// -----------------------------------------------------------------------------

export interface OrderSessionEvent {
  id: EntityId;
  orderSessionId: EntityId;
  type: string;
  actorType: OrderSessionEventActorType;
  actorId?: Nullable<EntityId>;
  rawJson?: Nullable<Record<string, unknown>>;
  createdAt: IsoDateTimeString;
}

export interface LastOrderLink {
  id: EntityId;
  orderSessionId: EntityId;
  lastTabId?: Nullable<EntityId>;
  lastBillId?: Nullable<EntityId>;
  lastPaymentId?: Nullable<EntityId>;
  lastCode?: Nullable<string>;
  lastPayloadHash?: Nullable<string>;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface TableQrMapping {
  id: EntityId;
  locationId: EntityId;
  lastTableId: EntityId;
  // Snapshot fallback only. Last.app remains the owner of the real table name.
  tableNameSnapshot?: Nullable<string>;
  qrToken: string;
  enabled: boolean;
}

// Temporary alias for compatibility while the repo migrates to the QR-mapping wording.
export type TableMapping = TableQrMapping;

export interface PaymentDevice {
  id: EntityId;
  locationId: EntityId;
  provider: PaymentProvider;
  displayName: string;
  mode: PaymentDeviceMode;
  configured: boolean;
  isActive: boolean;
  configJson?: Nullable<string>;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface PaymentJob {
  id: EntityId;
  orderSessionId: EntityId;
  locationId: EntityId;
  deviceId: EntityId;
  provider: PaymentProvider;
  status: PaymentJobStatus;
  idempotencyKey: string;
  requestPayloadJson?: Nullable<string>;
  responsePayloadJson?: Nullable<string>;
  createdAt: IsoDateTimeString;
  startedAt?: Nullable<IsoDateTimeString>;
  finishedAt?: Nullable<IsoDateTimeString>;
  errorCode?: Nullable<string>;
  errorMessage?: Nullable<string>;
}

export interface OperationalTicketModifier {
  name: string;
  quantity: number;
  unitPrice?: Nullable<number>;
  totalPrice?: Nullable<number>;
}

export interface OperationalTicketItem {
  name: string;
  quantity: number;
  /** Cantidad original del pedido (antes de cualquier corrección por promo). Igual a quantity si no hay ajuste. */
  originalQuantity?: number;
  /** Cantidad que se pinta en comanda/ticket (puede diferir de quantity por promo 2x1). */
  displayedQuantity?: number;
  unitPrice?: Nullable<number>;
  totalPrice?: Nullable<number>;
  modifiers: OperationalTicketModifier[];
  notes?: Nullable<string>;
  promotionLabel?: Nullable<string>;
  promotionDiscountType?: Nullable<string>;
  hasPromotionAdjustment?: boolean;
}

export interface OperationalTicket {
  ticketId: EntityId;
  displayNumber: string;
  source: OrderSource;
  sourceLabel: string;
  orderSessionId?: Nullable<EntityId>;
  lastTabId?: Nullable<EntityId>;
  lastCode?: Nullable<string>;
  externalOrderId?: Nullable<string>;
  tableName?: Nullable<string>;
  customerName?: Nullable<string>;
  items: OperationalTicketItem[];
  notes?: Nullable<string>;
  subtotal?: Nullable<number>;
  discountTotal?: Nullable<number>;
  total?: Nullable<number>;
  currency?: Nullable<string>;
  estimatedReadyAt?: Nullable<IsoDateTimeString>;
  paid: boolean;
  operationalStatus: OperationalStatus;
  printStatus: PrintStatus;
  soundPolicy: SoundPolicy;
  soundPlayedAt?: Nullable<IsoDateTimeString>;
  firstSeenAt: IsoDateTimeString;
  lastSeenAt: IsoDateTimeString;
  rawSourceHash?: Nullable<string>;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface PrintJob {
  printJobId: EntityId;
  ticketId: EntityId;
  status: PrintStatus;
  mode: string;
  payloadJson: string;
  attempts: number;
  lastError?: Nullable<string>;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  printedAt?: Nullable<IsoDateTimeString>;
}

// -----------------------------------------------------------------------------
// Legacy kiosk/admin compatibility types
// -----------------------------------------------------------------------------

export type LegacyKioskTheme = 'mcdonalds' | 'advanced';
export type KioskTheme = 'principal' | 'moderno' | 'simple' | 'morado' | LegacyKioskTheme;
// TODO: eliminar LegacyKioskTheme cuando todo el repo deje de depender de `mcdonalds` y `advanced`.

export type PickupType = 'takeAway' | 'delivery' | 'onsite';

export interface LastAppConfig {
  token: string;
  organizationId: string;
  locationId: string;
  brandId: string;
  catalogId: string;
}

export interface RestaurantConfig {
  restaurantName: string;
  kioskId: string;
  lastApp: LastAppConfig;
  kiosk: {
    theme: KioskTheme;
    source: string;
    pickupType: PickupType;
    currency: 'EUR';
  };
  payments: {
    simulated: boolean;
    stripeTerminal: boolean;
    cashdro: boolean;
  };
  printer?: {
    enabled: boolean;
    name?: string;
  };
}

export interface LegacyCatalogProduct {
  id: string;
  name: string;
  price: number;
  enabled: boolean;
  type: OrderSessionItemType;
  externalId?: string;
  modifierGroups?: string[];
}

export interface LegacyCatalogCategory {
  id: string;
  name: string;
  enabled: boolean;
  products: LegacyCatalogProduct[];
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  type: OrderSessionItemType;
  modifiers: Array<{
    id: string;
    name: string;
    priceImpact: number;
    quantity: number;
  }>;
}

export interface CreateOrderRequest {
  items: CartItem[];
  customerName?: string;
}

export interface CreateOrderResponse {
  orderCode: string;
  lastTabId?: string;
  status: 'created' | 'failed';
  raw?: unknown;
}

// -----------------------------------------------------------------------------
// Runtime helper functions
// -----------------------------------------------------------------------------

export function isOrderChannel(value: string): value is OrderChannel {
  return ORDER_CHANNELS.includes(value as OrderChannel);
}

export function isOperationalStatus(value: string): value is OperationalStatus {
  return OPERATIONAL_STATUSES.includes(value as OperationalStatus);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return PAYMENT_STATUSES.includes(value as PaymentStatus);
}

export function computeEstimatedReadyAt(createdAt: string | Date, confirmedPreparationMinutes: number): string {
  const baseDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const nextDate = new Date(baseDate.getTime() + confirmedPreparationMinutes * 60_000);
  return nextDate.toISOString();
}
