import type {
  LastSyncStatus,
  OperationalStatus,
  OrderChannel,
  OrderSession,
  PaymentMode,
  PaymentStatus,
} from '@kiosk/types';
import type { OrdersSessionRecord } from '../types';

export type MockOrderRecord = OrdersSessionRecord;

function buildOrder(overrides: Partial<MockOrderRecord>): MockOrderRecord {
  const base: MockOrderRecord = {
    recordType: 'order_session',
    liveTabId: null,
    orderSessionId: 'ord-base',
    externalId: 'Q-BASE',
    organizationId: 'org-demo',
    locationId: 'loc-demo',
    brandId: 'brand-demo',
    catalogId: 'catalog-demo',
    tableId: 'mapping-demo',
    lastTableId: 'last-table-demo',
    tableNameSnapshot: 'T1',
    operationalStatus: 'pending',
    paymentStatus: 'unpaid',
    lastSyncStatus: 'not_sent',
    items: [
      {
        id: 'item-base',
        productId: 'prod-base',
        productName: 'Burger clásica',
        type: 'PRODUCT',
        quantity: 1,
        unitPrice: 1290,
        totalPrice: 1290,
        modifiers: [],
      },
    ],
    paymentMode: 'online',
    channel: 'qr_order',
    customer: { name: 'Cliente demo' },
    notes: null,
    pin4: null,
    qrToken: null,
    expiresAt: null,
    subtotal: 1290,
    discountTotal: 0,
    total: 1290,
    currency: 'EUR',
    createdAt: '2026-05-18T11:00:00.000Z',
    updatedAt: '2026-05-18T11:00:00.000Z',
    preparationTimeMode: 'auto',
    suggestedPreparationMinutes: 12,
    confirmedPreparationMinutes: null,
    estimatedReadyAt: '2026-05-18T11:12:00.000Z',
    pickupTimeSyncedToLast: null,
    pickupTimeSyncStatus: 'pending',
    source: null,
    restaurantSlug: null,
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    tableName: 'T1',
    sourceLabel: null,
    pickupTypeLabel: null,
  };

  return {
    ...base,
    ...overrides,
    customer: overrides.customer ?? base.customer,
    items: overrides.items ?? base.items,
  };
}

