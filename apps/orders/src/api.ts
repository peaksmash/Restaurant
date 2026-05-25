import type {
  OperationalTicket,
  OrderSession,
  PaymentMode,
  PaymentStatus,
  LastSyncStatus,
  Channel,
  OperationalStatus,
  OrderSessionEvent,
  PaymentDevice,
  PaymentJob,
  PrintJob
} from '@kiosk/types';
import type { CartaCategory, CartaProduct } from './mock/menu';
import type { OrdersSessionRecord } from './types';

function resolveApiBase() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return '';
}

const BASE = resolveApiBase();

export interface OrderSessionListResponse {
  items: OrderSession[];
  total: number;
  polledAt: string;
}

export interface ConfirmCashPaymentResponse {
  orderSession: OrderSession;
  lastSyncStatus: LastSyncStatus;
}

export interface RecoverOrderSessionResponse {
  orderSession: OrderSession;
  tableName: string | null;
}

export interface OrderSessionEventsResponse {
  orderSessionId: string;
  events: OrderSessionEvent[];
}

export interface CustomerFieldConfig {
  enabled: boolean;
  required: boolean;
}

export interface MiniKioskConfig {
  restaurantName: string;
  paymentsSimulated: boolean;
  logoUrl?: string;
  kiosk: {
    theme: string;
    source: string;
    pickupType: string;
    defaultOrderMode: 'takeAway' | 'eatIn' | 'delivery';
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

export interface MiniKioskModifier {
  id: string;
  name: string;
  priceImpact: number;
}

export interface MiniKioskModifierGroup {
  id: string;
  name: string;
  min?: number;
  max?: number;
  modifiers: MiniKioskModifier[];
}

export interface MiniKioskCatalog {
  categories: CartaCategory[];
  modifierGroups: MiniKioskModifierGroup[];
}

export interface CreateMiniKioskOrderSessionInput {
  externalId: string;
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
    promotion?: {
      promotionId: string;
      promotionName: string;
      discountAmount: number;
      discountType?: string | null;
      label?: string | null;
    } | null;
    modifiers: Array<{
      modifierGroupId: string;
      modifierOptionId: string;
      name: string;
      price: number;
      quantity?: number;
    }>;
  }>;
  subtotal: number;
  discountTotal: number;
  total: number;
  currency: string;
}

export interface SendToLastResponse {
  orderSession: OrderSession;
  lastOrderLink?: {
    lastTabId?: string | null;
    lastCode?: string | null;
  } | null;
  syncStatus: LastSyncStatus;
  error?: string;
}

export interface LastLiveOrdersResponse {
  items: Array<{
    id: string;
    tabId: string;
    externalId: string;
    channel: Channel;
    paymentMode: PaymentMode;
    operationalStatus: OperationalStatus;
    paymentStatus: 'paid';
    lastSyncStatus: 'sent';
    tableName: string | null;
    customerName: string | null;
    customerPhoneNumber: string | null;
    notes: string | null;
    source: string | null;
    pickupType: string | null;
    pickupTime: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    total: number;
    items: Array<{
      id: string;
      productId: string;
      productName: string;
      type: 'PRODUCT' | 'COMBO';
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      notes: string | null;
      modifiers: Array<{
        modifierId: string;
        modifierName: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
    }>;
  }>;
}

export interface PaymentDeviceView extends PaymentDevice {
  queueState: {
    running: boolean;
    queued: number;
  };
}

export interface PaymentJobView extends PaymentJob {}

export interface OperationalTicketView extends OperationalTicket {}

export interface OperationalTicketsResponse {
  items: OperationalTicketView[];
  polledAt: string;
}

export interface OperationalTicketDetailResponse {
  ticket: OperationalTicketView;
  previewSvg: string;
}

export interface PrintTicketResponse {
  ticket: OperationalTicketView;
  printJob: PrintJob;
  mode: string;
  previewSvg: string;
  previewHtml: string | null;
  reused: boolean;
  message: string;
}

export type UpdateOrderStatusResponse = OrderSession;

export interface ListOrderSessionsParams {
  active?: boolean;
  since?: string;
  limit?: number;
  paymentStatus?: PaymentStatus;
  lastSyncStatus?: LastSyncStatus;
  channel?: Channel;
  paymentMode?: PaymentMode;
}

export interface ListOperationalTicketsParams {
  source?: OperationalTicket['source'];
  printStatus?: OperationalTicket['printStatus'];
  since?: string;
  activeOnly?: boolean;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error ?? body.message ?? fallback;
  } catch {
    return fallback;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('No se pudo conectar con el backend real.');
    }
    throw error;
  }
  if (!response.ok) {
    throw new Error(await readError(response, `Error ${response.status} en ${path}`));
  }
  return response.json() as Promise<T>;
}

