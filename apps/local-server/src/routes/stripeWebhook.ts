import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';
import { appendOrderSessionEvent, getOrderSessionById, updateOrderSession } from '../db.js';
import { verifyWebhookSignature } from '../services/stripeService.js';
import { sendOrderSessionToLast } from '../services/lastSyncService.js';

export function registerStripeWebhookRoutes(app: FastifyInstance) {
  // Scoped plugin so we can override the content-type parser to get raw body
  app.register(async (scoped) => {
    scoped.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req, body, done) => done(null, body),
    );

    scoped.post<{ Headers: { 'stripe-signature'?: string } }>(
      '/stripe/webhook',
      async (request, reply) => {
        const signature = request.headers['stripe-signature'];
        if (!signature) {
          reply.status(400).send({ error: 'Missing stripe-signature header' });
          return;
        }

        let event: Stripe.Event;
        try {
          event = verifyWebhookSignature(request.body as Buffer, signature);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Signature verification failed';
          app.log.warn({ err }, `Stripe webhook signature invalid: ${msg}`);
          reply.status(400).send({ error: msg });
          return;
        }

        app.log.info({ type: event.type, id: event.id }, 'Stripe webhook received');

        try {
          if (event.type === 'checkout.session.completed') {
            await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, app);
          } else if (event.type === 'payment_intent.payment_failed') {
            handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, app);
          }
        } catch (err) {
          app.log.error({ err, eventType: event.type }, 'Stripe webhook handler error');
          // Return 200 anyway — Stripe will not retry if we return 5xx for handler errors
        }

        reply.status(200).send({ received: true });
      },
    );
  });
}

async function handleCheckoutSessionCompleted(
  stripeSession: Stripe.Checkout.Session,
  app: FastifyInstance,
) {
  const orderSessionId = stripeSession.metadata?.orderSessionId;
  if (!orderSessionId) {
    app.log.warn({ stripeSessionId: stripeSession.id }, 'checkout.session.completed without orderSessionId metadata');
    return;
  }

  const session = getOrderSessionById(orderSessionId);
  if (!session) {
    app.log.warn({ orderSessionId }, 'checkout.session.completed: order session not found');
    return;
  }

  // Idempotency guard
  if (session.paymentStatus === 'paid') {
    app.log.info({ orderSessionId }, 'checkout.session.completed: already paid, skipping');
    return;
  }

  updateOrderSession(orderSessionId, {
    paymentStatus: 'paid',
    stripePaymentIntentId: typeof stripeSession.payment_intent === 'string'
      ? stripeSession.payment_intent
      : (stripeSession.payment_intent?.id ?? null),
    stripeCheckoutSessionId: stripeSession.id,
  });

  appendOrderSessionEvent({
    orderSessionId,
    type: 'payment_completed',
    actorType: 'system',
    rawJson: {
      provider: 'stripe',
      stripeSessionId: stripeSession.id,
      paymentIntent: stripeSession.payment_intent,
    },
  });

  app.log.info({ orderSessionId }, 'Order session marked as paid via Stripe');

  // Sync to Last.app — failure must not cause webhook to return 4xx/5xx
  try {
    await sendOrderSessionToLast(orderSessionId);
  } catch (err) {
    app.log.error({ err, orderSessionId }, 'Failed to sync order session to Last.app after Stripe payment');
  }
}

function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  app: FastifyInstance,
) {
  const orderSessionId = paymentIntent.metadata?.orderSessionId;
  app.log.warn(
    { orderSessionId, paymentIntentId: paymentIntent.id, lastError: paymentIntent.last_payment_error?.message },
    'Stripe payment_intent.payment_failed',
  );

  if (orderSessionId) {
    appendOrderSessionEvent({
      orderSessionId,
      type: 'payment_failed',
      actorType: 'system',
      rawJson: {
        provider: 'stripe',
        paymentIntentId: paymentIntent.id,
        error: paymentIntent.last_payment_error?.message ?? null,
      },
    });
  }
}