export const MOCK_ORDERS: MockOrderRecord[] = [
  buildOrder({
    orderSessionId: 'ord-1001',
    externalId: 'Q-1001',
    operationalStatus: 'pending',
    paymentStatus: 'paid',
    lastSyncStatus: 'sent',
    paymentMode: 'online',
    channel: 'qr_order',
    pin4: null,
    tableName: 'T1',
    tableNameSnapshot: 'T1',
    customer: { name: 'Marta' },
    stripePaymentIntentId: 'pi_mock_1001',
    stripeCheckoutSessionId: 'cs_mock_1001',
    createdAt: '2026-05-18T12:01:00.000Z',
    updatedAt: '2026-05-18T12:01:30.000Z',
    estimatedReadyAt: '2026-05-18T12:15:00.000Z',
  }),
  buildOrder({
    orderSessionId: 'ord-1002',
    externalId: 'Q-1002',
    operationalStatus: 'accepted',
    paymentStatus: 'paid',
    lastSyncStatus: 'sent',
    paymentMode: 'online',
    channel: 'qr_order',
    pin4: null,
    tableName: 'T2',
    tableNameSnapshot: 'T2',
    customer: { name: 'Raúl' },
    stripePaymentIntentId: 'pi_mock_1002',
    stripeCheckoutSessionId: 'cs_mock_1002',
    createdAt: '2026-05-18T11:58:00.000Z',
    updatedAt: '2026-05-18T12:03:00.000Z',
    acceptedAt: '2026-05-18T12:00:00.000Z',
    estimatedReadyAt: '2026-05-18T12:14:00.000Z',
  }),
  buildOrder({
    orderSessionId: 'ord-1003',
    externalId: 'Q-1003',
    operationalStatus: 'preparing',
    paymentStatus: 'paid',
    lastSyncStatus: 'sent',
    paymentMode: 'online',
    channel: 'qr_order',
    pin4: null,
    tableName: 'T3',
    tableNameSnapshot: 'T3',
    customer: { name: 'Lucía' },
    stripePaymentIntentId: 'pi_mock_1003',
    stripeCheckoutSessionId: 'cs_mock_1003',
    createdAt: '2026-05-18T11:50:00.000Z',
    updatedAt: '2026-05-18T12:04:00.000Z',
    acceptedAt: '2026-05-18T11:55:00.000Z',
    estimatedReadyAt: '2026-05-18T12:10:00.000Z',
  }),
  buildOrder({
    orderSessionId: 'ord-1004',
    externalId: 'Q-1004',
    operationalStatus: 'ready',
    paymentStatus: 'paid',
    lastSyncStatus: 'sent',
    paymentMode: 'online',
    channel: 'qr_order',
    pin4: null,
    tableName: 'T2',
    tableNameSnapshot: 'T2',
    customer: { name: 'Sofía' },
    stripePaymentIntentId: 'pi_mock_1004',
    stripeCheckoutSessionId: 'cs_mock_1004',
    createdAt: '2026-05-18T11:35:00.000Z',
    updatedAt: '2026-05-18T12:00:00.000Z',
    acceptedAt: '2026-05-18T11:40:00.000Z',
    readyAt: '2026-05-18T11:58:00.000Z',
    estimatedReadyAt: '2026-05-18T11:58:00.000Z',
  }),
  buildOrder({
    orderSessionId: 'ord-1005',
    externalId: 'Q-1005',
    operationalStatus: 'pending',
    paymentStatus: 'unpaid',
    lastSyncStatus: 'not_sent',
    paymentMode: 'cashier',
    channel: 'qr_order',
    pin4: '5501',
    qrToken: 'rescue_mock_1005',
    expiresAt: '2026-05-18T12:35:00.000Z',
    tableName: 'T1',
    tableNameSnapshot: 'T1',
    customer: { name: 'Aitana' },
    subtotal: 2140,
    total: 2140,
    createdAt: '2026-05-18T12:05:00.000Z',
    updatedAt: '2026-05-18T12:05:00.000Z',
  }),
  buildOrder({
    orderSessionId: 'ord-1006',
    externalId: 'Q-1006',
    operationalStatus: 'pending',
    paymentStatus: 'unpaid',
    lastSyncStatus: 'not_sent',
    paymentMode: 'cashier',
    channel: 'qr_order',
    pin4: '7719',
    qrToken: 'rescue_mock_1006',
    expiresAt: '2026-05-18T12:37:00.000Z',
    tableName: 'T3',
    tableNameSnapshot: 'T3',
    customer: { name: 'Iván' },
    createdAt: '2026-05-18T12:07:00.000Z',
    updatedAt: '2026-05-18T12:07:00.000Z',
  }),
  buildOrder({
    orderSessionId: 'ord-1007',
    externalId: 'Q-1007',
    operationalStatus: 'accepted',
    paymentStatus: 'paid',
    lastSyncStatus: 'sync_failed',
    paymentMode: 'cashier',
    channel: 'qr_order',
    pin4: '4410',
    qrToken: 'rescue_mock_1007',
    expiresAt: '2026-05-18T12:14:00.000Z',
    tableName: 'T2',
    tableNameSnapshot: 'T2',
    customer: { name: 'Pablo' },
    createdAt: '2026-05-18T11:44:00.000Z',
    updatedAt: '2026-05-18T12:06:00.000Z',
  }),
  buildOrder({
    orderSessionId: 'ord-1008',
    externalId: 'Q-1008',
    operationalStatus: 'pending',
    paymentStatus: 'paid',
    lastSyncStatus: 'sync_failed',
    paymentMode: 'online',
    channel: 'qr_order',
    pin4: null,
    tableName: 'T1',
    tableNameSnapshot: 'T1',
    customer: { name: 'Carla' },
    stripePaymentIntentId: 'pi_mock_1008',
    stripeCheckoutSessionId: 'cs_mock_1008',
    createdAt: '2026-05-18T11:42:00.000Z',
    updatedAt: '2026-05-18T12:02:00.000Z',
  }),
  buildOrder({
    orderSessionId: 'ord-1009',
    externalId: 'K-1009',
    operationalStatus: 'preparing',
    paymentStatus: 'paid',
    lastSyncStatus: 'sent',
    paymentMode: 'kiosk',
    channel: 'kiosk',
    pin4: '2861',
    qrToken: 'rescue_mock_1009',
    expiresAt: '2026-05-18T12:56:00.000Z',
    tableName: 'Mostrador',
    tableNameSnapshot: 'Mostrador',
    customer: { name: 'Luis' },
    createdAt: '2026-05-18T11:56:00.000Z',
    updatedAt: '2026-05-18T12:08:00.000Z',
  }),
  buildOrder({
    orderSessionId: 'ord-1010',
    externalId: 'M-1010',
    operationalStatus: 'pending',
    paymentStatus: 'paid',
    lastSyncStatus: 'sent',
    paymentMode: 'staff_internal',
    channel: 'manual',
    pin4: null,
    tableName: 'Barra',
    tableNameSnapshot: 'Barra',
    customer: { name: 'Staff' },
    createdAt: '2026-05-18T12:00:00.000Z',
    updatedAt: '2026-05-18T12:08:30.000Z',
  }),
  buildOrder({
    orderSessionId: 'ord-1011',
    externalId: 'Q-1011',
    operationalStatus: 'delivered',
    paymentStatus: 'paid',
    lastSyncStatus: 'sent',
    paymentMode: 'online',
    channel: 'qr_order',
    pin4: null,
    tableName: 'T3',
    tableNameSnapshot: 'T3',
    customer: { name: 'Elena' },
    stripePaymentIntentId: 'pi_mock_1011',
    stripeCheckoutSessionId: 'cs_mock_1011',
    createdAt: '2026-05-18T10:50:00.000Z',
    updatedAt: '2026-05-18T11:30:00.000Z',
    readyAt: '2026-05-18T11:12:00.000Z',
  }),
  buildOrder({
    orderSessionId: 'ord-1012',
    externalId: 'Q-1012',
    operationalStatus: 'cancelled',
    paymentStatus: 'payment_failed',
    lastSyncStatus: 'not_sent',
    paymentMode: 'online',
    channel: 'qr_order',
    pin4: null,
    tableName: 'T1',
    tableNameSnapshot: 'T1',
    customer: { name: 'Nora' },
    createdAt: '2026-05-18T11:10:00.000Z',
    updatedAt: '2026-05-18T11:14:00.000Z',
  }),
];

