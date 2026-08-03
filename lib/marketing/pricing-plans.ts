/**
 * Plan pricing for the marketing site -- the translatable text (name,
 * description, features, cta) lives in each locale's dictionary
 * (lib/i18n/dictionaries/*.ts, `marketing.pricing.plans`), keyed by the
 * same order/index as PLAN_KEYS. The numbers themselves are never stored
 * here: `getPlanPricing()` resolves starter/professional straight from the
 * live Stripe Price objects (lib/stripe/pricing.ts, which reads the same
 * env vars Checkout charges against, see lib/stripe/checkout.ts) so the
 * marketing site can never drift out of sync with what Stripe actually
 * bills -- including the yearly total, which is a real Stripe Price, not a
 * computed discount. Enterprise has no Stripe price by design
 * (sales-assisted, not self-serve).
 */
import { getLivePlanPrices, type LivePlanPrice } from "@/lib/stripe/pricing";
import type { CurrencyCode } from "@/lib/currency";

export const PLAN_KEYS = ["starter", "professional", "enterprise"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export type PlanPricing = { monthlyPrice: number; yearlyBilledTotal: number; currency: CurrencyCode } | { custom: true };

export function isCustomPricing(pricing: PlanPricing): pricing is { custom: true } {
  return "custom" in pricing;
}

function toPlanPricing({ monthlyAmount, yearlyAmount, currency }: LivePlanPrice): PlanPricing {
  return { monthlyPrice: monthlyAmount, yearlyBilledTotal: yearlyAmount, currency };
}

/** Live plan pricing keyed the same as PLAN_KEYS. */
export async function getPlanPricing(): Promise<Record<PlanKey, PlanPricing>> {
  const live = await getLivePlanPrices();
  return {
    starter: toPlanPricing(live.standard),
    professional: toPlanPricing(live.professional),
    enterprise: { custom: true },
  };
}
