export type CheckoutPlan = "standard" | "professional";
export type BillingInterval = "monthly" | "yearly";

/**
 * EUR is the only currency with real Stripe Prices configured -- every
 * other display currency's Checkout still charges against these same EUR
 * prices (lib/currency/convert.ts only affects what visitors see, not what
 * Stripe bills). There's no yearly equivalent for other currencies, which
 * is why yearly billing is EUR-only (see resolveBillingInterval in
 * lib/stripe/checkout.ts). Deliberately its own module with no
 * server-only imports (unlike lib/stripe/checkout.ts, which pulls in
 * next/headers): lib/stripe/pricing.ts and lib/marketing/pricing-plans.ts
 * are reachable from client components (the pricing page's billing
 * toggle), and importing a runtime value out of checkout.ts there would
 * drag next/headers into the client bundle.
 */
export const PLAN_PRICE_ENV_VARS: Record<CheckoutPlan, Record<BillingInterval, string>> = {
  standard: { monthly: "STRIPE_STANDARD_PRICE_ID_EUR", yearly: "STRIPE_STANDARD_PRICE_ID_EUR_YEARLY" },
  professional: { monthly: "STRIPE_PROFESSIONAL_PRICE_ID_EUR", yearly: "STRIPE_PROFESSIONAL_PRICE_ID_EUR_YEARLY" },
};

export function isCheckoutPlan(value: string): value is CheckoutPlan {
  return value === "standard" || value === "professional";
}

export function isBillingInterval(value: string | null | undefined): value is BillingInterval {
  return value === "monthly" || value === "yearly";
}