export function isKitchenStatus(status: OperationalStatus) {
  return status === 'accepted' || status === 'preparing';
}

export function isIncidentOrder(order: MockOrderRecord) {
  return order.paymentStatus === 'paid' && order.lastSyncStatus === 'sync_failed';
}

export function isCashierRescue(order: MockOrderRecord) {
  return (
    order.paymentStatus === 'unpaid' &&
    order.lastSyncStatus === 'not_sent'
  );
}

export function formatChannelLabel(channel: OrderChannel) {
  const labels: Record<OrderChannel, string> = {
    qr_order: 'QR mesa',
    kiosk: 'Kiosko',
    pos: 'POS',
    uber: 'Uber',
    glovo: 'Glovo',
    deliveroo: 'Deliveroo',
    just_eat: 'Just Eat',
    manual: 'Comandero',
  };
  return labels[channel];
}

export function resolveDisplayChannel(order: Pick<OrdersSessionRecord, 'channel' | 'source' | 'sourceLabel' | 'tableName' | 'tableNameSnapshot'>): OrderChannel {
  const normalized = `${order.sourceLabel ?? order.source ?? ''}`.trim().toLowerCase();

  if (normalized.includes('glovo')) return 'glovo';
  if (normalized.includes('uber')) return 'uber';
  if (normalized.includes('deliveroo')) return 'deliveroo';
  if (normalized.includes('just eat') || normalized.includes('justeat')) return 'just_eat';
  if (normalized.includes('kiosk')) return 'kiosk';
  if (normalized.includes('website') || normalized.includes('mywebsite') || normalized.includes('shop')) {
    return order.tableName || order.tableNameSnapshot ? 'qr_order' : 'kiosk';
  }
  if (normalized.includes('restaurant') || normalized.includes('staff') || normalized.includes('waiter')) {
    return 'manual';
  }

  return order.channel;
}

export function formatPaymentModeLabel(mode: PaymentMode) {
  const labels: Record<PaymentMode, string> = {
    online: 'Pago online',
    kiosk: 'Kiosko',
    cashier: 'Efectivo',
    staff_internal: 'Interno',
  };
  return labels[mode];
}

export function formatPaymentStatusLabel(status: PaymentStatus) {
  const labels: Record<PaymentStatus, string> = {
    unpaid: 'Pendiente de pago',
    payment_pending: 'Pago pendiente',
    paid: 'Pagado',
    payment_failed: 'Pago fallido',
    refunded: 'Reembolsado',
  };
  return labels[status];
}

export function formatSyncStatusLabel(status: LastSyncStatus) {
  const labels: Record<LastSyncStatus, string> = {
    not_sent: 'Pendiente de envio',
    sent: 'Enviado',
    sync_failed: 'Incidencia de envio',
  };
  return labels[status];
}

export function formatPrintStatusLabel(status: OrdersSessionRecord['printStatus']) {
  switch (status) {
    case 'not_queued':
      return 'Comanda lista para imprimir';
    case 'pending':
      return 'Pendiente de impresión';
    case 'printing':
      return 'Imprimiendo';
    case 'printed':
      return 'Impresa';
    case 'failed':
      return 'Impresora no configurada';
    case 'cancelled':
      return 'Impresión cancelada';
    default:
      return 'Sin impresión';
  }
}

export function formatOperationalStatusLabel(status: OperationalStatus) {
  const labels: Record<OperationalStatus, string> = {
    pending: 'Nuevo',
    accepted: 'Aceptado',
    preparing: 'En cocina',
    ready: 'Listo',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  };
  return labels[status];
}

export function isVisibleOperationalOrder(order: MockOrderRecord) {
  return (
    order.paymentStatus === 'paid' &&
    order.lastSyncStatus === 'sent' &&
    ['pending', 'accepted', 'preparing', 'ready'].includes(order.operationalStatus)
  );
}

export function isKitchenOrder(order: MockOrderRecord) {
  return (
    order.paymentStatus === 'paid' &&
    order.lastSyncStatus === 'sent' &&
    isKitchenStatus(order.operationalStatus)
  );
}
