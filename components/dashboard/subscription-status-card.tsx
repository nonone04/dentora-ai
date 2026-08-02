import { GlassCard } from "@/components/dashboard/glass-card";
import { SectionHeader } from "@/components/dashboard/section-header";
import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { formatDate } from "@/lib/format";
import { getServerDictionary, getServerLocale, interpolate } from "@/lib/i18n/server";
import type { Dictionary, Locale } from "@/lib/i18n";
import { isActiveSubscriptionStatus } from "@/lib/stripe/subscriptions";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export function SubscriptionStatusCardSkeleton() {
  return (
    <GlassCard className="h-full w-full sm:w-72" aria-hidden="true">
      <div className="flex flex-col gap-1.5 border-b p-(--card-spacing)">
        <Skeleton className="h-4 w-24" />
      </div>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-36" />
      </CardContent>
    </GlassCard>
  );
}

type SubscriptionRow = {
  plan: "standard" | "professional";
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

const PLAN_NAME_INDEX: Record<SubscriptionRow["plan"], number> = { standard: 0, professional: 1 };

type StatusKey = keyof Dictionary["accountBilling"]["statuses"];
const STATUS_KEY: Record<string, StatusKey> = {
  active: "active",
  trialing: "trialing",
  past_due: "pastDue",
  canceled: "canceled",
  unpaid: "unpaid",
  incomplete: "incomplete",
  incomplete_expired: "incompleteExpired",
  paused: "paused",
};

// Green for active-like states, red for payment problems, muted for
// cancelled/paused -- same "meaning carries color" convention as the
// dashboard's other status pills (see greeting-status.tsx).
const STATUS_DOT_CLASS: Record<StatusKey, string> = {
  active: "bg-emerald-500",
  trialing: "bg-emerald-500",
  pastDue: "bg-destructive",
  unpaid: "bg-destructive",
  incompleteExpired: "bg-destructive",
  canceled: "bg-muted-foreground",
  paused: "bg-muted-foreground",
  incomplete: "bg-amber-500",
};

/** Data-only, kept separate from the component so a fetch failure never risks being read as a "JSX might throw" case -- same convention as the other dashboard widgets (see revenue-chart.tsx). Scoped to the caller's own subscription row (RLS: subscriptions_select_own), so this must only be called for the clinic owner. */
async function loadOwnSubscription(userId: string): Promise<SubscriptionRow | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as SubscriptionRow | null;
  } catch {
    return null;
  }
}

/**
 * Compact subscription status card for the dashboard header -- plan,
 * status, next billing date, and a link into the full Billing page.
 * Owner-only: subscriptions are keyed to the paying user, not the clinic,
 * so staff have no subscription row of their own to show here (and
 * shouldn't see clinic billing regardless -- see the Danger Zone /
 * Settings owner-only posture).
 */
export async function SubscriptionStatusCard({ userId }: { userId: string }) {
  const [subscription, t, locale] = await Promise.all([loadOwnSubscription(userId), getServerDictionary(), getServerLocale()]);

  if (!subscription) {
    return (
      <GlassCard className="h-full w-full sm:w-72">
        <SectionHeader title={t.dashboard.subscription.title} />
        <ErrorState title={t.dashboard.subscription.error} />
      </GlassCard>
    );
  }

  const planName = t.marketing.pricing.plans[PLAN_NAME_INDEX[subscription.plan]]?.name ?? subscription.plan;
  const statusKey = STATUS_KEY[subscription.status] ?? "incomplete";
  const isActive = isActiveSubscriptionStatus(subscription.status);
  const periodEndLabel = subscription.current_period_end ? formatDate(subscription.current_period_end, locale as Locale) : null;

  return (
    <GlassCard className="h-full w-full sm:w-72">
      <SectionHeader title={t.dashboard.subscription.title} href="/account/billing" hrefLabel={t.dashboard.subscription.manageBilling} />
      <CardContent className="flex flex-col gap-2">
        <span className="text-base font-semibold text-foreground">{planName}</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT_CLASS[statusKey])} aria-hidden="true" />
          <span className={isActive ? "text-foreground" : "text-destructive"}>{t.accountBilling.statuses[statusKey]}</span>
        </span>
        {periodEndLabel && (
          <div className="text-sm text-muted-foreground">
            {subscription.cancel_at_period_end ? (
              interpolate(t.accountBilling.cancelsOn, { date: periodEndLabel })
            ) : (
              <>
                {t.accountBilling.nextBilling}: <span className="font-medium text-foreground">{periodEndLabel}</span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </GlassCard>
  );
}
