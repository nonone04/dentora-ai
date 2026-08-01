import { notFound, redirect } from "next/navigation";
import { getServerCurrency } from "@/lib/currency/server";
import { getUser } from "@/lib/supabase/auth";
import { createPlanCheckoutSession, isCheckoutPlan } from "@/lib/stripe/checkout";
import { track } from "@/lib/telemetry";

/**
 * Resume point for checkout after an auth detour: PlanCheckoutButton's
 * server action (app/actions/billing.ts) sends unauthenticated clicks here
 * via /login?next=/checkout/[plan], and app/actions/auth.ts redirects back
 * to this exact path once sign-in/sign-up/OAuth succeeds. Re-checks auth
 * itself (rather than trusting the caller) since a signed-out user could
 * hit this URL directly, and re-runs the same session creation the button
 * would have used if the user had already been logged in.
 */
export default async function CheckoutPlanPage({ params }: { params: Promise<{ plan: string }> }) {
  const { plan } = await params;

  if (!isCheckoutPlan(plan)) {
    notFound();
  }

  const user = await getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/checkout/${plan}`)}`);
  }

  const currency = await getServerCurrency();
  const result = await createPlanCheckoutSession(user, plan, currency);
  if ("error" in result) {
    redirect("/pricing");
  }

  await track({ name: "Checkout Started", userId: user.id, properties: { plan } });

  redirect(result.url);
}
