import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/server";
import { activateSubscriptionFromStripeSubscription } from "@/lib/stripe/subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Durable async backstop for subscription state (renewals, cancellations,
 * anything that doesn't route through /billing/success's synchronous
 * reconciliation). Raw-body-then-verify follows the same convention as
 * app/api/whatsapp/webhook/route.ts. Unlike that route (always-200 over a
 * batched payload), a processing failure here returns 500 so Stripe
 * retries -- each event is a single state change, not a batch where one
 * bad item shouldn't sink the rest.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!webhookSecret || !signature) {
    console.error("[stripe:webhook] not configured");
    return new Response("Not configured", { status: 500 });
  }

  const stripe = getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe:webhook] signature verification failed", err instanceof Error ? err.message : err);
    return new Response("Invalid signature", { status: 401 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await activateSubscriptionFromStripeSubscription(admin, subscription, session.client_reference_id);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        // Stripe already sets status: "canceled" on the object delivered
        // with the .deleted event, so the shared upsert handles it as-is.
        const subscription = event.data.object as Stripe.Subscription;
        await activateSubscriptionFromStripeSubscription(admin, subscription);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe:webhook] failed to process event type=${event.type}`, err instanceof Error ? err.message : err);
    return new Response("Processing failed", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
