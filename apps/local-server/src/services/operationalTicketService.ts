import { createHash, randomUUID } from 'node:crypto';
import type { Channel, OperationalTicket, OperationalTicketItem, OperationalTicketModifier, OrderSession, OrderSource, PrintStatus, SoundPolicy } from '@kiosk/types';
import {
  countOperationalTicketsBySourceAndDay,
  createOperationalTicket,
  getLastOrderLinkByOrderSessionId,
  getOperationalTicketById,
  getOperationalTicketByLastTabId,
  getOperationalTicketByOrderSessionId,
  getOperationalTicketByRawSourceHash,
  listOperationalTickets as listOperationalTicketRecords,
  updateOperationalTicket,
  type OperationalTicketRecord,
} from '../db.js';
import type { LastLiveOrderRecord } from './lastLiveOrdersService.js';

const SOURCE_META: Record<OrderSource, { label: string; prefix: string; sound: SoundPolicy }> = {
  qr_order: { label: 'QR Mesa', prefix: 'Q', sound: 'sound' },
  kiosk: { label: 'Kiosko', prefix: 'K', sound: 'sound' },
  manual: { label: 'Manual', prefix: 'M', sound: 'sound' },
  pos: { label: 'Last POS', prefix: 'P', sound: 'silent' },
  last_pos: { label: 'Last POS', prefix: 'P', sound: 'silent' },
  glovo: { label: 'Glovo', prefix: 'G', sound: 'silent' },
  uber: { label: 'Uber', prefix: 'U', sound: 'silent' },
  deliveroo: { label: 'Deliveroo', prefix: 'D', sound: 'silent' },
  just_eat: { label: 'Just Eat', prefix: 'J', sound: 'silent' },
  unknown: { label: 'Desconocido', prefix: 'X', sound: 'silent' },
};

function startOfDayIso(value: string) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function nextDayIso(value: string) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

function resolveOrderSource(channel: Channel | string | null | undefined, source: string | null | undefined): OrderSource {
  const normalizedChannel = (channel ?? '').trim().toLowerCase();
  const normalizedSource = (source ?? '').trim().toLowerCase();

  if (normalizedChannel === 'qr_order') return 'qr_order';
  if (normalizedChannel === 'kiosk') return 'kiosk';
  if (normalizedChannel === 'manual') return 'manual';
  if (normalizedChannel === 'pos') return 'pos';
  if (normalizedChannel === 'glovo') return 'glovo';
  if (normalizedChannel === 'uber') return 'uber';
  if (normalizedChannel === 'deliveroo') return 'deliveroo';
  if (normalizedChannel === 'just_eat') return 'just_eat';

  if (normalizedSource.includes('glovo')) return 'glovo';
  if (normalizedSource.includes('uber')) return 'uber';
  if (normalizedSource.includes('deliveroo')) return 'deliveroo';
  if (normalizedSource.includes('just eat') || normalizedSource.includes('justeat')) return 'just_eat';
  if (normalizedSource.includes('website') || normalizedSource.includes('mywebsite')) return 'qr_order';
  if (normalizedSource.includes('kiosk')) return 'kiosk';
  if (normalizedSource.includes('pos')) return 'last_pos';
  if (normalizedSource.includes('restaurant') || normalizedSource.includes('waiter') || normalizedSource.includes('staff')) return 'manual';

  return 'unknown';
}

/**
 * Normaliza la cantidad visible de un item según su tipo de promoción.
 * Solo actúa sobre promotionDiscountType === '2x1'.
 * No recalcula precios ni totales. No altera quantity original.
 */
function normalizeTicketPromotions(items: OperationalTicketItem[]): OperationalTicketItem[] {
  return items.map((item) => {
    const originalQuantity = item.quantity;

    if (item.promotionDiscountType === '2x1') {
      const isOdd = originalQuantity % 2 !== 0;
      const displayedQuantity = isOdd ? originalQuantity + 1 : originalQuantity;
      const hasPromotionAdjustment = isOdd;
      return {
        ...item,
        originalQuantity,
        displayedQuantity,
        hasPromotionAdjustment,
      };
    }

    return {
      ...item,
      originalQuantity,
      displayedQuantity: originalQuantity,
      hasPromotionAdjustment: false,
    };
  });
}

function mapOrderSessionItems(items: OrderSession['items']): OperationalTicketItem[] {
  const mapped = items.map((item) => {
    const modifiers: OperationalTicketModifier[] = item.modifiers.map((modifier) => ({
      name: modifier.modifierName,
      quantity: modifier.quantity,
      unitPrice: modifier.unitPrice,
      totalPrice: modifier.totalPrice,
    }));

    const promotionLabel = item.promotion?.label ?? item.promotion?.promotionName ?? null;
    const promotionDiscountType = item.promotion?.discountType ?? null;

    return {
      name: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      modifiers,
      notes: item.notes ?? null,
      promotionLabel: promotionLabel ?? null,
      promotionDiscountType: promotionDiscountType ?? null,
      hasPromotionAdjustment: Boolean(item.promotionId),
    };
  });

  return normalizeTicketPromotions(mapped);
}