function buildQuery(params: ListOrderSessionsParams) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }

  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

export function getOrderSessions(params: ListOrderSessionsParams) {
  return requestJson<OrderSessionListResponse>(`/api/order-sessions${buildQuery(params)}`);
}

export function getOrderSession(orderSessionId: string) {
  return requestJson<OrderSession>(`/api/order-sessions/${encodeURIComponent(orderSessionId)}`);
}

export function recoverOrderSession(tokenOrCode: string) {
  return requestJson<RecoverOrderSessionResponse>(`/api/order-sessions/recovery/${encodeURIComponent(tokenOrCode)}`);
}

export function confirmCashPayment(orderSessionId: string, amountReceived: number, idempotencyKey: string) {
  return requestJson<ConfirmCashPaymentResponse>(
    `/api/order-sessions/${encodeURIComponent(orderSessionId)}/confirm-payment`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMode: 'cashier',
        paymentProvider: 'cash',
        amountReceived,
        idempotencyKey,
      }),
    },
  );
}

export function sendOrderSessionToLast(orderSessionId: string) {
  return requestJson<SendToLastResponse>(
    `/api/order-sessions/${encodeURIComponent(orderSessionId)}/send-to-last`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    },
  );
}

export function updateOrderSessionStatus(orderSessionId: string, operationalStatus: OperationalStatus) {
  return requestJson<UpdateOrderStatusResponse>(
    `/api/order-sessions/${encodeURIComponent(orderSessionId)}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationalStatus }),
    },
  );
}

export function getOrderSessionEvents(orderSessionId: string) {
  return requestJson<OrderSessionEventsResponse>(
    `/api/order-sessions/${encodeURIComponent(orderSessionId)}/events`,
  );
}

function normalizeLiveLastOrder(order: LastLiveOrdersResponse['items'][number]): OrdersSessionRecord {
  return {
    recordType: 'last_live',
    liveTabId: order.tabId,
    orderSessionId: order.tabId,
    externalId: order.externalId,
    organizationId: '',
    locationId: '',
    brandId: '',
    catalogId: '',
    tableId: null,
    lastTableId: null,
    tableNameSnapshot: order.tableName,
    tableName: order.tableName,
    channel: order.channel,
    source: order.source,
    restaurantSlug: null,
    operationalStatus: order.operationalStatus,
    paymentStatus: order.paymentStatus,
    lastSyncStatus: order.lastSyncStatus,
    customer: {
      name: order.customerName,
      phoneNumber: order.customerPhoneNumber,
      surname: null,
      email: null,
    },
    notes: order.notes,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      type: item.type,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      notes: item.notes,
      modifiers: item.modifiers,
      promotionId: null,
      promotion: null,
    })),
    subtotal: order.total,
    discountTotal: 0,
    total: order.total,
    currency: 'EUR',
    paymentMode: order.paymentMode,
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    pin4: null,
    qrToken: null,
    expiresAt: null,
    preparationTimeMode: null,
    suggestedPreparationMinutes: null,
    confirmedPreparationMinutes: null,
    estimatedReadyAt: order.pickupTime,
    pickupTimeSyncedToLast: order.pickupTime,
    pickupTimeSyncStatus: null,
    createdAt: order.createdAt ?? new Date().toISOString(),
    updatedAt: order.updatedAt ?? order.createdAt ?? new Date().toISOString(),
    acceptedAt: null,
    readyAt: order.operationalStatus === 'ready' || order.operationalStatus === 'delivered' ? order.pickupTime : null,
    sourceLabel: order.source,
    pickupTypeLabel: order.pickupType,
  };
}

export async function updateLiveLastOrderStatus(tabId: string, operationalStatus: OperationalStatus) {
  const response = await requestJson<LastLiveOrdersResponse['items'][number]>(
    `/api/last/live-orders/${encodeURIComponent(tabId)}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationalStatus }),
    },
  );
  return normalizeLiveLastOrder(response);
}

