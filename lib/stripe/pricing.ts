import { unstable_cache } from "next/cache";
import { getStripeClient } from "@/lib/stripe/server";
import { CURRENCIES, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import { PLAN_PRICE_ENV_VARS, type CheckoutPlan } from "@/lib/stripe/plan";

export type LivePlanPrice = {
  monthlyAmount: number;
  yearlyAmount: number;
  currency: CurrencyCode;
};

async function fetchLivePrice(envVar: string): Promise<{ amount: number; currency: CurrencyCode }> {
  const priceId = process.env[envVar];
  if (!priceId) {
    throw new Error(`${envVar} is not set -- cannot resolve its live Stripe price`);
  }

  const price = await getStripeClient().prices.retrieve(priceId);
  const currency = price.currency.toUpperCase();
  if (!isCurrencyCode(currency)) {
    throw new Error(`Stripe price ${priceId} (${envVar}) uses unsupported currency "${price.currency}"`);
  }
  if (price.unit_amount == null) {
    throw new Error(`Stripe price ${priceId} (${envVar}) has no unit_amount -- metered/tiered prices aren't supported here`);
  }

  return { amount: price.unit_amount / 10 ** CURRENCIES[currency].decimalDigits, currency };
}

async function fetchLivePlanPrice(plan: CheckoutPlan): Promise<LivePlanPrice> {
  const envVars = PLAN_PRICE_ENV_VARS[plan];
  const [monthly, yearly] = await Promise.all([fetchLivePrice(envVars.monthly), fetchLivePrice(envVars.yearly)]);
  return { monthlyAmount: monthly.amount, yearlyAmount: yearly.amount, currency: monthly.currency };
}

/**
 * Live Stripe price lookup for the two self-serve plans -- the single
 * source of truth for what the marketing site displays and what Checkout
 * charges (see lib/stripe/checkout.ts, which resolves the same env vars).
 * `yearlyAmount` is the real upfront annual total Stripe has configured,
 * not a computed discount, so the pricing page can never drift from what
 * Checkout actually bills. Cached for 5 minutes so marketing page renders
 * don't hit the Stripe API on every request; on-demand invalidation can
 * call `revalidateTag("stripe-pricing")` after a price change.
 *
 * A plan resolves to `null` (instead of throwing) when its env vars are
 * missing/misconfigured or Stripe can't be reached -- a bad Stripe price
 * config must not take down the whole marketing site. Callers (see
 * lib/marketing/pricing-plans.ts) treat `null` the same as Enterprise's
 * `{ custom: true }` pricing.
 */
export const getLivePlanPrices = unstable_cache(
  async (): Promise<Record<CheckoutPlan, LivePlanPrice | null>> => {
    const [standard, professional] = await Promise.all([
      fetchLivePlanPrice("standard").catch((error) => {
        console.error("[pricing] failed to resolve live price for plan \"standard\":", error);
        return null;
      }),
      fetchLivePlanPrice("professional").catch((error) => {
        console.error("[pricing] failed to resolve live price for plan \"professional\":", error);
        return null;
      }),
    ]);
    return { standard, professional };
  },
  ["stripe-live-plan-prices"],
  { revalidate: 300, tags: ["stripe-pricing"] },
);
