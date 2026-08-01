"use server";

import { redirect } from "next/navigation";
import { getServerDictionary } from "@/lib/i18n/server";
import { getUser } from "@/lib/supabase/auth";
import { createPlanCheckoutSession, resolveCheckoutCurrency, type CheckoutPlan } from "@/lib/stripe/checkout";
import { track } from "@/lib/telemetry";

export type CheckoutFormState = { error?: string } | undefined;

/**
 * Starts a Stripe Checkout session for `plan`. Callers always bind `plan`
 * server-side (see PlanCheckoutButton) rather than reading it from form
 * input -- combined with the fixed plan -> price map in
 * lib/stripe/checkout.ts, that means a client can never influence which
 * Stripe Price id gets charged.
 *
 * An unauthenticated click is sent to /login with `next` pointing at
 * `/checkout/[plan]`, which re-runs this same session creation once the
 * user signs in (see app/checkout/[plan]/page.tsx and the `next` handling
 * in app/actions/auth.ts) -- so the plan they picked survives the login
 * detour instead of getting dropped in favor of the dashboard.
 */
export async function createCheckoutSession(
  plan: CheckoutPlan,
  currency: string,
  _prevState: CheckoutFormState,
  _formData: FormData,
): Promise<CheckoutFormState> {
  const user = await getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/checkout/${plan}`)}`);
  }

  const t = await getServerDictionary();
  const result = await createPlanCheckoutSession(user, plan, resolveCheckoutCurrency(currency));

  if ("error" in result) {
    return { error: t.billing.checkoutError };
  }

  await track({ name: "Checkout Started", userId: user.id, properties: { plan } });

  redirect(result.url);
}
