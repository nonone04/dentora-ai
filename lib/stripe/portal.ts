import { headers } from "next/headers";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/server";

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

/**
 * Creates a Stripe Billing Portal session scoped to `customerId`, optionally
 * deep-linked into a specific flow (payment_method_update, subscription_cancel,
 * ...) -- see https://docs.stripe.com/customer-management/portal-deep-links.
 * Requires a Customer Portal configuration on the Stripe account (Dashboard
 * > Settings > Billing > Customer portal); without one, session creation
 * fails and callers fall back to a generic error redirect.
 */
export async function createPortalSession(
  customerId: string,
  flowData?: Stripe.BillingPortal.SessionCreateParams.FlowData,
): Promise<{ url: string } | { error: true }> {
  const origin = await getOrigin();
  const stripe = getStripeClient();

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/account/billing`,
      ...(flowData ? { flow_data: flowData } : {}),
    });
    return { url: session.url };
  } catch (error) {
    console.error("[billing] failed to create Stripe portal session", error instanceof Error ? error.message : error);
    return { error: true };
  }
}
