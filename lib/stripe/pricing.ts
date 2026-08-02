import { unstable_cache } from "next/cache";
import { getStripeClient } from "@/lib/stripe/server";
import { CURRENCIES, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import type { CheckoutPlan } from "@/lib/stripe/checkout";

export type LivePlanPrice = {
  amount: number;
  currency: CurrencyCode;
  interval: string | null;
};

const PRICE_ID_ENV_VAR: Record<CheckoutPlan, string> = {
  standard: "STRIPE_STANDARD_PRICE_ID",
  professional: "STRIPE_PROFESSIONAL_PRICE_ID",
};

async function fetchLivePlanPrice(plan: CheckoutPlan): Promise<LivePlanPrice> {
  const envVar = PRICE_ID_ENV_VAR[plan];
  const priceId = process.env[envVar];
  if (!priceId) {
    throw new Error(`${envVar} is not set -- cannot resolve the live "${plan}" plan price`);
  }

  const price = await getStripeClient().prices.retrieve(priceId);
  const currency = price.currency.toUpperCase();
  if (!isCurrencyCode(currency)) {
    throw new Error(`Stripe price ${priceId} (${envVar}) uses unsupported currency "${price.currency}"`);
  }
  if (price.unit_amount == null) {
    throw new Error(`Stripe price ${priceId} (${envVar}) has no unit_amount -- metered/tiered prices aren't supported here`);
  }

  return {
    amount: price.unit_amount / 10 ** CURRENCIES[currency].decimalDigits,
    currency,
    interval: price.recurring?.interval ?? null,
  };
}

/**
 * Live Stripe price lookup for the two self-serve plans -- the single
 * source of truth for what the marketing site displays and what Checkout
 * charges (see lib/stripe/checkout.ts, which resolves the same env vars).
 * Cached for 5 minutes so marketing page renders don't hit the Stripe API
 * on every request; on-demand invalidation can call
 * `revalidateTag("stripe-pricing")` after a price change.
 */
export const getLivePlanPrices = unstable_cache(
  async (): Promise<Record<CheckoutPlan, LivePlanPrice>> => {
    const [standard, professional] = await Promise.all([fetchLivePlanPrice("standard"), fetchLivePlanPrice("professional")]);
    return { standard, professional };
  },
  ["stripe-live-plan-prices"],
  { revalidate: 300, tags: ["stripe-pricing"] },
);
