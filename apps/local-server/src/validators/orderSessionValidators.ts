import {
  isOperationalStatus,
  isOrderChannel,
  type OperationalStatus,
  type OrderSession,
  type PaymentMode
} from '@kiosk/types';
import { HttpError } from '../last-app.js';

export function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidPaymentMode(value: unknown): value is PaymentMode {
  return value === 'online' || value === 'cashier' || value === 'kiosk' || value === 'staff_internal';
}

export function validateChannelPaymentMode(channel: OrderSession['channel'], paymentMode: PaymentMode) {
  const valid =
    (channel === 'qr_order' && ['online', 'cashier', 'kiosk'].includes(paymentMode)) ||
    (channel === 'kiosk' && ['kiosk', 'cashier'].includes(paymentMode)) ||
    (channel === 'manual' && ['cashier', 'staff_internal'].includes(paymentMode));

  if (!valid) {
    throw new HttpError(400, 'Invalid channel/paymentMode combination', {
      code: 'payment_mode_invalid',
      channel,
      paymentMode
    });
  }
}

export function validateMoney(value: unknown, field: string) {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new HttpError(400, `Invalid ${field}`, {
      code: 'invalid_amount',
      field
    });
  }
}

export function validateOrderSessionItems(items: unknown): asserts items is OrderSession['items'] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'Items are required', {
      code: 'items_invalid'
    });
  }

  for (const item of items) {
    if (
      !item ||
      !hasText(item.id) ||
      !hasText(item.productId) ||
      !hasText(item.productName) ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isInteger(item.unitPrice) ||
      item.unitPrice < 0 ||
      !Number.isInteger(item.totalPrice) ||
      item.totalPrice < 0 ||
      !Array.isArray(item.modifiers)
    ) {
      throw new HttpError(400, 'Invalid order item', {
        code: 'items_invalid'
      });
    }
  }
}

export function validateOrderChannel(value: unknown): asserts value is OrderSession['channel'] {
  if (!hasText(value) || !isOrderChannel(value)) {
    throw new HttpError(400, 'Invalid channel', {
      code: 'channel_invalid'
    });
  }
}

const VALID_OPERATIONAL_STATUS_TRANSITIONS: Record<OperationalStatus, OperationalStatus[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: []
};

export function validateOperationalStatus(value: unknown): asserts value is OperationalStatus {
  if (!hasText(value) || !isOperationalStatus(value)) {
    throw new HttpError(400, 'Invalid operational status', {
      code: 'invalid_status_transition'
    });
  }
}

export function validateOperationalStatusTransition(from: OperationalStatus, to: OperationalStatus) {
  if (!VALID_OPERATIONAL_STATUS_TRANSITIONS[from].includes(to)) {
    throw new HttpError(409, 'Invalid operational status transition', {
      code: 'invalid_status_transition',
      from,
      to
    });
  }
}
