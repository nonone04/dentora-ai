import Stripe from "stripe";

let client: Stripe | undefined;

/**
 * Singleton Stripe client, created lazily on first use so a missing
 * STRIPE_SECRET_KEY only breaks the billing flow that needs it rather than
 * every server module that happens to import this file.
 */
export function getStripeClient(): Stripe {
  if (!client) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    client = new Stripe(secretKey, { typescript: true });
  }
  return client;
}
