/**
 * Plan pricing for the marketing site -- the translatable text (name,
 * description, features, cta) lives in each locale's dictionary
 * (lib/i18n/dictionaries/*.ts, `marketing.pricing.plans`), keyed by the
 * same order/index as PLAN_KEYS. The numbers themselves are never stored
 * here: `getPlanPricing()` resolves starter/professional straight from the
 * live Stripe Price objects (lib/stripe/pricing.ts, which reads
 * STRIPE_STANDARD_PRICE_ID / STRIPE_PROFESSIONAL_PRICE_ID -- the same env
 * vars Checkout charges against, see lib/stripe/checkout.ts) so the
 * marketing site can never drift out of sync with what Stripe actually
 * bills. Enterprise has no Stripe price by design (sales-assisted, not
 * self-serve).
 */
import { getLivePlanPrices } from "@/lib/stripe/pricing";
import type { CurrencyCode } from "@/lib/currency";

export const PLAN_KEYS = ["starter", "professional", "enterprise"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export type PlanPricing = { monthlyPrice: number; yearlyBilledTotal: number; currency: CurrencyCode } | { custom: true };

/**
 * Discount applied to the live monthly Stripe price for the yearly billing
 * toggle. Stripe only has a single monthly Price configured per plan, so
 * there's no separate annual Price to read a real yearly total from --
 * this percentage is the one number here that isn't itself read from
 * Stripe, it only scales the live monthly amount.
 */
export const ANNUAL_DISCOUNT_PERCENT = 20;

export function isCustomPricing(pricing: PlanPricing): pricing is { custom: true } {
  return "custom" in pricing;
}

function toPlanPricing({ amount, currency }: { amount: number; currency: CurrencyCode }): PlanPricing {
  const yearlyBilledTotal = Math.round(amount * 12 * (1 - ANNUAL_DISCOUNT_PERCENT / 100) * 100) / 100;
  return { monthlyPrice: amount, yearlyBilledTotal, currency };
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
