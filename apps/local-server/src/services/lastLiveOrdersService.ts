import type { Channel, OperationalStatus, PaymentMode } from '@kiosk/types';
import { readRuntimeConfig } from '../config.js';
import { HttpError } from '../last-app.js';
import {
  cancelLastOrder,
  fetchLastOrderStatus,
  fetchLastTabById,
  fetchLastTabs,
  type LastOrderStatusValue,
  updateLastOrderStatus
} from '../last-app.js';
import { validateOperationalStatus } from '../validators/orderSessionValidators.js';

export interface LastLiveOrderRecord {
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
}

interface ListLiveLastOrdersOptions {
  open?: boolean;
  since?: string;
  limit?: number;
}

function normalizeSourceChannel(source: string | null | undefined, tableName: string | null | undefined): Channel {
  const normalized = source?.trim().toLowerCase() ?? '';

  if (normalized.includes('glovo')) return 'glovo';
  if (normalized.includes('uber')) return 'uber';
  if (normalized.includes('deliveroo')) return 'deliveroo';
  if (normalized.includes('just eat') || normalized.includes('justeat')) return 'just_eat';
  if (normalized.includes('kiosk')) return 'kiosk';
  if (normalized.includes('website') || normalized.includes('mywebsite') || normalized.includes('shop')) {
    return tableName ? 'qr_order' : 'kiosk';
  }

  if (normalized.includes('restaurant') || normalized.includes('waiter') || normalized.includes('staff')) {
    return 'manual';
  }

  if (tableName) {
    return 'qr_order';
  }

  return 'manual';
}

function normalizePaymentMode(channel: Channel): PaymentMode {
  if (channel === 'kiosk') return 'kiosk';
  if (channel === 'manual' || channel === 'pos') return 'staff_internal';
  return 'online';
}

function normalizeOperationalStatus(status: LastOrderStatusValue): OperationalStatus {
  switch (status) {
    case 'CREATED':
      return 'pending';
    case 'KITCHEN':
      return 'preparing';
    case 'READY_TO_PICKUP':
      return 'ready';
    case 'ON_DELIVERY':
    case 'DELIVERED':
    case 'CLOSED':
      return 'delivered';
    default:
      return 'pending';
  }
}

function inferClosedOperationalStatus(detail: {
  closeTime?: string | null;
  cancelTime?: string | null;
}): OperationalStatus | null {
  if (detail.cancelTime) {
    return 'cancelled';
  }

  if (detail.closeTime) {
    return 'delivered';
  }

  return null;
}

function mapOperationalStatusToLast(status: OperationalStatus): LastOrderStatusValue | 'CANCELLED' {
  switch (status) {
    case 'pending':
    case 'accepted':
    case 'preparing':
      return 'KITCHEN';
    case 'ready':
      return 'READY_TO_PICKUP';
    case 'delivered':
      return 'DELIVERED';
    case 'cancelled':
      return 'CANCELLED';
    default:
      return 'KITCHEN';
  }
}

function buildExternalId(detail: {
  externalId?: string | null;
  code?: string | null;
  source?: string | null;
  id?: string | null;
}) {
  if (detail.externalId?.trim()) return detail.externalId.trim();
  if (detail.code?.trim()) return detail.code.trim();
  if (detail.source?.trim()) return `${detail.source.trim()}-${detail.id ?? ''}`.trim();
  return detail.id ?? 'LAST';
}

