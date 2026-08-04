import { headers } from "next/headers";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/server";
import { DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { PLAN_PRICE_ENV_VARS, type BillingInterval, type CheckoutPlan } from "@/lib/stripe/plan";

export { isBillingInterval, isCheckoutPlan, type BillingInterval, type CheckoutPlan } from "@/lib/stripe/plan";

function resolvePriceId(plan: CheckoutPlan, interval: BillingInterval): string | undefined {
  return process.env[PLAN_PRICE_ENV_VARS[plan][interval]];
}

export function resolveCheckoutCurrency(value: string | undefined | null): CurrencyCode {
  return isCurrencyCode(value) ? value : DEFAULT_CURRENCY;
}

/** Yearly billing is only offered in EUR -- every other currency silently checks out monthly instead. */
export function resolveBillingInterval(currency: CurrencyCode, requested: BillingInterval): BillingInterval {
  return requested === "yearly" && currency === "EUR" ? "yearly" : "monthly";
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
  requestedInterval: BillingInterval = "monthly",
): Promise<{ url: string } | { error: true }> {
  const interval = resolveBillingInterval(currency, requestedInterval);
  const priceId = resolvePriceId(plan, interval);
  if (!priceId) {
    console.error(`[billing] missing Stripe price id env var (${PLAN_PRICE_ENV_VARS[plan][interval]}) for plan "${plan}"`);
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
      // Adaptive Pricing's cross-border-subscription mode caps payment methods
      // to card/Link/Apple Pay/Google Pay, silently excluding SEPA Debit even
      // though it's enabled in the account's Payment Method Configuration.
      // Managed Payments enforces adaptive_pricing=true unless explicitly
      // disabled alongside it, so both must be turned off together here.
      managed_payments: { enabled: false },
      adaptive_pricing: { enabled: false },
      // Carries user_id onto every subsequent customer.subscription.* webhook
      // event -- those never carry this session's client_reference_id (see
      // lib/stripe/subscriptions.ts#activateSubscriptionFromStripeSubscription).
      subscription_data: { metadata: { user_id: user.id, billing_interval: interval } },
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
