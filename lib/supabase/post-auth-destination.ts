import type { SupabaseClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/supabase/subscription";

export type PostAuthDestination =
  | { kind: "clinic"; href: string }
  | { kind: "onboarding"; href: "/" }
  | { kind: "pricing"; href: "/pricing" };

/**
 * Single source of truth for "where does this user belong right now" --
 * used both for the post-login/signup/OAuth redirect target and for the
 * marketing nav's auth state (see getMarketingNavState below). Mirrors the
 * exact logic app/page.tsx already uses to decide between redirecting to a
 * clinic, showing the create-clinic screen, or (previously) bouncing to
 * /pricing -- extracted here so every caller stays in sync instead of
 * re-deriving it.
 */
export async function resolvePostAuthDestination(supabase: SupabaseClient, userId: string): Promise<PostAuthDestination> {
  const [{ data: membership }, { data: pendingData }, subscriptionActive] = await Promise.all([
    supabase.from("clinic_members").select("clinic_id").eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle(),
    supabase.rpc("get_pending_invitations"),
    hasActiveSubscription(supabase, userId),
  ]);

  if (membership) {
    return { kind: "clinic", href: `/clinic/${membership.clinic_id}` };
  }

  const hasPendingInvitation = ((pendingData ?? []) as unknown[]).length > 0;
  if (hasPendingInvitation || subscriptionActive) {
    return { kind: "onboarding", href: "/" };
  }

  return { kind: "pricing", href: "/pricing" };
}

export type MarketingNavState =
  | { authenticated: false }
  | { authenticated: true; dashboardHref: string | null };

/** Auth state for marketing chrome (MarketingHeader/MarketingFooter/hero CTA) on pages that don't otherwise fetch the user -- /pricing and /demo. */
export async function getMarketingNavState(): Promise<MarketingNavState> {
  const user = await getUser();
  if (!user) return { authenticated: false };

  const supabase = await createClient();
  const destination = await resolvePostAuthDestination(supabase, user.id);
  return {
    authenticated: true,
    dashboardHref: destination.kind === "pricing" ? null : destination.href,
  };
}
