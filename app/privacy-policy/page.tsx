import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { LegalPageShell, LegalSection, legalListClass, LegalContactCard } from "@/components/marketing/legal/legal-page-shell";
import { getMarketingNavState } from "@/lib/supabase/post-auth-destination";

const TITLE = "Privacy Policy -- Dentora AI";
const DESCRIPTION =
  "How Dentora AI collects, uses, and protects clinic and patient data, including GDPR rights, AI processing, Stripe payments, and third-party providers.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/privacy-policy" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/privacy-policy",
    type: "website",
    siteName: "Dentora AI",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function PrivacyPolicyPage() {
  const navState = await getMarketingNavState();

  return (
    <>
      <MarketingHeader navState={navState} />
      <LegalPageShell
        icon={ShieldCheck}
        eyebrow="Legal"
        title="Privacy Policy"
        intro="This policy explains what data Dentora AI collects, why we collect it, and the rights you and your patients have over it."
        effectiveDate="August 7, 2026"
      >
        <LegalSection title="1. Who we are">
          <p>
            Dentora AI (&quot;Dentora&quot;, &quot;we&quot;, &quot;us&quot;) provides AI-powered front-desk software for dental clinics, including
            appointment scheduling, patient messaging, and clinic management tools at{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">dentora.vip</span>. For most of the personal data described in
            this policy, Dentora acts as a <span className="font-medium text-slate-700 dark:text-slate-200">data processor</span> on behalf of
            the dental clinic that operates the account (the &quot;Clinic&quot;), and the Clinic acts as the{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">data controller</span> for its patients&apos; data. For account,
            billing, and usage data tied to the Clinic itself, Dentora acts as the data controller.
          </p>
        </LegalSection>

        <LegalSection title="2. Data we collect">
          <p>We collect the following categories of data:</p>
          <ul className={legalListClass}>
            <li>
              <span className="font-medium text-slate-700 dark:text-slate-200">Account &amp; clinic data:</span> clinic name, staff names,
              email addresses, phone numbers, role/permissions, and billing details.
            </li>
            <li>
              <span className="font-medium text-slate-700 dark:text-slate-200">Patient data:</span> entered by the Clinic into Dentora --
              patient names, contact details, appointment history, treatment notes, and messages exchanged through the platform (including
              WhatsApp, when connected).
            </li>
            <li>
              <span className="font-medium text-slate-700 dark:text-slate-200">Usage data:</span> log data, device/browser information, IP
              address, and product analytics events (pages viewed, features used) collected via cookies -- see our{" "}
              <a href="/cookies" className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400">
                Cookie Policy
              </a>
              .
            </li>
            <li>
              <span className="font-medium text-slate-700 dark:text-slate-200">Payment data:</span> processed directly by Stripe -- Dentora
              never stores full card numbers (see &quot;Stripe &amp; payments&quot; below).
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="3. How we use data">
          <ul className={legalListClass}>
            <li>To provide, operate, and maintain the Dentora platform (scheduling, reminders, messaging, reporting).</li>
            <li>To power AI features such as appointment suggestions, message drafting, and patient-reliability scoring.</li>
            <li>To process subscription payments and send billing communications.</li>
            <li>To secure the platform, prevent fraud and abuse, and enforce our Terms of Service.</li>
            <li>To provide customer support and respond to inquiries.</li>
            <li>To improve the product through aggregated, de-identified product analytics.</li>
          </ul>
        </LegalSection>

        <LegalSection title="4. Legal basis for processing (GDPR)">
          <p>Where the GDPR applies, we rely on the following legal bases under Article 6 GDPR:</p>
          <ul className={legalListClass}>
            <li>
              <span className="font-medium text-slate-700 dark:text-slate-200">Contract:</span> to provide the subscription service the Clinic
              signed up for.
            </li>
            <li>
              <span className="font-medium text-slate-700 dark:text-slate-200">Legitimate interests:</span> product security, fraud
              prevention, and service improvement.
            </li>
            <li>
              <span className="font-medium text-slate-700 dark:text-slate-200">Legal obligation:</span> tax, accounting, and KYC/AML record
              keeping.
            </li>
            <li>
              <span className="font-medium text-slate-700 dark:text-slate-200">Consent:</span> optional analytics and marketing communications,
              where required.
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="5. Patient and clinic data isolation">
          <p>
            Every Clinic&apos;s data is logically isolated from every other Clinic&apos;s data (multi-tenant isolation enforced at the database
            level), access to patient records is restricted by role-based permissions, and all administrative actions on patient data are
            logged in an audit trail. Dentora only accesses Clinic data to provide the service, investigate a support request the Clinic
            raised, or comply with a legal obligation.
          </p>
        </LegalSection>

        <LegalSection title="6. AI processing">
          <p>
            Dentora uses AI models (including third-party model providers such as Anthropic) to power features like the AI inbox, appointment
            suggestions, and message drafting. Data sent to an AI provider for these features is transmitted securely, used only to generate
            the requested output, and is not used by Dentora or its AI providers to train models on Clinic or patient data. AI-generated
            suggestions (e.g. draft replies, scheduling recommendations) are always reviewable by clinic staff before they take effect on a
            patient record.
          </p>
        </LegalSection>

        <LegalSection title="7. Cookies and analytics">
          <p>
            We use essential cookies to keep you signed in and remember your language, currency, and theme preferences, and analytics cookies
            to understand how the product is used so we can improve it. See our full{" "}
            <a href="/cookies" className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400">
              Cookie Policy
            </a>{" "}
            for details and how to manage your preferences.
          </p>
        </LegalSection>

        <LegalSection title="8. Stripe and payments">
          <p>
            Subscription payments are processed by <span className="font-medium text-slate-700 dark:text-slate-200">Stripe, Inc.</span> Stripe
            collects and stores your payment method details directly; Dentora only receives limited billing metadata (such as subscription
            status, plan, and the last four digits of a card) needed to manage your account. Stripe&apos;s use of your data is governed by{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">Stripe&apos;s own privacy policy</span>.
          </p>
        </LegalSection>

        <LegalSection title="9. Other third-party providers">
          <p>We share data with a small number of vetted providers, strictly to operate the service:</p>
          <ul className={legalListClass}>
            <li>
              <span className="font-medium text-slate-700 dark:text-slate-200">Supabase</span> -- database hosting, authentication, and
              file storage.
            </li>
            <li>
              <span className="font-medium text-slate-700 dark:text-slate-200">Stripe</span> -- subscription billing and payment processing.
            </li>
            <li>
              <span className="font-medium text-slate-700 dark:text-slate-200">Resend</span> -- transactional email delivery.
            </li>
            <li>
              <span className="font-medium text-slate-700 dark:text-slate-200">WhatsApp Business Platform (Meta)</span> -- optional patient
              messaging, when a Clinic connects its WhatsApp number.
            </li>
            <li>
              <span className="font-medium text-slate-700 dark:text-slate-200">Vercel</span> -- application hosting and infrastructure.
            </li>
          </ul>
          <p>Each provider processes data solely on our instructions and under a data processing agreement where required.</p>
        </LegalSection>

        <LegalSection title="10. Data retention">
          <p>
            We retain Clinic and patient data for as long as the Clinic&apos;s subscription is active, plus a reasonable period afterward to
            allow reactivation and to meet legal, tax, and accounting retention obligations. A Clinic can request deletion of its data at any
            time by contacting us; we will delete or anonymize it within 30 days, except where retention is legally required.
          </p>
        </LegalSection>

        <LegalSection title="11. Data security">
          <p>
            Data is encrypted in transit (TLS) and at rest, access is protected by role-based permissions and audit logging, and we apply the
            principle of least privilege to internal access to production data.
          </p>
        </LegalSection>

        <LegalSection title="12. International transfers">
          <p>
            Where personal data is transferred outside the European Economic Area, we rely on appropriate safeguards, such as Standard
            Contractual Clauses or the provider&apos;s own adequacy/compliance framework (e.g. Stripe, Supabase, and Vercel each maintain their
            own GDPR-compliant transfer mechanisms).
          </p>
        </LegalSection>

        <LegalSection title="13. Your rights">
          <p>Subject to applicable law (including the GDPR for EU/EEA residents), you may have the right to:</p>
          <ul className={legalListClass}>
            <li>Access the personal data we (or, for patient data, the Clinic) hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request erasure (&quot;right to be forgotten&quot;), subject to legal retention requirements.</li>
            <li>Object to or restrict certain processing.</li>
            <li>Request data portability.</li>
            <li>Withdraw consent at any time, where processing is based on consent.</li>
            <li>Lodge a complaint with your local data protection authority.</li>
          </ul>
          <p>
            If you are a patient of a Clinic using Dentora, please contact the Clinic directly first, since the Clinic controls your patient
            record. We will support the Clinic in fulfilling that request.
          </p>
        </LegalSection>

        <LegalSection title="14. Children's privacy">
          <p>
            Dentora is a business-to-business product intended for use by dental clinic staff who are adults. Patient records may include
            minors&apos; data entered by the Clinic in the course of providing dental care; this data is handled under the same safeguards
            described above, on the Clinic&apos;s instructions as data controller.
          </p>
        </LegalSection>

        <LegalSection title="15. Changes to this policy">
          <p>
            We may update this policy from time to time. Material changes will be communicated by email or an in-app notice before they take
            effect. The &quot;Effective date&quot; above reflects the latest revision.
          </p>
        </LegalSection>

        <LegalSection title="16. Contact us">
          <LegalContactCard>
            Questions about this Privacy Policy or a data request? Email{" "}
            <a href="mailto:support@dentora.vip" className="font-semibold underline underline-offset-2">
              support@dentora.vip
            </a>{" "}
            or{" "}
            <a href="mailto:hello@dentora.vip" className="font-semibold underline underline-offset-2">
              hello@dentora.vip
            </a>
            .
          </LegalContactCard>
        </LegalSection>
      </LegalPageShell>
      <MarketingFooter navState={navState} />
    </>
  );
}