export function getMiniKioskConfig() {
  return requestJson<MiniKioskConfig>('/api/config');
}

export async function getMiniKioskCatalog(): Promise<MiniKioskCatalog> {
  try {
    const enriched = await requestJson<{ categories?: CartaCategory[]; modifierGroups?: MiniKioskModifierGroup[] }>(
      '/api/catalog-with-promotions',
    );
    return {
      categories: (enriched.categories ?? []).map((category) => ({
        ...category,
        enabled: category.enabled ?? true,
        products: (category.products ?? []).map((product) => ({
          ...product,
          enabled: product.enabled ?? true,
          type: product.type ?? 'PRODUCT',
        })),
      })),
      modifierGroups: enriched.modifierGroups ?? [],
    };
  } catch {
    const plain = await requestJson<{ categories?: CartaCategory[]; modifierGroups?: MiniKioskModifierGroup[] }>(
      '/api/catalog',
    );
    return {
      categories: (plain.categories ?? []).map((category) => ({
        ...category,
        enabled: category.enabled ?? true,
        products: (category.products ?? []).map((product) => ({
          ...product,
          enabled: product.enabled ?? true,
          type: product.type ?? 'PRODUCT',
        })),
      })),
      modifierGroups: plain.modifierGroups ?? [],
    };
  }
}

export function createMiniKioskOrderSession(input: CreateMiniKioskOrderSessionInput) {
  return requestJson<OrderSession>('/api/order-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      externalId: input.externalId,
      channel: 'manual',
      paymentMode: 'cashier',
      customer: null,
      notes: input.notes ?? null,
      items: input.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        type: item.type,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        notes: item.notes ?? null,
        promotionId: item.promotionId ?? null,
        promotion: null,
        modifiers: item.modifiers.map((modifier) => ({
          modifierId: modifier.modifierOptionId,
          modifierName: modifier.name,
          quantity: modifier.quantity ?? 1,
          unitPrice: modifier.price,
          totalPrice: modifier.price * (modifier.quantity ?? 1),
        })),
      })),
      subtotal: input.subtotal,
      discountTotal: input.discountTotal,
      total: input.total,
      currency: input.currency,
      tableId: null,
      lastTableId: null,
      tableNameSnapshot: null,
    }),
  });
}

export function getPaymentDevices(locationId: string) {
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

export async function getOperationalTickets(params: ListOperationalTicketsParams = {}) {
  const search = new URLSearchParams();
  if (params.source) search.set('source', params.source);
  if (params.printStatus) search.set('printStatus', params.printStatus);
  if (params.since) search.set('since', params.since);
  if (typeof params.activeOnly === 'boolean') search.set('activeOnly', String(params.activeOnly));
  const suffix = search.toString() ? `?${search.toString()}` : '';
  const response = await requestJson<OperationalTicketsResponse>(`/api/operational-tickets${suffix}`);
  return response.items;
}

export function getOperationalTicket(ticketId: string) {
  return requestJson<OperationalTicketDetailResponse>(`/api/operational-tickets/${encodeURIComponent(ticketId)}`);
}

export function markOperationalTicketSoundPlayed(ticketId: string) {
  return requestJson<{ ticket: OperationalTicketView }>(`/api/operational-tickets/${encodeURIComponent(ticketId)}/sound-played`, {
    method: 'POST',
  });
}

export function printOperationalTicket(ticketId: string, force = false) {
  return requestJson<PrintTicketResponse>(`/api/operational-tickets/${encodeURIComponent(ticketId)}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: force ? JSON.stringify({ force: true }) : JSON.stringify({}),
  });
}

export function getOperationalTicketPreview(ticketId: string) {
  return requestJson<{ ticket: OperationalTicketView; previewSvg: string }>(
    `/api/operational-tickets/${encodeURIComponent(ticketId)}`
  );
}

export function reprintOperationalTicket(ticketId: string) {
  return requestJson<PrintTicketResponse>(`/api/operational-tickets/${encodeURIComponent(ticketId)}/reprint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}