function mapLastOrderItems(items: LastLiveOrderRecord['items']): OperationalTicketItem[] {
  return items.map((item) => {
    const modifiers: OperationalTicketModifier[] = item.modifiers.map((modifier) => ({
      name: modifier.modifierName,
      quantity: modifier.quantity,
      unitPrice: modifier.unitPrice,
      totalPrice: modifier.totalPrice,
    }));

    return {
      name: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      modifiers,
      notes: item.notes ?? null,
      // Last does not expose per-item promotion metadata
      promotionLabel: null,
      promotionDiscountType: null,
      hasPromotionAdjustment: false,
    };
  });
}

function buildLastOrderHash(lastOrder: LastLiveOrderRecord) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        tabId: lastOrder.tabId,
        externalId: lastOrder.externalId,
        source: lastOrder.source,
        total: lastOrder.total,
        createdAt: lastOrder.createdAt,
      })
    )
    .digest('hex');
}

function buildOperationalTicketRecord(input: Omit<OperationalTicketRecord, 'ticketId' | 'displayNumber' | 'createdAt' | 'updatedAt'> & {
  ticketId?: string;
  displayNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}) {
  const timestamp = input.updatedAt ?? new Date().toISOString();
  return {
    ticketId: input.ticketId ?? randomUUID(),
    displayNumber: input.displayNumber ?? '',
    source: input.source,
    sourceLabel: input.sourceLabel,
    orderSessionId: input.orderSessionId ?? null,
    lastTabId: input.lastTabId ?? null,
    lastCode: input.lastCode ?? null,
    externalOrderId: input.externalOrderId ?? null,
    tableName: input.tableName ?? null,
    customerName: input.customerName ?? null,
    items: input.items,
    notes: input.notes ?? null,
    subtotal: input.subtotal ?? null,
    discountTotal: input.discountTotal ?? null,
    total: input.total ?? null,
    currency: input.currency ?? null,
    estimatedReadyAt: input.estimatedReadyAt ?? null,
    paid: input.paid,
    operationalStatus: input.operationalStatus,
    printStatus: input.printStatus,
    soundPolicy: input.soundPolicy,
    soundPlayedAt: input.soundPlayedAt ?? null,
    firstSeenAt: input.firstSeenAt,
    lastSeenAt: input.lastSeenAt,
    rawSourceHash: input.rawSourceHash ?? null,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export function buildDisplayNumber(source: OrderSource, createdAt: string) {
  const meta = SOURCE_META[source] ?? SOURCE_META.unknown;
  const dayStart = startOfDayIso(createdAt);
  const dayEnd = nextDayIso(createdAt);
  const count = countOperationalTicketsBySourceAndDay(source, dayStart, dayEnd) + 1;
  return `${meta.prefix}-${String(count).padStart(3, '0')}`;
}

function normalizeCodeSegment(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '')
    .replace(/^[A-Za-z]-/, '')
    .replace(/^[A-Za-z]+-/, '');
}

function buildDisplayNumberFromCode(source: OrderSource, code: string | null | undefined) {
  if (!code) {
    return null;
  }

  const normalizedCode = normalizeCodeSegment(code);
  if (!normalizedCode) {
    return null;
  }

  const meta = SOURCE_META[source] ?? SOURCE_META.unknown;
  return `${meta.prefix}-${normalizedCode}`;
}

export function normalizeOrderSessionToTicket(session: OrderSession) {
  const source = resolveOrderSource(session.channel, session.source);
  const meta = SOURCE_META[source];
  const lastLink = getLastOrderLinkByOrderSessionId(session.orderSessionId);
  const existing = getOperationalTicketByOrderSessionId(session.orderSessionId);
  const preferredDisplayNumber =
    buildDisplayNumberFromCode(source, lastLink?.lastCode ?? null) ??
    (existing?.displayNumber ?? buildDisplayNumber(source, session.createdAt));

  return buildOperationalTicketRecord({
    ticketId: existing?.ticketId,
    displayNumber: preferredDisplayNumber,
    source,
    sourceLabel: meta.label,
    orderSessionId: session.orderSessionId,
    lastTabId: lastLink?.lastTabId ?? existing?.lastTabId ?? null,
    lastCode: lastLink?.lastCode ?? existing?.lastCode ?? null,
    externalOrderId: session.externalId,
    tableName: session.tableNameSnapshot ?? null,
    customerName: session.customer?.name ?? null,
    items: mapOrderSessionItems(session.items),
    notes: session.notes ?? null,
    subtotal: session.subtotal,
    discountTotal: session.discountTotal,
    total: session.total,
    currency: session.currency,
    estimatedReadyAt: session.estimatedReadyAt ?? null,
    paid: session.paymentStatus === 'paid',
    operationalStatus: session.operationalStatus,
    printStatus: existing?.printStatus ?? 'not_queued',
    soundPolicy: meta.sound,
    soundPlayedAt: existing?.soundPlayedAt ?? null,
    firstSeenAt: existing?.firstSeenAt ?? session.updatedAt,
    lastSeenAt: new Date().toISOString(),
    rawSourceHash: existing?.rawSourceHash ?? null,
    createdAt: existing?.createdAt ?? session.createdAt,
    updatedAt: session.updatedAt,
  });
}

export function normalizeLastOrderToTicket(lastOrder: LastLiveOrderRecord) {
  const source = resolveOrderSource(lastOrder.channel, lastOrder.source);
  const meta = SOURCE_META[source];
  const rawSourceHash = buildLastOrderHash(lastOrder);
  const existing =
    getOperationalTicketByLastTabId(lastOrder.tabId) ??
    getOperationalTicketByRawSourceHash(rawSourceHash);
  const preferredDisplayNumber =
    buildDisplayNumberFromCode(source, lastOrder.externalId) ??
    (existing?.displayNumber ?? buildDisplayNumber(source, lastOrder.createdAt ?? new Date().toISOString()));

  const createdAt = lastOrder.createdAt ?? new Date().toISOString();
  const updatedAt = lastOrder.updatedAt ?? createdAt;

  return buildOperationalTicketRecord({
    ticketId: existing?.ticketId,
    displayNumber: preferredDisplayNumber,
    source,
    sourceLabel: meta.label,
    orderSessionId: existing?.orderSessionId ?? null,
    lastTabId: lastOrder.tabId,
    lastCode: lastOrder.externalId,
    externalOrderId: lastOrder.externalId,
    tableName: lastOrder.tableName ?? null,
    customerName: lastOrder.customerName ?? null,
    items: mapLastOrderItems(lastOrder.items),
    notes: lastOrder.notes ?? null,
    // Last does not expose subtotal / discountTotal separately
    subtotal: null,
    discountTotal: null,
    total: lastOrder.total,
    currency: 'EUR',
    // pickupTime is the closest equivalent to estimatedReadyAt for Last orders
    estimatedReadyAt: lastOrder.pickupTime ?? null,
    paid: true,
    operationalStatus: lastOrder.operationalStatus,
    printStatus: existing?.printStatus ?? 'not_queued',
    soundPolicy: meta.sound,
    soundPlayedAt: existing?.soundPlayedAt ?? null,
    firstSeenAt: existing?.firstSeenAt ?? createdAt,
    lastSeenAt: new Date().toISOString(),
    rawSourceHash,
    createdAt: existing?.createdAt ?? createdAt,
    updatedAt,
  });
}

function upsertOperationalTicket(record: OperationalTicketRecord) {
  const existing =
    (record.orderSessionId ? getOperationalTicketByOrderSessionId(record.orderSessionId) : null) ??
    (record.lastTabId ? getOperationalTicketByLastTabId(record.lastTabId) : null) ??
    (record.rawSourceHash ? getOperationalTicketByRawSourceHash(record.rawSourceHash) : null);

  if (existing) {
    return updateOperationalTicket(existing.ticketId, {
      ...record,
      ticketId: existing.ticketId,
      displayNumber: record.displayNumber || existing.displayNumber,
      createdAt: existing.createdAt,
      firstSeenAt: existing.firstSeenAt,
      printStatus: existing.printStatus,
      soundPlayedAt: existing.soundPlayedAt,
    })!;
  }

  return createOperationalTicket(record);
}

export function upsertOperationalTicketFromOrderSession(session: OrderSession) {
  if (session.paymentStatus !== 'paid' || session.lastSyncStatus !== 'sent') {
    return null;
  }

  return upsertOperationalTicket(normalizeOrderSessionToTicket(session));
}

export function upsertOperationalTicketFromLastOrder(lastOrder: LastLiveOrderRecord) {
  return upsertOperationalTicket(normalizeLastOrderToTicket(lastOrder));
}

export function listOperationalTickets(filters?: {
  source?: OperationalTicketRecord['source'];
  printStatus?: PrintStatus;
  since?: string;
  activeOnly?: boolean;
}) {
  return listOperationalTicketRecords(filters);
}

export function getOperationalTicket(ticketId: string) {
  return getOperationalTicketById(ticketId);
}

export function markTicketSoundPlayed(ticketId: string) {
  return updateOperationalTicket(ticketId, {
    soundPlayedAt: new Date().toISOString(),
  });
}

export function setTicketPrintStatus(ticketId: string, status: PrintStatus) {
  return updateOperationalTicket(ticketId, {
    printStatus: status,
  });
}
