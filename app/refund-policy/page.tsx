import type { Metadata } from "next";
import { RotateCcw } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { LegalPageShell, LegalSection, legalListClass, LegalContactCard } from "@/components/marketing/legal/legal-page-shell";
import { getMarketingNavState } from "@/lib/supabase/post-auth-destination";

const TITLE = "Refund Policy -- Dentora AI";
const DESCRIPTION =
  "Dentora AI's refund policy: the 14-day money-back guarantee, billing disputes, duplicate charges, failed payments, and cancellations.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/refund-policy" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/refund-policy",
    type: "website",
    siteName: "Dentora AI",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function RefundPolicyPage() {
  const navState = await getMarketingNavState();

  return (
    <>
      <MarketingHeader navState={navState} />
      <LegalPageShell
        icon={RotateCcw}
        eyebrow="Legal"
        title="Refund Policy"
        intro="How refunds, billing disputes, and cancellations work for Dentora AI subscriptions."
        effectiveDate="August 7, 2026"
      >
        <LegalSection title="1. 14-day money-back guarantee">
          <p>
            If you are subscribing to a paid plan for the first time, you can request a full refund within{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">14 days</span> of your initial payment, no questions asked. Email{" "}
            <a href="mailto:support@dentora.vip" className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400">
              support@dentora.vip
            </a>{" "}
            with your account email, and we will process the refund to your original payment method within 5-10 business days.
          </p>
        </LegalSection>

        <LegalSection title="2. Renewal refunds">
          <p>
            After the initial 14-day window, subscription renewals (monthly or yearly) are generally non-refundable. If you cancel, you keep
            access until the end of the current paid period, but we do not refund the unused portion of that period, except where required by
            law or at our discretion in cases of billing error.
          </p>
        </LegalSection>

        <LegalSection title="3. Billing disputes">
          <p>
            If you believe you were charged incorrectly, contact{" "}
            <a href="mailto:support@dentora.vip" className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400">
              support@dentora.vip
            </a>{" "}
            before initiating a chargeback with your bank or card issuer -- we can typically resolve billing issues faster directly, and a
            chargeback may result in a temporary suspension of your account while it is investigated.
          </p>
        </LegalSection>

        <LegalSection title="4. Duplicate charges">
          <p>
            If our system charges you twice for the same billing period due to an error, we will identify and refund the duplicate charge in
            full once confirmed, typically within 5 business days of you reporting it.
          </p>
        </LegalSection>

        <LegalSection title="5. Failed payments">
          <ul className={legalListClass}>
            <li>If a renewal payment fails, we will retry the charge automatically and notify you by email.</li>
            <li>Your account enters a grace period during which you retain access while the issue is resolved.</li>
            <li>
              If payment continues to fail after the grace period, your subscription will be paused and access to paid features suspended
              until a valid payment method is added.
            </li>
            <li>No refund is owed for periods where access was suspended due to a failed payment on your side.</li>
          </ul>
        </LegalSection>

        <LegalSection title="6. Cancellation policy">
          <p>
            You can cancel anytime from your account&apos;s billing settings, with no cancellation fee. Cancelling stops future renewals;
            access continues through the end of the period you already paid for. See our{" "}
            <a href="/terms" className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400">
              Terms of Service
            </a>{" "}
            for full subscription terms.
          </p>
        </LegalSection>

        <LegalSection title="7. Enterprise plans">
          <p>
            Refunds for Enterprise plans are governed by the specific order form or agreement signed with your clinic, which takes precedence
            over this policy.
          </p>
        </LegalSection>

        <LegalSection title="8. How to request a refund">
          <p>
            Email{" "}
            <a href="mailto:support@dentora.vip" className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400">
              support@dentora.vip
            </a>{" "}
            with your account email and the reason for your request. We aim to respond within 2 business days and process approved refunds
            within 5-10 business days to your original payment method.
          </p>
        </LegalSection>

        <LegalSection title="9. Effective date">
          <p>This Refund Policy is effective as of August 7, 2026, and applies to all subscriptions purchased on or after that date.</p>
        </LegalSection>

        <LegalSection title="10. Contact us">
          <LegalContactCard>
            Refund questions? Email{" "}
            <a href="mailto:support@dentora.vip" className="font-semibold underline underline-offset-2">
              support@dentora.vip
            </a>
            .
          </LegalContactCard>
        </LegalSection>
      </LegalPageShell>
      <MarketingFooter navState={navState} />
    </>
  );
}