export async function listLiveLastOrders(options: ListLiveLastOrdersOptions = {}) {
  const config = readRuntimeConfig();
  const startDate = options.since ? new Date(options.since) : null;
  const tabs = await fetchLastTabs(config, {
    ...(startDate && !Number.isNaN(startDate.getTime()) ? { startDate: startDate.toISOString() } : {}),
    ...(typeof options.open === 'boolean' ? { open: options.open } : {}),
    limit: options.limit ?? 50
  });

  const liveTabs =
    typeof options.open === 'boolean'
      ? options.open
        ? tabs.filter((tab) => !tab.closeTime && !tab.cancelTime)
        : tabs
      : tabs;

  const details = await Promise.all(
    liveTabs.map(async (tab) => {
      const detail = await fetchLastTabById(config, tab.id);
      const inferredClosedStatus = inferClosedOperationalStatus({
        closeTime: detail.closeTime ?? tab.closeTime ?? null,
        cancelTime: detail.cancelTime ?? tab.cancelTime ?? null,
      });
      let operationalStatus: OperationalStatus;

      if (inferredClosedStatus) {
        operationalStatus = inferredClosedStatus;
      } else {
        let status: { status: LastOrderStatusValue } = { status: 'CREATED' };

        try {
          status = await fetchLastOrderStatus(config, tab.id);
        } catch (error) {
          if (error instanceof HttpError && error.statusCode === 404) {
            status = { status: 'CREATED' };
          } else {
            throw error;
          }
        }

        operationalStatus = normalizeOperationalStatus(status.status);
      }

      const channel = normalizeSourceChannel(detail.source, detail.tableName);

      return {
        id: detail.id ?? tab.id,
        tabId: detail.id ?? tab.id,
        externalId: buildExternalId({
          externalId: detail.externalId ?? null,
          code: detail.code ?? null,
          source: detail.source ?? null,
          id: detail.id ?? tab.id
        }),
        channel,
        paymentMode: normalizePaymentMode(channel),
        operationalStatus,
        paymentStatus: 'paid' as const,
        lastSyncStatus: 'sent' as const,
        tableName: detail.tableName ?? null,
        customerName: detail.customerInfo?.name ?? null,
        customerPhoneNumber: detail.customerInfo?.phoneNumber ?? null,
        notes: detail.kitchenNote ?? detail.customerNote ?? null,
        source: detail.source ?? null,
        pickupType: detail.pickupType ?? null,
        pickupTime: detail.pickupTime ?? null,
        createdAt: detail.creationTime ?? null,
        updatedAt: detail.activationTime ?? detail.creationTime ?? null,
        total:
          detail.total ??
          detail.bills?.[detail.bills.length - 1]?.total ??
          detail.products.reduce((sum, product) => sum + (product.finalPrice ?? product.price * product.quantity), 0),
        items: detail.products.map((product) => ({
          id: product.id,
          productId: product.id,
          productName: product.name,
          type: product.type ?? 'PRODUCT',
          quantity: product.quantity,
          unitPrice: product.quantity > 0
            ? Math.round((product.finalPrice ?? product.price * product.quantity) / product.quantity)
            : product.price,
          totalPrice: product.finalPrice ?? product.price * product.quantity,
          notes: product.comments ?? null,
          modifiers: (product.modifiers ?? []).map((modifier) => ({
            modifierId: modifier.id ?? modifier.name,
            modifierName: modifier.name,
            quantity: modifier.quantity,
            unitPrice: modifier.priceImpact,
            totalPrice: modifier.priceImpact * modifier.quantity
          }))
        }))
      } satisfies LastLiveOrderRecord;
    })
  );

  return details.sort((left, right) => {
    const rightTime = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
    const leftTime = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
    return rightTime - leftTime;
  });
}

export async function updateLiveLastOrderStatus(tabId: string, operationalStatus: OperationalStatus) {
  validateOperationalStatus(operationalStatus);
  const currentOrders = await listLiveLastOrders();
  const current = currentOrders.find((order) => order.tabId === tabId) ?? null;
  const config = readRuntimeConfig();
  const mappedStatus = mapOperationalStatusToLast(operationalStatus);

  if (mappedStatus === 'CANCELLED') {
    await cancelLastOrder(config, tabId);
  } else {
    try {
      await updateLastOrderStatus(config, tabId, mappedStatus);
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 404) {
        throw new HttpError(409, 'Este pedido no permite cambio de estado en Last.', {
          code: 'last_status_not_supported'
        });
      }
      throw error;
    }
  }

  const liveOrders = await listLiveLastOrders();
  const updated = liveOrders.find((order) => order.tabId === tabId);

  if (!updated) {
    if (current && (operationalStatus === 'cancelled' || operationalStatus === 'delivered')) {
      return {
        ...current,
        operationalStatus,
        updatedAt: new Date().toISOString()
      };
    }

    throw new HttpError(404, 'Live Last order not found', {
      code: 'live_order_not_found'
    });
  }

  return updated;
}
