import type { OrderSession, PaymentDevice, PaymentJob } from '@kiosk/types';

function resolveApiBase() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return '';
}

const BASE = resolveApiBase();

export interface CustomerFieldConfig {
  enabled: boolean;
  required: boolean;
}

export interface KioskConfig {
  restaurantName: string;
  paymentsSimulated: boolean;
  logoUrl?: string;
  lastApp: {
    tokenConfigured: boolean;
    tokenMasked: string | null;
    organizationId: string;
    locationId: string;
    brandId: string;
    catalogId: string;
  };
  kiosk: {
    theme: string;
    source: string;
    pickupType: string;
    defaultOrderMode: 'takeAway' | 'eatIn' | 'delivery';
    enableEatIn?: boolean;
    enableTakeAway?: boolean;
    customerFields: {
      name: CustomerFieldConfig;
      phoneNumber: CustomerFieldConfig;
      email: CustomerFieldConfig;
    };
    notes: {
      generalEnabled: boolean;
      productCommentsEnabled: boolean;
    };
    features: {
      modifiers: boolean;
      notes: boolean;
      upselling: boolean;
      printTicket: boolean;
    };
    payment: {
      mode: string;
      preferredPaymentMethod: string;
      cashdro: {
        configured: boolean;
        baseUrl: string;
        username: string;
        passwordMasked: string | null;
        posId: string;
        posUser: string;
        allowInsecureTls: boolean;
      };
    };
  };
  setupCompleted: boolean;
}

export interface Modifier {
  id: string;
  name: string;
  priceImpact: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  min?: number;
  max?: number;
  modifiers: Modifier[];
}

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  enabled: boolean;
  type: 'PRODUCT' | 'COMBO';
  externalId?: string;
  modifierGroups?: string[];
  imageUrl?: string;
  description?: string;
  allergens?: string[];
  displayPrice?: number;
  promotion?: {
    id: string;
    name?: string;
    discountType?: string;
    discountAmount?: number;
    label?: string;
  };
}

export interface CatalogCategory {
  id: string;
  name: string;
  enabled: boolean;
  products: CatalogProduct[];
}

export interface Catalog {
  categories: CatalogCategory[];
  modifierGroups: ModifierGroup[];
}

export type OrderMode = 'eatIn' | 'takeAway';

export interface KioskCartItem {
  cartKey: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  type: 'PRODUCT' | 'COMBO';
  modifiers: Array<{ id: string; name: string; priceImpact: number; quantity: number }>;
  comments?: string;
  imageUrl?: string;
  displayPrice?: number;
  promotion?: {
    id: string;
    name?: string;
    discountType?: string;
    discountAmount?: number;
    label?: string;
  };
  promotionId?: string;
}

export interface Customer {
  name?: string;
  phoneNumber?: string;
  email?: string;
}

export interface OrderTotals {
  total?: number;
  discountTotal?: number;
  tax?: number;
}

export interface RecoveryLookupResponse {
  orderSession: OrderSession;
  tableName: string | null;
}

export interface CashierConfirmPaymentResponse {
  orderSession: OrderSession;
  lastSyncStatus: 'not_sent' | 'sent' | 'sync_failed';
}

export interface CashdroPaymentSnapshot {
  provider: 'cashdro';
  configured: boolean;
  operationId: string | null;
  aliasId: string | null;
  workflowStatus: 'pending' | 'waiting_cash' | 'dispensing_change' | 'completed' | 'cancelled' | 'failed';
  state: string | null;
  total: number;
  totalIn: number;
  totalOut: number;
  changeNotAvailable: number;
  amountRemaining: number;
  changeDue: number;
  payInProgress: number | null;
  payOutProgress: number | null;
  withError: boolean;
  messages: number[];
  imported: boolean;
  completed: boolean;
  cancelled: boolean;
  customerMessage: string;
}

export interface CashdroPaymentResponse {
  orderSession: OrderSession;
  payment: CashdroPaymentSnapshot;
}

export interface PaymentDeviceView extends PaymentDevice {
  queueState: {
    running: boolean;
    queued: number;
  };
}

export interface PaymentJobView extends PaymentJob {}

export const CONFIG_DEFAULTS = {
  theme: 'mcdonalds',
  defaultOrderMode: 'takeAway' as OrderMode,
  modifiers: true,
  name: { enabled: true, required: true },
  notes: { generalEnabled: false, productCommentsEnabled: false },
  cashdro: {
    configured: false,
    baseUrl: '',
    username: '',
    passwordMasked: null,
    posId: 'Kiosk',
    posUser: 'Caja',
    allowInsecureTls: true,
  },
} as const;

export function resolveConfig(raw: KioskConfig): KioskConfig {
  const k = raw.kiosk;
  return {
    ...raw,
    kiosk: {
      ...k,
      theme: k.theme || CONFIG_DEFAULTS.theme,
      defaultOrderMode: k.defaultOrderMode || CONFIG_DEFAULTS.defaultOrderMode,
      customerFields: {
        name: k.customerFields?.name ?? CONFIG_DEFAULTS.name,
        phoneNumber: k.customerFields?.phoneNumber ?? { enabled: false, required: false },
        email: k.customerFields?.email ?? { enabled: false, required: false },
      },
      notes: k.notes ?? CONFIG_DEFAULTS.notes,
      features: {
        modifiers: k.features?.modifiers ?? CONFIG_DEFAULTS.modifiers,
        notes: k.features?.notes ?? false,
        upselling: k.features?.upselling ?? false,
        printTicket: k.features?.printTicket ?? false,
      },
      payment: {
        mode: k.payment?.mode ?? 'simulated',
        preferredPaymentMethod: k.payment?.preferredPaymentMethod ?? 'Cash',
        cashdro: k.payment?.cashdro ?? CONFIG_DEFAULTS.cashdro,
      },
    },
  };
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string; details?: unknown };
    return body.error ?? body.message ?? fallback;
  } catch {
    return fallback;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('No se pudo conectar con el backend real.');
    }
    throw error;
  }

  if (!res.ok) {
    throw new Error(await readApiError(res, `Error en ${path} (${res.status})`));
  }

  return res.json() as Promise<T>;
}

