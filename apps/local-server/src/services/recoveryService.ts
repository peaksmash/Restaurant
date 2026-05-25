import {
  appendOrderSessionEvent,
  findAnyCashierOrderSessionByTokenOrCode,
  findRecoverableOrderSessionByTokenOrCode,
  getOrderSessionById,
  updateOrderSession
} from '../db.js';
import { HttpError } from '../last-app.js';
import { sendOrderSessionToLast } from './lastSyncService.js';
import { validateMoney } from '../validators/orderSessionValidators.js';

export interface ConfirmCashPaymentInput {
  paymentMode?: string;
  paymentProvider?: string;
  amountReceived?: number;
  idempotencyKey?: string;
}

interface CompletePaymentOptions {
  paymentProvider: 'cash' | 'cashdro' | 'artemis';
  amountReceived?: number;
  idempotencyKey: string;
  eventType?: 'payment_succeeded' | 'payment_demo_succeeded';
}

export function recoverOrderSessionByTokenOrCode(tokenOrCode: string) {
  const normalizedToken = tokenOrCode?.trim();
  if (!normalizedToken) {
    throw new HttpError(404, 'Order session not found', {
      code: 'session_not_found'
    });
  }

  const anySession = findAnyCashierOrderSessionByTokenOrCode(normalizedToken);
  if (!anySession) {
    throw new HttpError(404, 'Order session not found', {
      code: 'session_not_found'
    });
  }

  if (anySession.operationalStatus === 'cancelled') {
    throw new HttpError(404, 'Order session not found', {
      code: 'session_not_found'
    });
  }

  if (anySession.paymentStatus === 'paid') {
    throw new HttpError(409, 'Order session already paid', {
      code: 'session_already_paid'
    });
  }

  if (anySession.expiresAt && new Date(anySession.expiresAt).getTime() <= Date.now()) {
    throw new HttpError(410, 'Order session expired', {
      code: 'session_expired'
    });
  }

  const session = findRecoverableOrderSessionByTokenOrCode(normalizedToken);
  if (!session || session.lastSyncStatus !== 'not_sent' || session.paymentStatus !== 'unpaid') {
    throw new HttpError(404, 'Order session not found', {
      code: 'session_not_found'
    });
  }

  appendOrderSessionEvent({
    orderSessionId: session.orderSessionId,
    type: 'recovery_order_found',
    actorType: 'system'
  });

  return {
    orderSession: session,
    tableName: session.tableNameSnapshot ?? null
  };
}

export async function confirmCashierOrderSessionPayment(orderSessionId: string, body: ConfirmCashPaymentInput) {
  const session = getOrderSessionById(orderSessionId);
  if (!session) {
    throw new HttpError(404, 'Order session not found', {
      code: 'session_not_found'
    });
  }

  const paymentMode = body?.paymentMode?.trim();
  const paymentProvider = body?.paymentProvider?.trim();
  const idempotencyKey = body?.idempotencyKey?.trim();

  if (!idempotencyKey) {
    throw new HttpError(400, 'Missing idempotencyKey', {
      code: 'idempotency_key_required'
    });
  }

  if (paymentMode !== 'cashier') {
    throw new HttpError(400, 'Invalid paymentMode', {
      code: 'payment_mode_invalid'
    });
  }

  if (paymentProvider !== 'cash' && paymentProvider !== 'cashdro') {
    throw new HttpError(400, 'Invalid paymentProvider', {
      code: 'payment_provider_failed'
    });
  }

  if (session.paymentMode !== 'cashier') {
    throw new HttpError(400, 'Cashier payment not allowed', {
      code: 'cashier_payment_not_allowed'
    });
  }

  if (session.paymentStatus === 'paid') {
    return {
      orderSession: session,
      lastSyncStatus: session.lastSyncStatus
    };
  }

  if (session.lastSyncStatus !== 'not_sent') {
    throw new HttpError(409, 'Order session is not in a payable sync state', {
      code: 'payment_mode_invalid'
    });
  }

  if (session.paymentStatus !== 'unpaid') {
    throw new HttpError(409, 'Order session is not unpaid', {
      code: 'payment_mode_invalid'
    });
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new HttpError(410, 'Order session expired', {
      code: 'session_expired'
    });
  }

  if (body?.amountReceived !== undefined) {
    validateMoney(body.amountReceived, 'amountReceived');
    if ((body.amountReceived as number) < session.total) {
      throw new HttpError(400, 'Received amount is lower than order total', {
        code: 'invalid_amount',
        field: 'amountReceived'
      });
    }
  }

  return completeCashierOrderSessionPayment(session.orderSessionId, {
    paymentProvider,
    amountReceived: body?.amountReceived,
    idempotencyKey,
    eventType: 'payment_succeeded'
  });
}

export async function completeCashierOrderSessionPayment(orderSessionId: string, options: CompletePaymentOptions) {
  const session = getOrderSessionById(orderSessionId);
  if (!session) {
    throw new HttpError(404, 'Order session not found', {
      code: 'session_not_found'
    });
  }

  if (session.paymentStatus === 'paid') {
    return {
      orderSession: session,
      lastSyncStatus: session.lastSyncStatus
    };
  }

  const next = updateOrderSession(session.orderSessionId, {
    paymentStatus: 'paid',
    lastSyncStatus: 'not_sent'
  });

  if (!next) {
    throw new HttpError(404, 'Order session not found', {
      code: 'session_not_found'
    });
  }

  appendOrderSessionEvent({
    orderSessionId: next.orderSessionId,
    type: options.eventType ?? 'payment_succeeded',
    actorType: 'system',
    rawJson: {
      paymentMode: 'cashier',
      paymentProvider: options.paymentProvider,
      amountReceived: options.amountReceived ?? null,
      idempotencyKey: options.idempotencyKey
    }
  });

  const lastSyncResult = await sendOrderSessionToLast(next.orderSessionId, {
    paymentProvider: options.paymentProvider
  });

  return {
    orderSession: lastSyncResult.orderSession,
    lastSyncStatus: lastSyncResult.syncStatus
  };
}
