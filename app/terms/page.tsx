import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { LegalPageShell, LegalSection, legalListClass, LegalContactCard } from "@/components/marketing/legal/legal-page-shell";
import { getMarketingNavState } from "@/lib/supabase/post-auth-destination";

const TITLE = "Terms of Service -- Dentora AI";
const DESCRIPTION =
  "The terms governing your use of Dentora AI, including subscriptions, billing, acceptable use, AI limitations, and liability.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/terms" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/terms",
    type: "website",
    siteName: "Dentora AI",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function TermsPage() {
  const navState = await getMarketingNavState();

  return (
    <>
      <MarketingHeader navState={navState} />
      <LegalPageShell
        icon={FileText}
        eyebrow="Legal"
        title="Terms of Service"
        intro="These terms govern your access to and use of Dentora AI. By creating an account or using the service, you agree to them."
        effectiveDate="August 7, 2026"
      >
        <LegalSection title="1. Acceptance of terms">
          <p>
            By creating a Dentora account, subscribing to a plan, or otherwise accessing the Dentora platform, you agree to be bound by these
            Terms of Service and our{" "}
            <a href="/privacy-policy" className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400">
              Privacy Policy
            </a>
            . If you are accepting on behalf of a dental clinic or other organization, you confirm you have authority to bind that
            organization.
          </p>
        </LegalSection>

        <LegalSection title="2. The service">
          <p>
            Dentora provides AI-assisted front-desk software for dental clinics, including appointment scheduling, patient communication,
            reminders, and clinic management tools, offered on a subscription basis.
          </p>
        </LegalSection>

        <LegalSection title="3. Accounts">
          <ul className={legalListClass}>
            <li>You must provide accurate, current information when creating an account.</li>
            <li>You are responsible for safeguarding your login credentials and for all activity under your account.</li>
            <li>Clinic owners are responsible for managing staff access and permissions within their clinic account.</li>
            <li>You must notify us promptly of any unauthorized use of your account.</li>
          </ul>
        </LegalSection>

        <LegalSection title="4. Subscriptions and billing">
          <ul className={legalListClass}>
            <li>Paid plans are billed monthly or yearly in advance, in the currency and interval you select at checkout.</li>
            <li>Subscriptions renew automatically at the end of each billing period unless cancelled beforehand.</li>
            <li>Prices are shown on our Pricing page and may be updated from time to time; changes apply from your next renewal.</li>
            <li>
              Payments are processed by Stripe. By subscribing, you authorize Dentora to charge your selected payment method on a recurring
              basis.
            </li>
            <li>
              Enterprise plans are quoted individually and governed by any separate order form or agreement signed between the Clinic and
              Dentora, which takes precedence over conflicting terms here.
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="5. Cancellation">
          <p>
            You may cancel your subscription at any time from your account&apos;s billing settings or by contacting support. Cancellation stops
            future renewals; access continues until the end of the current paid billing period. See our{" "}
            <a href="/refund-policy" className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400">
              Refund Policy
            </a>{" "}
            for details on refunds.
          </p>
        </LegalSection>

        <LegalSection title="6. Acceptable use">
          <p>You agree not to:</p>
          <ul className={legalListClass}>
            <li>Use the service for any unlawful purpose or in violation of applicable healthcare, data protection, or consumer laws.</li>
            <li>Attempt to gain unauthorized access to another Clinic&apos;s data or to Dentora&apos;s systems.</li>
            <li>Upload malicious code, or interfere with or disrupt the integrity or performance of the service.</li>
            <li>Reverse-engineer, resell, or white-label the platform without our written consent.</li>
            <li>Use the AI features to generate misleading medical advice presented as coming directly from a licensed professional.</li>
          </ul>
        </LegalSection>

        <LegalSection title="7. AI features and limitations">
          <ul className={legalListClass}>
            <li>
              Dentora&apos;s AI features (including the AI inbox, message drafting, and scheduling suggestions) are decision-support tools, not
              a substitute for professional clinical or administrative judgment.
            </li>
            <li>AI-generated output may be inaccurate or incomplete; clinic staff remain responsible for reviewing it before acting on it.</li>
            <li>Dentora does not use AI to make autonomous clinical decisions or diagnoses.</li>
            <li>
              You are responsible for ensuring AI-assisted patient communications comply with applicable healthcare regulations in your
              jurisdiction.
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="8. Patient data responsibilities">
          <p>
            As between you and Dentora, the Clinic remains the data controller for patient data entered into the platform and is responsible
            for having a valid legal basis to collect and process that data (e.g. patient consent or a healthcare-provision basis under
            applicable law). Dentora processes that data as a processor, on the Clinic&apos;s instructions, as described in our{" "}
            <a href="/privacy-policy" className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400">
              Privacy Policy
            </a>
            .
          </p>
        </LegalSection>

        <LegalSection title="9. Intellectual property">
          <p>
            Dentora and its licensors retain all rights, title, and interest in the platform, including its software, design, and trademarks.
            You retain all rights to the data you and your patients input into the platform (&quot;Customer Data&quot;). You grant Dentora a
            limited license to host, process, and display Customer Data solely to provide the service.
          </p>
        </LegalSection>

        <LegalSection title="10. Third-party services">
          <p>
            The service integrates with third-party providers (e.g. Stripe for payments, WhatsApp Business Platform for messaging). Your use
            of those integrations is also subject to the relevant provider&apos;s own terms.
          </p>
        </LegalSection>

        <LegalSection title="11. Termination">
          <p>
            We may suspend or terminate access to the service if you breach these terms, fail to pay applicable fees, or if required by law.
            We will provide reasonable notice where practicable, except in cases of suspected fraud, security risk, or legal requirement.
          </p>
        </LegalSection>

        <LegalSection title="12. Disclaimers">
          <p>
            The service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind, express or implied,
            including merchantability, fitness for a particular purpose, and non-infringement, to the maximum extent permitted by law.
          </p>
        </LegalSection>

        <LegalSection title="13. Limitation of liability">
          <p>
            To the maximum extent permitted by law, Dentora and its officers, employees, and licensors will not be liable for any indirect,
            incidental, special, consequential, or punitive damages, or any loss of profits or revenue, arising out of or related to your use
            of the service. Our total aggregate liability for any claim arising from these terms is limited to the amount you paid Dentora in
            the twelve (12) months preceding the claim. Nothing in these terms limits liability that cannot be limited under applicable law
            (e.g. for gross negligence, willful misconduct, or death or personal injury).
          </p>
        </LegalSection>

        <LegalSection title="14. Indemnification">
          <p>
            You agree to indemnify and hold Dentora harmless from any claims, damages, or expenses arising from your misuse of the service or
            violation of these terms, to the extent permitted by applicable law.
          </p>
        </LegalSection>

        <LegalSection title="15. Governing law">
          <p>
            These terms are governed by the laws of France, without regard to its conflict-of-law principles, except where mandatory local
            consumer-protection law grants you additional rights that cannot be waived. Any dispute will be submitted to the exclusive
            jurisdiction of the competent courts, without prejudice to any mandatory right you may have to bring proceedings in your own
            country of residence.
          </p>
        </LegalSection>

        <LegalSection title="16. Changes to these terms">
          <p>
            We may update these terms from time to time. We will notify you of material changes by email or in-app notice before they take
            effect. Continued use of the service after changes take effect constitutes acceptance of the updated terms.
          </p>
        </LegalSection>

        <LegalSection title="17. Contact us">
          <LegalContactCard>
            Questions about these Terms of Service? Email{" "}
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
