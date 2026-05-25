import type { FastifyInstance } from 'fastify';
import { isOrderChannel, isPaymentStatus } from '@kiosk/types';
import { appendOrderSessionEvent, getOrderSessionById, listOrderSessions, updateOrderSession } from '../db.js';
import { HttpError } from '../last-app.js';
import {
  createOrderSessionFromInput,
  getOrderSessionEventsForRead,
  type CreateOrderSessionBody,
  type UpdateOrderSessionStatusBody,
  updateOrderSessionOperationalStatus
} from '../services/orderSessionService.js';
import { isValidPaymentMode } from '../validators/orderSessionValidators.js';
import { createCheckoutSession } from '../services/stripeService.js';

export function registerOrderSessionRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateOrderSessionBody }>('/api/order-sessions', async (request) => {
    return createOrderSessionFromInput(request.body);
  });

  app.get<{ Params: { id: string } }>('/api/order-sessions/:id', async (request) => {
    const session = getOrderSessionById(request.params.id);
    if (!session) {
      throw new HttpError(404, 'Order session not found', {
        code: 'session_not_found'
      });
    }

    return session;
  });

  app.get<{
    Querystring: {
      active?: string;
      since?: string;
      limit?: string;
      paymentStatus?: string;
      lastSyncStatus?: string;
      channel?: string;
      paymentMode?: string;
    }
  }>('/api/order-sessions', async (request) => {
    const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : undefined;
    return listOrderSessions({
      active: request.query.active === 'true',
      since: request.query.since,
      limit: Number.isFinite(limit) ? limit : undefined,
      paymentStatus:
        request.query.paymentStatus && isPaymentStatus(request.query.paymentStatus)
          ? request.query.paymentStatus
          : undefined,
      lastSyncStatus: request.query.lastSyncStatus,
      channel:
        request.query.channel && isOrderChannel(request.query.channel)
          ? request.query.channel
          : undefined,
      paymentMode: isValidPaymentMode(request.query.paymentMode) ? request.query.paymentMode : undefined
    });
  });

  app.patch<{
    Params: { id: string };
    Body: UpdateOrderSessionStatusBody;
  }>('/api/order-sessions/:id/status', async (request) => {
    return updateOrderSessionOperationalStatus(request.params.id, request.body);
  });

  app.get<{ Params: { id: string } }>('/api/order-sessions/:id/events', async (request) => {
    return getOrderSessionEventsForRead(request.params.id);
  });

  app.post<{
    Params: { id: string };
    Body: { successUrl: string; cancelUrl: string };
  }>('/api/order-sessions/:id/checkout/stripe', async (request) => {
    const session = getOrderSessionById(request.params.id);
    if (!session) {
      throw new HttpError(404, 'Order session not found', { code: 'session_not_found' });
    }

    if (session.paymentMode !== 'online') {
      throw new HttpError(400, 'Stripe checkout requires paymentMode=online', { code: 'invalid_payment_mode' });
    }

    if (session.paymentStatus === 'paid') {
      throw new HttpError(409, 'Order session is already paid', { code: 'already_paid' });
    }

    if (!session.items || session.items.length === 0) {
      throw new HttpError(400, 'Order session has no items', { code: 'no_items' });
    }

    const { successUrl, cancelUrl } = request.body;
    if (!successUrl || !cancelUrl) {
      throw new HttpError(400, 'successUrl and cancelUrl are required', { code: 'missing_urls' });
    }

    const result = await createCheckoutSession(session, successUrl, cancelUrl);

    updateOrderSession(session.id, {
      stripeCheckoutSessionId: result.stripeCheckoutSessionId,
    });

    appendOrderSessionEvent({
      orderSessionId: session.id,
      type: 'stripe_checkout_created',
      actorType: 'system',
      rawJson: { sessionId: result.sessionId, expiresAt: result.expiresAt },
    });

    return result;
  });
}
