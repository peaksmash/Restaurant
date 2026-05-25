import { createHash } from 'node:crypto';
import type { Channel, OrderSession } from '@kiosk/types';
import type { CreateOrderPayload } from '../last-app.js';

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getLastSourceForChannel(session: OrderSession) {
  if (hasText(session.source)) {
    return session.source.trim();
  }

  switch (session.channel) {
    case 'qr_order':
      return 'MyWebsite';
    case 'kiosk':
    case 'manual':
    case 'pos':
      return 'Restaurant';
    case 'glovo':
      return 'Glovo';
    case 'uber':
      // TODO: confirmar con Last si "Uber" es un source oficial aceptado en este entorno.
      return 'Shop';
    case 'deliveroo':
      // TODO: confirmar source específico de Deliveroo en Last antes de personalizar ticket/POS.
      return 'Shop';
    case 'just_eat':
      // TODO: confirmar source específico de Just Eat en Last antes de personalizar ticket/POS.
      return 'Shop';
    default:
      return 'Shop';
  }
}

function getOperationalPrefix(channel: Channel, paymentMode: OrderSession['paymentMode']) {
  switch (channel) {
    case 'qr_order':
      return 'Q';
    case 'kiosk':
      return 'K';
    case 'manual':
      return paymentMode === 'staff_internal' ? 'M' : 'M';
    case 'pos':
      return 'P';
    case 'glovo':
      return 'G';
    case 'uber':
      return 'U';
    case 'deliveroo':
      return 'D';
    case 'just_eat':
      return 'J';
    default:
      return 'S';
  }
}

function buildStableOperationalSuffix(session: OrderSession) {
  const raw = `${session.externalId}:${session.orderSessionId}`;
  const digits = createHash('sha1').update(raw).digest('hex').replace(/[^0-9]/g, '');
  return (digits.slice(0, 3) || '000').padEnd(3, '0');
}

export function buildLastOperationalCode(session: OrderSession) {
  // Last documenta operationalCode corto; usamos prefijo + 3 dígitos estables.
  return `${getOperationalPrefix(session.channel, session.paymentMode)}${buildStableOperationalSuffix(session)}`;
}

export function mapOrderSessionToLastPayload(session: OrderSession): CreateOrderPayload {
  const lastTableId = hasText(session.lastTableId) ? session.lastTableId.trim() : undefined;

  return {
    source: getLastSourceForChannel(session),
    operationalCode: buildLastOperationalCode(session),
    ...(lastTableId ? { tableId: lastTableId } : {}),
    customer: session.customer
      ? {
          name: session.customer.name ?? undefined,
          surname: session.customer.surname ?? undefined,
          phoneNumber: session.customer.phoneNumber ?? undefined,
          email: session.customer.email ?? undefined
        }
      : undefined,
    notes: session.notes ?? undefined,
    items: session.items.map((item) => ({
      productId: item.productId,
      id: item.productId,
      name: item.productName,
      price: item.unitPrice,
      quantity: item.quantity,
      type: item.type,
      comments: item.notes ?? undefined,
      promotionId: item.promotionId ?? item.promotion?.promotionId ?? undefined,
      modifiers: item.modifiers.map((modifier) => ({
        id: modifier.modifierId,
        name: modifier.modifierName,
        priceImpact: modifier.unitPrice,
        quantity: modifier.quantity
      }))
    }))
  };
}

export function buildPayloadHash(payload: CreateOrderPayload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
