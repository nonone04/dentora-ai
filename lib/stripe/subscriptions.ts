import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_PRICE_ENV_VARS, type CheckoutPlan } from "@/lib/stripe/plan";

export const ACTIVE_SUBSCRIPTION_STATUSES = ["trialing", "active"] as const;

export function isActiveSubscriptionStatus(status: string): boolean {
  return (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

/**
 * Reverses lib/stripe/checkout.ts's plan -> price env var mapping (both the
 * monthly and yearly EUR price ids) so a Stripe Subscription's price id can
 * be resolved back to a CheckoutPlan regardless of which billing interval
 * the customer picked at checkout.
 */
export function resolvePlanFromPriceId(priceId: string | null | undefined): CheckoutPlan | null {
  if (!priceId) return null;
  for (const [plan, intervals] of Object.entries(PLAN_PRICE_ENV_VARS) as [CheckoutPlan, Record<string, string>][]) {
    if (Object.values(intervals).some((envVar) => process.env[envVar] === priceId)) return plan;
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
