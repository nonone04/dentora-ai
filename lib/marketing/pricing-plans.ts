/**
 * Numeric base prices for the marketing plans, in MAD -- the translatable
 * text (name, description, features, cta) lives in each locale's
 * dictionary (lib/i18n/dictionaries/*.ts, `marketing.pricing.plans`), keyed
 * by the same order/index as PLAN_KEYS. Keeping the numbers here instead of
 * duplicated per-locale strings means a price change is one edit instead of
 * three, and lets every currency (lib/currency) render from the same
 * source via convert() + formatCurrency().
 *
 * Yearly original/savings amounts are derived (`monthlyPriceMad * 12`),
 * not stored separately, so they can never drift out of sync with the
 * monthly price.
 */
export const PLAN_KEYS = ["starter", "professional", "enterprise"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export type PlanPricing = { monthlyPriceMad: number; yearlyBilledTotalMad: number } | { custom: true };

export const PLAN_PRICING: Record<PlanKey, PlanPricing> = {
  starter: { monthlyPriceMad: 490, yearlyBilledTotalMad: 4700 },
  professional: { monthlyPriceMad: 990, yearlyBilledTotalMad: 9500 },
  enterprise: { custom: true },
};

export function isCustomPricing(pricing: PlanPricing): pricing is { custom: true } {
  return "custom" in pricing;
}
