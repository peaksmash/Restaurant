import Stripe from 'stripe';
import type { OrderSession } from '@kiosk/types';

let _stripe: Stripe | null = null;

export function initStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  _stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
  return _stripe;
}

interface CheckoutSessionResult {
  checkoutUrl: string;
  stripeCheckoutSessionId: string;
  expiresAt: number;
}

export async function createCheckoutSession(
  orderSession: OrderSession,
  successUrl: string,
  cancelUrl: string,
): Promise<CheckoutSessionResult> {
  const stripe = initStripe();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = orderSession.items.map((item) => {
    const name = item.name;
    const unitAmount = item.unitPrice; // already in cents
    const modifierTotal = (item.modifiers ?? []).reduce((sum, m) => sum + m.unitPrice * (m.quantity ?? 1), 0);
    const totalUnitAmount = unitAmount + modifierTotal;

    return {
      price_data: {
        currency: orderSession.currency ?? 'eur',
        product_data: { name },
        unit_amount: totalUnitAmount,
      },
      quantity: item.quantity,
    };
  });

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        orderSessionId: orderSession.id,
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min
    },
    {
      idempotencyKey: `stripe-checkout-${orderSession.id}`,
    },
  );

  return {
    checkoutUrl: session.url!,
    stripeCheckoutSessionId: session.id,
    expiresAt: session.expires_at,
  };
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): Stripe.Event {
  const stripe = initStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