export async function fetchConfig(): Promise<KioskConfig> {
  const raw = await requestJson<KioskConfig>('/api/config');
  return resolveConfig(raw);
}

export async function fetchCatalog(): Promise<Catalog> {
  try {
    const data = await requestJson<{
      categories?: unknown[];
      modifierGroups?: unknown[];
      promotionsError?: boolean;
    }>('/api/catalog-with-promotions');
    return {
      categories: (data.categories ?? []) as CatalogCategory[],
      modifierGroups: (data.modifierGroups ?? []) as ModifierGroup[],
    };
  } catch {
    const data = await requestJson<{ categories?: unknown[]; modifierGroups?: unknown[] }>('/api/catalog');
    return {
      categories: (data.categories ?? []) as CatalogCategory[],
      modifierGroups: (data.modifierGroups ?? []) as ModifierGroup[],
    };
  }
}

export interface CreateKioskOrderSessionInput {
  externalId: string;
  source?: string | null;
  customer?: Customer | null;
  notes?: string | null;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    type: 'PRODUCT' | 'COMBO';
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string | null;
    promotionId?: string | null;
    modifiers: Array<{
      modifierId: string;
      modifierName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  }>;
  subtotal: number;
  discountTotal: number;
  total: number;
  currency: string;
}

export function createKioskOrderSession(input: CreateKioskOrderSessionInput) {
  return requestJson<import('@kiosk/types').OrderSession>('/api/order-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, channel: 'kiosk', paymentMode: 'cashier' }),
  });
}

export function cartToOrderSessionItems(
  cart: KioskCartItem[],
): CreateKioskOrderSessionInput['items'] {
  return cart.map((item) => ({
    id: item.cartKey,
    productId: item.productId,
    productName: item.name,
    type: item.type,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.quantity * item.unitPrice,
    notes: item.comments?.trim() || null,
    promotionId: item.promotionId ?? item.promotion?.id ?? null,
    modifiers: item.modifiers.map((mod) => ({
      modifierId: mod.id,
      modifierName: mod.name,
      quantity: mod.quantity,
      unitPrice: mod.priceImpact,
      totalPrice: mod.priceImpact * mod.quantity,
    })),
  }));
}

export async function recoverPendingOrder(tokenOrCode: string): Promise<RecoveryLookupResponse> {
  return requestJson<RecoveryLookupResponse>(`/api/order-sessions/recovery/${encodeURIComponent(tokenOrCode)}`);
}

export async function confirmRecoveredOrderPayment(orderSessionId: string, amountReceived: number, idempotencyKey: string) {
  return requestJson<CashierConfirmPaymentResponse>(`/api/order-sessions/${encodeURIComponent(orderSessionId)}/confirm-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentMode: 'cashier',
      paymentProvider: 'cash',
      amountReceived,
      idempotencyKey,
    }),
  });
}

export function startCashdroRecoveredOrderPayment(orderSessionId: string) {
  return requestJson<CashdroPaymentResponse>(`/api/order-sessions/${encodeURIComponent(orderSessionId)}/cashdro/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export function getCashdroRecoveredOrderPayment(orderSessionId: string) {
  return requestJson<CashdroPaymentResponse>(`/api/order-sessions/${encodeURIComponent(orderSessionId)}/cashdro`);
}

export function cancelCashdroRecoveredOrderPayment(orderSessionId: string) {
  return requestJson<CashdroPaymentResponse>(`/api/order-sessions/${encodeURIComponent(orderSessionId)}/cashdro/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export function listPaymentDevices(locationId: string) {
  return requestJson<PaymentDeviceView[]>(`/api/payment-devices?locationId=${encodeURIComponent(locationId)}&activeOnly=true`);
}

export function createPaymentJob(input: {
  orderSessionId: string;
  locationId: string;
  deviceId: string;
  provider: 'cashdro' | 'artemis';
  idempotencyKey: string;
}) {
  return requestJson<PaymentJobView>('/api/payment-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function getPaymentJob(jobId: string) {
  return requestJson<PaymentJobView>(`/api/payment-jobs/${encodeURIComponent(jobId)}`);
}

export function buildCartKey(productId: string, modifierIds: string[], comments = ''): string {
  const modPart = modifierIds.length > 0 ? `::${[...modifierIds].sort().join(',')}` : '';
  const notePart = comments.trim() ? `::${comments.trim()}` : '';
  return `${productId}${modPart}${notePart}`;
}

export function getRestaurantLogo(config: KioskConfig | null | undefined): string | null {
  if (!config) return null;
  const c = config as Record<string, unknown>;
  const branding = (typeof c.branding === 'object' && c.branding !== null
    ? c.branding
    : {}) as Record<string, unknown>;
  return (
    (branding.logoUrl as string | undefined) ??
    (branding.restaurantLogoUrl as string | undefined) ??
    (c.restaurantLogoUrl as string | undefined) ??
    config.logoUrl ??
    null
  ) || null;
}

export function getRestaurantName(config: KioskConfig | null | undefined): string {
  return config?.restaurantName || 'Kiosko';
}
