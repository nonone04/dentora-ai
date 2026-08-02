import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckoutPlan } from "@/lib/stripe/checkout";

export const ACTIVE_SUBSCRIPTION_STATUSES = ["trialing", "active"] as const;

export function isActiveSubscriptionStatus(status: string): boolean {
  return (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

const PLAN_PRICE_ENV_VAR_RE = /^STRIPE_(STANDARD|PROFESSIONAL)_PRICE_ID(?:_[A-Z]+)?$/;

/**
 * Reverses lib/stripe/checkout.ts's plan -> price env var mapping (across
 * every currency variant and the legacy no-suffix vars) so a Stripe
 * Subscription's price id can be resolved back to a CheckoutPlan.
 */
export function resolvePlanFromPriceId(priceId: string | null | undefined): CheckoutPlan | null {
  if (!priceId) return null;
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== priceId) continue;
    const match = PLAN_PRICE_ENV_VAR_RE.exec(key);
    if (match) return match[1].toLowerCase() as CheckoutPlan;
  }
  return null;
}

/**
 * Idempotent upsert shared by /billing/success's synchronous reconciliation
 * and the Stripe webhook's async backstop. subscription.items.data[0] is
 * read for current_period_end/price -- in this Stripe API version
 * (2026-07-29.dahlia, stripe@22.4.0) those fields live on the
 * SubscriptionItem, not the Subscription itself, and checkout always
 * creates single-item subscriptions (lib/stripe/checkout.ts). Falls back
 * to subscription.metadata.user_id (set via subscription_data.metadata in
 * createPlanCheckoutSession) since bare customer.subscription.* webhook
 * events don't carry Checkout's client_reference_id.
 */
export async function activateSubscriptionFromStripeSubscription(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
  fallbackUserId?: string | null,
): Promise<{ userId: string; status: string } | null> {
  const userId = subscription.metadata?.user_id || fallbackUserId;
  if (!userId) {
    console.error(`[stripe] subscription ${subscription.id} has no user_id metadata/fallback -- skipping`);
    return null;
  }

  const item = subscription.items.data[0];
  const plan = resolvePlanFromPriceId(item?.price?.id);
  if (!plan) {
    console.error(`[stripe] subscription ${subscription.id} price ${item?.price?.id} does not map to a known plan -- skipping`);
    return null;
  }

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      plan,
      status: subscription.status,
      current_period_end: item ? new Date(item.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: "stripe_subscription_id" },
  );

  if (error) {
    console.error(`[stripe] failed to upsert subscription ${subscription.id}`, error.message);
    return null;
  }

  return { userId, status: subscription.status };
}
