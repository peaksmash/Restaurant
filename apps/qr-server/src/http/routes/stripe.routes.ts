import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { loadEnv } from '../../config/env.js';
import { getFirestoreDb } from '../../config/firebaseAdmin.js';
import { FirestoreTenantRepository } from '../../domain/tenant/tenantRepository.js';
import { postTab } from '../../infrastructure/lastApp/lastAppClient.js';
import type { OrderSessionDocument } from './orderSessions.routes.js';

function fail(statusCode: number, message: string): never {
  const e = new Error(message) as Error & { statusCode?: number };
  e.statusCode = statusCode;
  throw e;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildOperationalCode(orderSessionId: string, orderMode: string): string {
  const digits = orderSessionId.replace(/[^0-9]/g, '');
  const hexDigits = orderSessionId.replace(/-/g, '').replace(/[^0-9a-f]/gi, '');
  const numericSeed = digits.length >= 3
    ? digits
    : (digits + hexDigits.split('').map((c) => parseInt(c, 16).toString()).join('')).replace(/\D/g, '');
  const threeDigits = numericSeed.slice(0, 3).padStart(3, '0');
  const prefix = orderMode === 'delivery' ? 'D' : orderMode === 'pickup' ? 'L' : 'Q';
  return prefix + threeDigits;
}

export function registerStripeRoutes(app: FastifyInstance) {

  // POST /api/order-sessions/:orderSessionId/payment-intent
  app.post('/api/order-sessions/:orderSessionId/payment-intent', async (request) => {
    const env = loadEnv();
    if (!env.stripe.secretKey) fail(500, 'Stripe not configured.');

    const stripe = new Stripe(env.stripe.secretKey);
    const firestore = getFirestoreDb(env);
    const repository = new FirestoreTenantRepository(firestore);

    const { orderSessionId } = request.params as { orderSessionId: string };
    const tenantSlug = asString((request.query as Record<string, unknown>).tenant);
    if (!tenantSlug) fail(400, 'tenant query param is required.');

    const tenant = await repository.findTenantBySlug(tenantSlug);
    if (!tenant) fail(404, 'Tenant not found.');

    const sessionRef = firestore
      .collection('tenants')
      .doc(tenant.tenantId)
      .collection('orderSessions')
      .doc(orderSessionId);

    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) fail(404, 'OrderSession not found.');
    const session = sessionSnap.data() as OrderSessionDocument;

    if (session.paymentStatus !== 'unpaid') {
      fail(409, 'OrderSession is not in unpaid status.');
    }

    const amountCents = Math.round(session.totals.total);
    if (amountCents < 50) fail(422, 'Total is below Stripe minimum (50 cents).');

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'eur',
      metadata: {
        orderSessionId: session.orderSessionId,
        tenantId: session.tenantId,
        locationKey: session.locationKey,
        orderMode: session.orderMode,
      },
    });

    await sessionRef.update({
      stripePaymentIntentId: paymentIntent.id,
      updatedAt: new Date().toISOString(),
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountCents,
      currency: 'eur',
    };
  });

  // POST /api/webhooks/stripe
  app.post('/api/webhooks/stripe', {
    config: { rawBody: true },
  }, async (request, reply) => {
    const env = loadEnv();
    if (!env.stripe.secretKey) fail(500, 'Stripe not configured.');

    const stripe = new Stripe(env.stripe.secretKey);
    const sig = request.headers['stripe-signature'] as string;

    if (!sig) {
      reply.status(400).send({ error: 'Missing stripe-signature header.' });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        (request as unknown as { rawBody: Buffer }).rawBody,
        sig,
        env.stripe.webhookSecret,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Webhook signature verification failed.';
      app.log.warn({ err }, 'Stripe webhook signature failed');
      reply.status(400).send({ error: msg });
      return;
    }

    const firestore = getFirestoreDb(env);

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { orderSessionId, tenantId } = pi.metadata;

      if (!orderSessionId || !tenantId) {
        app.log.warn({ piId: pi.id }, 'Webhook missing metadata fields');
        reply.status(200).send({ received: true });
        return;
      }

      const sessionRef = firestore
        .collection('tenants')
        .doc(tenantId)
        .collection('orderSessions')
        .doc(orderSessionId);

      const sessionSnap = await sessionRef.get();
      if (!sessionSnap.exists) {
        app.log.warn({ orderSessionId }, 'OrderSession not found for webhook');
        reply.status(200).send({ received: true });
        return;
      }

      const session = sessionSnap.data() as OrderSessionDocument;

      if (session.paymentStatus === 'paid') {
        reply.status(200).send({ received: true, alreadyProcessed: true });
        return;
      }

      // Mark paid
      await sessionRef.update({
        paymentStatus: 'paid',
        updatedAt: new Date().toISOString(),
      });

      // Build and send Last payload
      try {
        const operationalCode = buildOperationalCode(orderSessionId, session.orderMode);
        const hex = orderSessionId.replace(/-/g, '').toUpperCase();
        const code = 'QR' + hex.slice(0, 6);

        const products = session.items.map((item) => ({
          id: item.productId,
          name: item.productName,
          type: 'PRODUCT',
          quantity: item.quantity,
          price: item.unitPrice,
          ...(item.modifiers && item.modifiers.length > 0
            ? {
                modifiers: item.modifiers.map((mod) => ({
                  id: mod.modifierId,
                  name: mod.modifierName,
                  quantity: mod.quantity,
                  priceImpact: mod.unitPrice,
                })),
              }
            : {}),
        }));

        const lastPayload: Record<string, unknown> = {
          brandId: session.lastApp.brandId,
          source: 'PideAhora QR',
          code,
          operationalCode,
          externalId: session.orderSessionId,
          preferredPaymentMethod: 'card',
          products,
          ...(session.orderMode === 'delivery' && session.lastDeliveryInput
            ? { delivery: session.lastDeliveryInput }
            : {}),
        };

        const tabResult = await postTab(env.lastApp, session.lastApp.locationId, lastPayload);

        await sessionRef.update({
          lastSyncStatus: 'sent',
          lastTabId: tabResult.id ?? null,
          updatedAt: new Date().toISOString(),
        });

        app.log.info({ orderSessionId, tabId: tabResult.id }, 'Last tab created successfully');
      } catch (lastErr) {
        const msg = lastErr instanceof Error ? lastErr.message : 'Unknown Last error';
        app.log.error({ orderSessionId, msg }, 'Last POST /tabs failed after payment');
        await sessionRef.update({
          lastSyncStatus: 'failed',
          lastSyncError: msg.slice(0, 500),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { orderSessionId, tenantId } = pi.metadata;
      if (orderSessionId && tenantId) {
        const sessionRef = firestore
          .collection('tenants')
          .doc(tenantId)
          .collection('orderSessions')
          .doc(orderSessionId);
        await sessionRef.update({
          paymentStatus: 'failed',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    reply.status(200).send({ received: true });
  });
}
