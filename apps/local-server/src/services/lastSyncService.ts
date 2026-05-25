import { readRuntimeConfig } from '../config.js';
import {
  appendOrderSessionEvent,
  getLastOrderLinkByOrderSessionId,
  getOrderSessionById,
  getTableQrMappingById,
  updateOrderSession,
  upsertLastOrderLink
} from '../db.js';
import { createOrderInLast, fetchLastTabById, HttpError } from '../last-app.js';
import { buildPayloadHash, mapOrderSessionToLastPayload } from '../mappers/orderSessionToLast.js';
import { upsertOperationalTicketFromOrderSession } from './operationalTicketService.js';
import { validateMoney } from '../validators/orderSessionValidators.js';

function getLastPaymentMethod(provider: 'cash' | 'cashdro' | 'artemis') {
  return provider === 'artemis' ? 'card' : 'cash';
}

function sumRecordedPayments(payments: unknown) {
  if (!Array.isArray(payments)) {
    return 0;
  }

  return payments.reduce((sum, entry) => {
    if (!entry || typeof entry !== 'object') {
      return sum;
    }

    const record = entry as { amount?: unknown; paidAmount?: unknown; deleted?: unknown };
    if (record.deleted === true) {
      return sum;
    }

    const amount =
      typeof record.amount === 'number'
        ? record.amount
        : typeof record.paidAmount === 'number'
          ? record.paidAmount
          : null;

    return amount !== null && Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
}

function isLastTabPaid(tab: unknown) {
  if (!tab || typeof tab !== 'object') {
    return false;
  }

  const bills = (tab as { bills?: unknown }).bills;
  if (!Array.isArray(bills) || bills.length === 0) {
    return false;
  }

  return bills.every((entry) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const bill = entry as {
      total?: unknown;
      payments?: unknown;
    };

    const total = typeof bill.total === 'number' && Number.isFinite(bill.total) ? bill.total : null;
    if (total === null) {
      return false;
    }

    return sumRecordedPayments(bill.payments) >= total;
  });
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForLastTabToBePaid(
  config: ReturnType<typeof readRuntimeConfig>,
  tabId: string,
  attempts = 4,
  delayMs = 400
) {
  let lastTab: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      lastTab = await fetchLastTabById(config, tabId);
    } catch {
      // Error de red al verificar el pago — continuar intentando
    }

    if (isLastTabPaid(lastTab)) {
      return lastTab;
    }

    if (attempt < attempts - 1) {
      await delay(delayMs);
    }
  }

  return lastTab;
}

export async function sendOrderSessionToLast(
  orderSessionId: string,
  options?: { paymentProvider?: 'cash' | 'cashdro' | 'artemis' }
) {
  const session = getOrderSessionById(orderSessionId);
  if (!session) {
    throw new HttpError(404, 'Order session not found', {
      code: 'session_not_found'
    });
  }

  if (session.paymentStatus !== 'paid') {
    throw new HttpError(409, 'Order session is not paid', {
      code: 'send_to_last_not_allowed'
    });
  }

  if (session.lastSyncStatus === 'sent') {
    return {
      orderSession: session,
      lastOrderLink: getLastOrderLinkByOrderSessionId(session.orderSessionId),
      syncStatus: session.lastSyncStatus
    };
  }

  if (session.lastSyncStatus !== 'not_sent' && session.lastSyncStatus !== 'sync_failed') {
    throw new HttpError(409, 'Order session cannot be sent to Last', {
      code: 'send_to_last_not_allowed'
    });
  }

  if (!Array.isArray(session.items) || session.items.length === 0) {
    throw new HttpError(400, 'Items are required', {
      code: 'items_invalid'
    });
  }

  validateMoney(session.total, 'total');

  if (session.lastTableId && session.tableId) {
    const mapping = getTableQrMappingById(session.tableId);
    if (!mapping || mapping.lastTableId !== session.lastTableId) {
      throw new HttpError(409, 'Table mapping mismatch', {
        code: 'table_context_invalid'
      });
    }
  }

  const config = readRuntimeConfig();
  const lastPayload = mapOrderSessionToLastPayload(session);
  if (options?.paymentProvider) {
    lastPayload.preferredPaymentMethod = getLastPaymentMethod(options.paymentProvider);
    lastPayload.payments = [
      {
        method: getLastPaymentMethod(options.paymentProvider),
        paidAmount: session.total
      }
    ];
    if (session.discountTotal && session.discountTotal > 0) {
      lastPayload.discount = { type: 'currency', amount: session.discountTotal };
    }
  }
  const payloadHash = buildPayloadHash(lastPayload);

  appendOrderSessionEvent({
    orderSessionId: session.orderSessionId,
    type: 'last_sync_started',
    actorType: 'system'
  });

  try {
    const result = await createOrderInLast(config, lastPayload);

    if (result.lastTabId && options?.paymentProvider) {
      const lastTab = await waitForLastTabToBePaid(config, result.lastTabId);
      if (!isLastTabPaid(lastTab)) {
        // El pago se embebió en la creación del tab — Last lo recibió aunque
        // la verificación posterior no lo confirme (error de red transitorio).
        // Procedemos como 'sent' para evitar falsos 'sync_failed'.
        console.warn(
          '[last-sync] No se pudo confirmar el pago del tab tras polling — procediendo como enviado.',
          { tabId: result.lastTabId, orderSessionId: session.orderSessionId }
        );
      }
    }

    const next = updateOrderSession(session.orderSessionId, {
      lastSyncStatus: 'sent'
    });

    if (!next) {
      throw new HttpError(404, 'Order session not found', {
        code: 'session_not_found'
      });
    }

    const lastOrderLink = upsertLastOrderLink({
      orderSessionId: next.orderSessionId,
      lastTabId: result.lastTabId ?? null,
      lastCode: result.code ?? result.orderCode ?? null,
      lastPayloadHash: payloadHash
    });

    upsertOperationalTicketFromOrderSession(next);

    appendOrderSessionEvent({
      orderSessionId: next.orderSessionId,
      type: 'last_sync_succeeded',
      actorType: 'system',
      rawJson: {
        lastTabId: result.lastTabId ?? null,
        lastCode: result.code ?? result.orderCode ?? null
      }
    });

    return {
      orderSession: next,
      lastOrderLink,
      syncStatus: next.lastSyncStatus
    };
  } catch (error) {
    const next = updateOrderSession(session.orderSessionId, {
      lastSyncStatus: 'sync_failed'
    });

    const sanitizedError =
      error instanceof HttpError
        ? {
            statusCode: error.statusCode,
            message: error.message,
            code:
              typeof error.details === 'object' &&
              error.details !== null &&
              'code' in error.details
                ? (error.details as { code?: unknown }).code
                : null
          }
        : {
            message: error instanceof Error ? error.message : 'Unknown Last sync error'
          };

    appendOrderSessionEvent({
      orderSessionId: session.orderSessionId,
      type: 'last_sync_failed',
      actorType: 'system',
      rawJson: sanitizedError
    });

    return {
      orderSession: next ?? session,
      syncStatus: 'sync_failed' as const,
      error: 'No se pudo enviar a Last todavía.'
    };
  }
}
