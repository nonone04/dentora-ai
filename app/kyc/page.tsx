import type { Metadata } from "next";
import { UserCheck } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { LegalPageShell, LegalSection, legalListClass, LegalContactCard } from "@/components/marketing/legal/legal-page-shell";
import { getMarketingNavState } from "@/lib/supabase/post-auth-destination";

const TITLE = "KYC / Business Verification -- Dentora AI";
const DESCRIPTION =
  "Why Dentora AI may request business verification (KYC) -- company checks, government ID, clinic ownership, VAT/Tax ID, and how documents are handled.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/kyc" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/kyc",
    type: "website",
    siteName: "Dentora AI",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function KycPage() {
  const navState = await getMarketingNavState();

  return (
    <>
      <MarketingHeader navState={navState} />
      <LegalPageShell
        icon={UserCheck}
        eyebrow="Legal"
        title="KYC & Business Verification"
        intro="Dentora may ask clinics to verify their business before unlocking certain features, such as payment collection or higher usage limits. Here's why, and what to expect."
        effectiveDate="August 7, 2026"
      >
        <LegalSection title="1. Why we verify">
          <p>
            As a platform that handles patient data and, for some clinics, payment flows, Dentora may need to confirm that an account
            genuinely represents a licensed dental clinic before granting access to sensitive features. This protects clinics, their
            patients, and the integrity of the platform from fraud and impersonation.
          </p>
        </LegalSection>

        <LegalSection title="2. Company verification">
          <p>
            We may ask for basic company details -- legal business name, registration number, and country of registration -- to confirm the
            clinic is a legitimate, registered entity (or, for sole practitioners, a valid professional registration).
          </p>
        </LegalSection>

        <LegalSection title="3. Government ID">
          <p>
            We may request a government-issued photo ID (e.g. passport or national ID card) for the account owner or an authorized
            representative, to confirm the person managing the account is who they say they are.
          </p>
        </LegalSection>

        <LegalSection title="4. Clinic ownership">
          <p>
            We may ask for proof that the person creating the account is authorized to act on behalf of the clinic -- for example, a
            professional license, a clinic registration document, or a letter of authorization from the clinic&apos;s owner.
          </p>
        </LegalSection>

        <LegalSection title="5. VAT / Tax ID">
          <p>
            For billing and invoicing purposes, we may request your VAT number or local tax identification number, particularly for
            Enterprise agreements or clinics operating in jurisdictions that require it on invoices.
          </p>
        </LegalSection>

        <LegalSection title="6. Fraud prevention">
          <ul className={legalListClass}>
            <li>Verification helps us prevent fake clinics from being created to abuse trials, promotions, or payment flows.</li>
            <li>It helps protect real clinics from having their identity or brand impersonated on the platform.</li>
            <li>It supports compliance with our payment processor&apos;s (Stripe) own KYC/AML obligations for platforms that route payments.</li>
          </ul>
        </LegalSection>

        <LegalSection title="7. Secure document handling">
          <ul className={legalListClass}>
            <li>Documents you submit are transmitted over an encrypted connection and stored encrypted at rest.</li>
            <li>Access is restricted to the small team responsible for verification, on a need-to-know basis.</li>
            <li>Documents are retained only as long as necessary to complete verification and meet legal record-keeping obligations, then deleted.</li>
            <li>
              We never sell or share verification documents with third parties, except where required by law or our payment
              processor&apos;s own compliance checks.
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="8. Verification timeline">
          <p>
            Most verification requests are reviewed within{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">1-3 business days</span> of submitting complete documents. If
            additional information is needed, we&apos;ll email you directly with what&apos;s missing. Features gated behind verification
            remain unavailable until it&apos;s complete; the rest of your Dentora account is unaffected.
          </p>
        </LegalSection>

        <LegalSection title="9. If verification is unsuccessful">
          <p>
            If we&apos;re unable to verify your business, we&apos;ll explain why and give you the opportunity to submit corrected or
            additional documentation. If verification ultimately fails, access to the gated feature will remain restricted, though your core
            Dentora subscription and existing data are not affected.
          </p>
        </LegalSection>

        <LegalSection title="10. Contact us">
          <LegalContactCard>
            Questions about verification, or need to submit documents? Email{" "}
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
