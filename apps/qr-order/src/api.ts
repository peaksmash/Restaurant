import { computeEstimatedReadyAt } from '@kiosk/types';
import type { CustomerInfo, OrderSession, OrderSessionItem, PaymentStatus, TableResolveResponse } from '@kiosk/types';

function resolveApiBase() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  return '/api';
}

const API_BASE = resolveApiBase();

// Temporary adapter to the current repo backend shape.
// Future contract target remains the documented GET /catalog/{catalogId}.
// The live repo today uses GET /api/config + GET /api/catalog-with-promotions
// with fallback to GET /api/catalog, just like kiosk-web.

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

export interface QrCartItem {
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

export type Customer = CustomerInfo;
export type QrPaymentMode = 'online' | 'cashier';

export interface OrderTotals {
  total?: number;
  discountTotal?: number;
  tax?: number;
}

export interface QrOrderResponse {
  orderCode: string;
  totals?: OrderTotals;
  estimatedReadyAt?: string;
  paymentMode: QrPaymentMode;
  paymentStatus: PaymentStatus;
  lastSyncStatus: 'not_sent' | 'sent' | 'sync_failed';
}

export const CONFIG_DEFAULTS = {
  theme: 'mcdonalds',
  modifiers: true,
  name: { enabled: true, required: true },
  notes: { generalEnabled: false, productCommentsEnabled: false },
} as const;

export function resolveConfig(raw: KioskConfig): KioskConfig {
  const kiosk = raw.kiosk;
  return {
    ...raw,
    kiosk: {
      ...kiosk,
      theme: kiosk.theme || CONFIG_DEFAULTS.theme,
      customerFields: {
        name: { enabled: true, required: true },
        phoneNumber: kiosk.customerFields?.phoneNumber ?? { enabled: false, required: false },
        email: kiosk.customerFields?.email ?? { enabled: false, required: false },
      },
      notes: kiosk.notes ?? CONFIG_DEFAULTS.notes,
      features: {
        modifiers: kiosk.features?.modifiers ?? CONFIG_DEFAULTS.modifiers,
        notes: kiosk.features?.notes ?? false,
        upselling: kiosk.features?.upselling ?? false,
        printTicket: kiosk.features?.printTicket ?? false,
      },
      payment: {
        mode: kiosk.payment?.mode ?? 'simulated',
        preferredPaymentMethod: kiosk.payment?.preferredPaymentMethod ?? 'Cash',
      },
    },
  };
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return body.error ?? body.message ?? fallback;
  } catch {
    return fallback;
  }
}

export async function fetchConfig(): Promise<KioskConfig> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error(await readApiError(res, `Error al cargar configuración (${res.status})`));
  const raw = (await res.json()) as KioskConfig;
  return resolveConfig(raw);
}

export async function fetchCatalog(): Promise<Catalog> {
  try {
    const res = await fetch(`${API_BASE}/catalog-with-promotions`);
    if (res.ok) {
      const data = (await res.json()) as { categories?: unknown[]; modifierGroups?: unknown[] };
      return {
        categories: (data.categories ?? []) as CatalogCategory[],
        modifierGroups: (data.modifierGroups ?? []) as ModifierGroup[],
      };
    }
  } catch {
    // fall through to plain catalog
  }

  const res = await fetch(`${API_BASE}/catalog`);
  if (!res.ok) throw new Error(await readApiError(res, `Error al cargar el catálogo (${res.status})`));
  const data = (await res.json()) as { categories?: unknown[]; modifierGroups?: unknown[] };
  return {
    categories: (data.categories ?? []) as CatalogCategory[],
    modifierGroups: (data.modifierGroups ?? []) as ModifierGroup[],
  };
}

export async function resolveTableByQrToken(qrToken: string): Promise<TableResolveResponse> {
  const res = await fetch(`${API_BASE}/tables/resolve/${encodeURIComponent(qrToken)}`);
  if (!res.ok) throw new Error(await readApiError(res, `Error al resolver la mesa (${res.status})`));
  return (await res.json()) as TableResolveResponse;
}

export interface SubmitQrOrderPayload {
  table: TableResolveResponse;
  customer: Customer;
  generalNotes: string;
  paymentMode: QrPaymentMode;
  items: QrCartItem[];
}

