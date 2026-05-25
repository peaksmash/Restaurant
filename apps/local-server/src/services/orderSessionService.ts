import { randomUUID } from 'node:crypto';
import { computeEstimatedReadyAt, type OperationalStatus, type OrderSession, type PaymentMode } from '@kiosk/types';
import { readRuntimeConfig } from '../config.js';
import {
  appendOrderSessionEvent,
  createOrderSession,
  generateRecoveryDataForOrderSession,
  getOrderSessionByExternalId,
  getOrderSessionById,
  listOrderSessionEvents,
  updateOrderSession,
  type OrderSessionRecord
} from '../db.js';
import { HttpError } from '../last-app.js';
import { resolveOrderSessionTableContext } from './tableQrMappingService.js';
import {
  isValidPaymentMode,
  validateOperationalStatus,
  validateOperationalStatusTransition,
  validateChannelPaymentMode,
  validateMoney,
  validateOrderChannel,
  validateOrderSessionItems
} from '../validators/orderSessionValidators.js';
import { upsertOperationalTicketFromOrderSession } from './operationalTicketService.js';

export interface CreateOrderSessionBody {
  externalId?: string;
  channel?: string;
  paymentMode?: PaymentMode;
  customer?: OrderSession['customer'];
  notes?: string | null;
  items?: OrderSession['items'];
  subtotal?: number;
  discountTotal?: number;
  total?: number;
  currency?: string;
  tableId?: string;
  lastTableId?: string;
  tableNameSnapshot?: string;
  source?: string | null;
  restaurantSlug?: string | null;
  preparationTimeMode?: OrderSession['preparationTimeMode'];
  suggestedPreparationMinutes?: number | null;
  confirmedPreparationMinutes?: number | null;
}

export async function createOrderSessionFromInput(body: CreateOrderSessionBody): Promise<OrderSessionRecord> {
  const config = readRuntimeConfig();
  const missingConfigFields = [
    ['organizationId', config.lastApp.organizationId],
    ['locationId', config.lastApp.locationId],
    ['brandId', config.lastApp.brandId],
    ['catalogId', config.lastApp.catalogId]
  ].filter(([, value]) => !value);

  if (missingConfigFields.length > 0) {
    throw new HttpError(409, 'Missing order session configuration', {
      code: 'order_session_config_invalid',
      missingFields: missingConfigFields.map(([field]) => field)
    });
  }

  const externalId = body?.externalId?.trim();
  if (!externalId) {
    throw new HttpError(400, 'Missing externalId', {
      missingFields: ['externalId']
    });
  }

  const existing = getOrderSessionByExternalId(externalId);
  if (existing) {
    return existing;
  }

  validateOrderChannel(body?.channel?.trim());
  const channel = body.channel.trim();

  const paymentMode = body?.paymentMode;
  if (!isValidPaymentMode(paymentMode)) {
    throw new HttpError(400, 'Invalid paymentMode', {
      code: 'payment_mode_invalid'
    });
  }

  validateChannelPaymentMode(channel, paymentMode);
  validateOrderSessionItems(body?.items);

  const subtotal = body?.subtotal;
  const discountTotal = body?.discountTotal;
  const total = body?.total;
  validateMoney(subtotal, 'subtotal');
  validateMoney(discountTotal, 'discountTotal');
  validateMoney(total, 'total');

  if ((subtotal as number) - (discountTotal as number) !== total) {
    throw new HttpError(400, 'Invalid total', {
      code: 'invalid_amount',
      field: 'total'
    });
  }

  const currency = body?.currency?.trim();
  if (!currency) {
    throw new HttpError(400, 'Missing currency', {
      missingFields: ['currency']
    });
  }

  const tableContext = await resolveOrderSessionTableContext(
    body?.tableId?.trim(),
    body?.lastTableId?.trim(),
    body?.tableNameSnapshot?.trim()
  );

  const timestamp = new Date().toISOString();
  const recoveryData =
    paymentMode === 'cashier' || paymentMode === 'kiosk'
      ? generateRecoveryDataForOrderSession(config.lastApp.locationId)
      : { pin4: null, qrToken: null };

  const expiresAt =
    paymentMode === 'cashier' || paymentMode === 'kiosk'
      ? new Date(Date.now() + 30 * 60_000).toISOString()
      : null;

  const confirmedPreparationMinutes = body?.confirmedPreparationMinutes ?? null;
  const suggestedPreparationMinutes = body?.suggestedPreparationMinutes ?? null;
  const estimatedReadyAt =
    typeof confirmedPreparationMinutes === 'number'
      ? computeEstimatedReadyAt(timestamp, confirmedPreparationMinutes)
      : null;

  const orderSession: OrderSessionRecord = {
    orderSessionId: randomUUID(),
    externalId,
    organizationId: config.lastApp.organizationId,
    locationId: config.lastApp.locationId,
    brandId: config.lastApp.brandId,
    catalogId: config.lastApp.catalogId,
    tableId: tableContext.tableId,
    lastTableId: tableContext.lastTableId,
    tableNameSnapshot: tableContext.tableNameSnapshot,
    channel,
    source: body?.source?.trim() || null,
    restaurantSlug: body?.restaurantSlug?.trim() || null,
    operationalStatus: 'pending',
    paymentStatus: 'unpaid',
    lastSyncStatus: 'not_sent',
    customer: body?.customer ?? null,
    notes: body?.notes ?? null,
    items: body.items,
    subtotal,
    discountTotal,
    total,
    currency,
    paymentMode,
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    pin4: recoveryData.pin4,
    qrToken: recoveryData.qrToken,
    expiresAt,
    preparationTimeMode: body?.preparationTimeMode ?? null,
    suggestedPreparationMinutes,
    confirmedPreparationMinutes,
    estimatedReadyAt,
    pickupTimeSyncedToLast: null,
    pickupTimeSyncStatus: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  createOrderSession(orderSession);
  appendOrderSessionEvent({
    orderSessionId: orderSession.orderSessionId,
    type: 'order_session_created',
    actorType: 'system',
    rawJson: {
      channel: orderSession.channel,
      paymentMode: orderSession.paymentMode
    }
  });

  if (orderSession.paymentMode === 'cashier' || orderSession.paymentMode === 'kiosk') {
    appendOrderSessionEvent({
      orderSessionId: orderSession.orderSessionId,
      type: 'recovery_created',
      actorType: 'system'
    });
  }

  return orderSession;
}

export interface UpdateOrderSessionStatusBody {
  operationalStatus?: OperationalStatus;
}

function sanitizeEventRawJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeEventRawJsonValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes('token') ||
      normalizedKey.includes('secret') ||
      normalizedKey.includes('authorization') ||
      normalizedKey.includes('password') ||
      normalizedKey.includes('idempotencykey')
    ) {
      next[key] = '[redacted]';
      continue;
    }

    next[key] = sanitizeEventRawJsonValue(entry);
  }

  return next;
}

