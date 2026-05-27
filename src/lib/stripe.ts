import Stripe from 'stripe';
import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js';

// ---------------- Server-side ----------------

// Instancia singleton do Stripe server-side. Usar somente em
// Server Actions, Route Handlers ou outros pontos de execucao no servidor.
// NUNCA importar este simbolo a partir de codigo client.
let _stripe: Stripe | null = null;

export function getStripeServer(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY ausente nas environment variables.',
    );
  }
  _stripe = new Stripe(key, {
    apiVersion: '2026-04-22.dahlia',
    appInfo: {
      name: 'Agenda4U',
      version: '1.0.0',
    },
    typescript: true,
  });
  return _stripe;
}

// ---------------- Client-side ----------------

let stripePromise: Promise<StripeJs | null> | null = null;

export function getStripe(): Promise<StripeJs | null> {
  if (stripePromise) return stripePromise;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    console.error(
      '[stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ausente nas env vars.',
    );
    stripePromise = Promise.resolve(null);
    return stripePromise;
  }
  stripePromise = loadStripe(key);
  return stripePromise;
}