export interface CreateOrderSessionPayload extends SubmitQrOrderPayload {
  externalId: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  total: number;
}

export const QR_ORDER_REAL_CHECKOUT_ENABLED = false;
export const QR_ORDER_DEMO_CHECKOUT_ENABLED = import.meta.env.DEV && !QR_ORDER_REAL_CHECKOUT_ENABLED;

function buildOrderCode() {
  const value = Math.floor(1000 + Math.random() * 9000);
  return `DEMO-${value}`;
}

export async function submitQrOrderDemo(payload: SubmitQrOrderPayload): Promise<QrOrderResponse> {
  const total = payload.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const paymentStatus: PaymentStatus = payload.paymentMode === 'online' ? 'paid' : 'payment_pending';
  const hasSyncFailureDemo = payload.generalNotes.toLowerCase().includes('[sync-failed-demo]');

  return {
    orderCode: buildOrderCode(),
    totals: {
      total,
      discountTotal: 0,
      tax: 0,
    },
    estimatedReadyAt: computeEstimatedReadyAt(new Date(), 18),
    paymentMode: payload.paymentMode,
    paymentStatus,
    lastSyncStatus: paymentStatus === 'paid' && hasSyncFailureDemo ? 'sync_failed' : paymentStatus === 'paid' ? 'sent' : 'not_sent',
  };
}

function mapCartItemToOrderSessionItem(item: QrCartItem): OrderSessionItem {
  const promotion =
    item.promotion && item.promotion.id
      ? {
          promotionId: item.promotion.id,
          promotionName: item.promotion.name ?? item.promotion.label ?? 'Promoción',
          discountAmount: item.promotion.discountAmount ?? 0,
          id: item.promotion.id,
          name: item.promotion.name,
          label: item.promotion.label,
          discountType: item.promotion.discountType ?? null,
        }
      : null;

  return {
    id: item.cartKey,
    productId: item.productId,
    productName: item.name,
    type: item.type,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.unitPrice * item.quantity,
    notes: item.comments?.trim() || null,
    promotionId: item.promotionId ?? item.promotion?.id ?? null,
    promotion,
    modifiers: item.modifiers.map((modifier) => ({
      modifierId: modifier.id,
      modifierName: modifier.name,
      quantity: modifier.quantity,
      unitPrice: modifier.priceImpact,
      totalPrice: modifier.priceImpact * modifier.quantity,
    })),
  };
}

export async function createQrOrderSession(payload: CreateOrderSessionPayload): Promise<OrderSession> {
  const items = payload.items.map(mapCartItemToOrderSessionItem);

  const res = await fetch(`${API_BASE}/order-sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      externalId: payload.externalId,
      channel: 'qr_order',
      paymentMode: payload.paymentMode,
      customer: payload.customer,
      notes: payload.generalNotes.trim() || null,
      items,
      subtotal: payload.subtotal,
      discountTotal: payload.discountTotal,
      total: payload.total,
      currency: payload.currency,
      tableId: payload.table.tableId,
      lastTableId: payload.table.lastTableId,
      tableNameSnapshot: payload.table.tableName,
      suggestedPreparationMinutes: 18,
      estimatedReadyAt: computeEstimatedReadyAt(new Date(), 18),
    }),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res, `Error al crear la sesión de pedido (${res.status})`));
  }

  return (await res.json()) as OrderSession;
}

export function buildCartKey(productId: string, modifierIds: string[], comments = ''): string {
  const modPart = modifierIds.length > 0 ? `::${[...modifierIds].sort().join(',')}` : '';
  const notePart = comments.trim() ? `::${comments.trim()}` : '';
  return `${productId}${modPart}${notePart}`;
}

export function getRestaurantLogo(config: KioskConfig | null | undefined): string | null {
  if (!config) return null;
  const configRecord = config as Record<string, unknown>;
  const branding = (typeof configRecord.branding === 'object' && configRecord.branding !== null
    ? configRecord.branding
    : {}) as Record<string, unknown>;

  return (
    (branding.logoUrl as string | undefined) ??
    (branding.restaurantLogoUrl as string | undefined) ??
    (configRecord.restaurantLogoUrl as string | undefined) ??
    config.logoUrl ??
    null
  ) || null;
}

export function getRestaurantName(config: KioskConfig | null | undefined): string {
  return config?.restaurantName || 'Kiosko';
}