export function updateOrderSessionOperationalStatus(
  orderSessionId: string,
  body: UpdateOrderSessionStatusBody
): OrderSessionRecord {
  const session = getOrderSessionById(orderSessionId);
  if (!session) {
    throw new HttpError(404, 'Order session not found', {
      code: 'session_not_found'
    });
  }

  validateOperationalStatus(body?.operationalStatus);
  const nextStatus = body.operationalStatus;

  if (session.paymentStatus !== 'paid') {
    throw new HttpError(409, 'Payment is required before updating status', {
      code: 'payment_required'
    });
  }

  if (session.lastSyncStatus !== 'sent' && session.lastSyncStatus !== 'sync_failed') {
    throw new HttpError(409, 'Order must be synced to Last before updating status', {
      code: 'sync_required'
    });
  }

  if (session.operationalStatus === nextStatus) {
    return session;
  }

  validateOperationalStatusTransition(session.operationalStatus, nextStatus);

  const next = updateOrderSession(orderSessionId, {
    operationalStatus: nextStatus
  });

  if (!next) {
    throw new HttpError(404, 'Order session not found', {
      code: 'session_not_found'
    });
  }

  appendOrderSessionEvent({
    orderSessionId: next.orderSessionId,
    type: 'order_status_updated',
    actorType: 'system',
    rawJson: {
      from: session.operationalStatus,
      to: nextStatus
    }
  });

  upsertOperationalTicketFromOrderSession(next);

  return next;
}

export function getOrderSessionEventsForRead(orderSessionId: string) {
  const session = getOrderSessionById(orderSessionId);
  if (!session) {
    throw new HttpError(404, 'Order session not found', {
      code: 'session_not_found'
    });
  }

  const events = listOrderSessionEvents(orderSessionId).map((event) => ({
    ...event,
    rawJson:
      event.rawJson && typeof event.rawJson === 'object'
        ? (sanitizeEventRawJsonValue(event.rawJson) as Record<string, unknown>)
        : event.rawJson ?? null
  }));

  return {
    orderSessionId,
    events
  };
}
