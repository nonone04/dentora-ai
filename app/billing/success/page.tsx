import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/server";
import { activateSubscriptionFromStripeSubscription } from "@/lib/stripe/subscriptions";
import { requireUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Post-payment orchestration point: Stripe's success_url
 * (lib/stripe/checkout.ts) lands here with ?session_id={CHECKOUT_SESSION_ID}.
 * Synchronously reconciles the subscription (rather than only waiting on
 * the webhook, which can race this redirect) using the same idempotent
 * upsert the webhook itself uses, then sends the user on to their clinic
 * if they already have one, or to "/" -- which now gates clinic creation
 * on the subscription this page just activated (see app/page.tsx).
 */
export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const user = await requireUser();
  const { session_id: sessionId } = await searchParams;

  if (sessionId) {
    try {
      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
      // Guards against a user pasting/replaying someone else's session_id.
      if (session.client_reference_id === user.id && session.subscription && typeof session.subscription !== "string") {
        await activateSubscriptionFromStripeSubscription(createAdminClient(), session.subscription as Stripe.Subscription, user.id);
      }
    } catch (err) {
      console.error("[billing/success] failed to reconcile checkout session", err instanceof Error ? err.message : err);
      // Fall through -- the webhook remains the durable backstop even if
      // this synchronous read fails.
    }
  }

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membership) {
    redirect(`/clinic/${membership.clinic_id}`);
  }

  redirect("/");
}
