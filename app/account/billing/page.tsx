import Link from "next/link";
import { AlertCircle, CreditCard, FileDown, Settings2, XCircle } from "lucide-react";
import { downloadLatestInvoice, openBillingPortal, openCancelSubscription, openUpdatePaymentMethod } from "@/app/actions/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isActiveSubscriptionStatus } from "@/lib/stripe/subscriptions";
import { formatDate } from "@/lib/format";
import { getServerDictionary, getServerLocale, interpolate } from "@/lib/i18n/server";
import type { Dictionary, Locale } from "@/lib/i18n";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

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

export default async function AccountBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ billingError?: string; invoiceError?: string }>;
}) {
  const user = await requireUser();
  const [t, locale, { billingError, invoiceError }] = await Promise.all([getServerDictionary(), getServerLocale(), searchParams]);

  const supabase = await createClient();
  // A user who cancels and later re-subscribes gets a second row here (a
  // fresh Checkout session means a new Stripe subscription id) -- order +
  // limit(1) so this always resolves to the current one instead of
  // erroring on multiple rows.
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-semibold">{t.accountBilling.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.accountBilling.description}</p>
      </div>

      {(billingError || invoiceError) && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {invoiceError ? t.accountBilling.invoiceUnavailable : t.accountBilling.actionError}
        </div>
      )}

      {subscription ? (
        <SubscriptionCard t={t} locale={locale} subscription={subscription as SubscriptionRow} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm font-medium text-foreground">{t.accountBilling.emptyState.title}</p>
            <p className="text-sm text-muted-foreground">{t.accountBilling.emptyState.description}</p>
            <Button className="mt-2" nativeButton={false} render={<Link href="/pricing" />}>
              {t.accountBilling.emptyState.cta}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SubscriptionCard({
  t,
  locale,
  subscription,
}: {
  t: Dictionary;
  locale: Locale;
  subscription: SubscriptionRow;
}) {
  const planName = t.marketing.pricing.plans[PLAN_NAME_INDEX[subscription.plan]]?.name ?? subscription.plan;
  const statusKey = STATUS_KEY[subscription.status] ?? "incomplete";
  const isActive = isActiveSubscriptionStatus(subscription.status);
  const periodEndLabel = subscription.current_period_end ? formatDate(subscription.current_period_end, locale) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.accountBilling.currentPlan}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-2xl font-semibold text-foreground">{planName}</span>
          <Badge variant={isActive ? "secondary" : "destructive"}>{t.accountBilling.statuses[statusKey]}</Badge>
        </div>

        {periodEndLabel && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {subscription.cancel_at_period_end ? "" : t.accountBilling.nextBilling}
            </span>
            <span className="font-medium text-foreground">
              {subscription.cancel_at_period_end ? interpolate(t.accountBilling.cancelsOn, { date: periodEndLabel }) : periodEndLabel}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-foreground/8 pt-4 sm:flex-row sm:flex-wrap">
          <form action={openBillingPortal}>
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              <Settings2 aria-hidden="true" />
              {t.accountBilling.actions.manageSubscription}
            </Button>
          </form>
          <form action={openUpdatePaymentMethod}>
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              <CreditCard aria-hidden="true" />
              {t.accountBilling.actions.updateCard}
            </Button>
          </form>
          <form action={downloadLatestInvoice}>
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              <FileDown aria-hidden="true" />
              {t.accountBilling.actions.downloadInvoice}
            </Button>
          </form>
          <form action={openCancelSubscription}>
            <Button type="submit" variant="outline" className="w-full text-destructive hover:bg-destructive/10 sm:ms-auto sm:w-auto">
              <XCircle aria-hidden="true" />
              {t.accountBilling.actions.cancelSubscription}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
