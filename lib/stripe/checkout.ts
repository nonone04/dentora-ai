import { headers } from "next/headers";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/server";
import { DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from "@/lib/currency";

export type CheckoutPlan = "standard" | "professional";

/**
 * Per-currency Stripe Price id env vars, e.g. STRIPE_STANDARD_PRICE_ID_MAD,
 * STRIPE_STANDARD_PRICE_ID_USD. Only the DEFAULT_CURRENCY (MAD) vars are
 * actually configured today -- every other currency resolves through the
 * DEFAULT_CURRENCY fallback in resolvePriceId() below, so pricing displays
 * in the visitor's chosen currency while Stripe keeps charging the single
 * real price it has. Dropping in e.g. STRIPE_STANDARD_PRICE_ID_USD later
 * needs no code change, just the env var.
 */
function planPriceEnvVar(plan: CheckoutPlan, currency: CurrencyCode): string | undefined {
  const value = process.env[`STRIPE_${plan.toUpperCase()}_PRICE_ID_${currency}`];
  if (value) return value;
  // Backward-compat: the pre-multi-currency env vars had no currency
  // suffix and always priced in MAD -- keep honoring them for MAD so
  // existing deployments don't need to rename anything.
  return currency === DEFAULT_CURRENCY ? process.env[`STRIPE_${plan.toUpperCase()}_PRICE_ID`] : undefined;
}

function resolvePriceId(plan: CheckoutPlan, currency: CurrencyCode): string | undefined {
  return planPriceEnvVar(plan, currency) ?? planPriceEnvVar(plan, DEFAULT_CURRENCY);
}

export function isCheckoutPlan(value: string): value is CheckoutPlan {
  return value === "standard" || value === "professional";
}

export function resolveCheckoutCurrency(value: string | undefined | null): CurrencyCode {
  return isCurrencyCode(value) ? value : DEFAULT_CURRENCY;
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
  currency: CurrencyCode = DEFAULT_CURRENCY,
): Promise<{ url: string } | { error: true }> {
  const priceId = resolvePriceId(plan, currency);
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
      // Carries user_id onto every subsequent customer.subscription.* webhook
      // event -- those never carry this session's client_reference_id (see
      // lib/stripe/subscriptions.ts#activateSubscriptionFromStripeSubscription).
      subscription_data: { metadata: { user_id: user.id } },
      // {CHECKOUT_SESSION_ID} is Stripe's own template token, substituted at
      // redirect time -- lets /billing/success synchronously reconcile via
      // stripe.checkout.sessions.retrieve instead of only relying on the
      // (racy, async) webhook.
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
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
