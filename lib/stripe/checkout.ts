import { headers } from "next/headers";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/server";

export type CheckoutPlan = "standard" | "professional";

const PLAN_PRICE_ENV: Record<CheckoutPlan, string | undefined> = {
  standard: process.env.STRIPE_STANDARD_PRICE_ID,
  professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
};

export function isCheckoutPlan(value: string): value is CheckoutPlan {
  return value === "standard" || value === "professional";
}

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

/**
 * Creates a Stripe Checkout session for `plan` on behalf of `user`. Shared
 * by the checkout server action (button click from an already-authenticated
 * session) and the `/checkout/[plan]` resume page (post-login continuation,
 * reached via the `next` param threaded through app/actions/auth.ts) so
 * both paths charge through the same server-trusted plan -> price mapping
 * -- the client never supplies a price id directly.
 */
export async function createPlanCheckoutSession(
  user: { id: string; email?: string },
  plan: CheckoutPlan,
): Promise<{ url: string } | { error: true }> {
  const priceId = PLAN_PRICE_ENV[plan];
  if (!priceId) {
    console.error(`[billing] missing Stripe price id env var for plan "${plan}"`);
    return { error: true };
  }

  const origin = await getOrigin();
  const stripe = getStripeClient();

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing/success`,
      cancel_url: `${origin}/pricing`,
    });
  } catch (error) {
    console.error("[billing] failed to create Stripe Checkout session", error instanceof Error ? error.message : error);
    return { error: true };
  }

  if (!session.url) {
    console.error("[billing] Stripe Checkout session created without a redirect url");
    return { error: true };
  }

  return { url: session.url };
}
