"use server";

import { redirect } from "next/navigation";
import { getServerDictionary } from "@/lib/i18n/server";
import { getUser, requireUser } from "@/lib/supabase/auth";
import { createPlanCheckoutSession, isBillingInterval, resolveCheckoutCurrency, type CheckoutPlan } from "@/lib/stripe/checkout";
import { createPortalSession } from "@/lib/stripe/portal";
import { getStripeClient } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
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
  billingInterval: string,
  _prevState: CheckoutFormState,
  _formData: FormData,
): Promise<CheckoutFormState> {
  const interval = isBillingInterval(billingInterval) ? billingInterval : "monthly";

  const user = await getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/checkout/${plan}?interval=${interval}`)}`);
  }

  const t = await getServerDictionary();
  const result = await createPlanCheckoutSession(user, plan, resolveCheckoutCurrency(currency), interval);

  if ("error" in result) {
    return { error: t.billing.checkoutError };
  }

  await track({ name: "Checkout Started", userId: user.id, properties: { plan } });

  redirect(result.url);
}

/**
 * The caller's own, most recent subscription row (billing identifiers
 * only) -- null if they've never subscribed, e.g. invited staff whose
 * access comes from the clinic owner instead. Ordered + limited to 1: a
 * cancel-then-resubscribe cycle leaves an older row behind (a fresh
 * Checkout session always gets a new Stripe subscription id), and this
 * must resolve to the current one rather than erroring on multiple rows.
 */
async function getOwnStripeIdentifiers() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { stripe_customer_id: string; stripe_subscription_id: string } | null;
}

/** Opens the default Stripe Customer Portal (plan details, invoice history, payment method, cancellation -- all in one place). */
export async function openBillingPortal(): Promise<void> {
  const identifiers = await getOwnStripeIdentifiers();
  if (!identifiers) redirect("/pricing");

  const result = await createPortalSession(identifiers.stripe_customer_id);
  redirect("error" in result ? "/account/billing?billingError=1" : result.url);
}

/** Opens the portal deep-linked straight into the "update payment method" flow. */
export async function openUpdatePaymentMethod(): Promise<void> {
  const identifiers = await getOwnStripeIdentifiers();
  if (!identifiers) redirect("/pricing");

  const result = await createPortalSession(identifiers.stripe_customer_id, { type: "payment_method_update" });
  redirect("error" in result ? "/account/billing?billingError=1" : result.url);
}

/** Opens the portal deep-linked straight into the cancellation flow for this user's own subscription. */
export async function openCancelSubscription(): Promise<void> {
  const identifiers = await getOwnStripeIdentifiers();
  if (!identifiers) redirect("/pricing");

  const result = await createPortalSession(identifiers.stripe_customer_id, {
    type: "subscription_cancel",
    subscription_cancel: { subscription: identifiers.stripe_subscription_id },
  });
  redirect("error" in result ? "/account/billing?billingError=1" : result.url);
}

/** Redirects straight to the PDF of the most recent invoice, rather than routing through the portal for a one-click download. */
export async function downloadLatestInvoice(): Promise<void> {
  const identifiers = await getOwnStripeIdentifiers();
  if (!identifiers) redirect("/pricing");

  let pdfUrl: string | null | undefined;
  try {
    const invoices = await getStripeClient().invoices.list({ customer: identifiers.stripe_customer_id, limit: 1 });
    pdfUrl = invoices.data[0]?.invoice_pdf;
  } catch (error) {
    console.error("[billing] failed to list invoices", error instanceof Error ? error.message : error);
  }

  redirect(pdfUrl ?? "/account/billing?invoiceError=1");
}
