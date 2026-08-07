import type { Metadata } from "next";
import { Cookie } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { LegalPageShell, LegalSection, legalListClass, LegalContactCard } from "@/components/marketing/legal/legal-page-shell";
import { getMarketingNavState } from "@/lib/supabase/post-auth-destination";

const TITLE = "Cookie Policy -- Dentora AI";
const DESCRIPTION = "Which cookies Dentora AI uses -- essential, analytics, preference, and third-party -- and how to manage them.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/cookies" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/cookies",
    type: "website",
    siteName: "Dentora AI",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const TABLE_ROWS = [
  { name: "dentora_locale", purpose: "Remembers your preferred language (English, French, Arabic).", duration: "1 year", type: "Essential" },
  { name: "dentora_currency", purpose: "Remembers your preferred display currency on the pricing page.", duration: "1 year", type: "Essential" },
  { name: "sb-*-auth-token", purpose: "Keeps you signed in (set by our authentication provider, Supabase).", duration: "Session / refresh-based", type: "Essential" },
  { name: "theme", purpose: "Remembers your light/dark/system theme preference.", duration: "Persistent", type: "Preference" },
  { name: "__stripe_*", purpose: "Fraud prevention during Stripe Checkout.", duration: "Up to 1 year", type: "Third-party" },
];

export default async function CookiesPage() {
  const navState = await getMarketingNavState();

  return (
    <>
      <MarketingHeader navState={navState} />
      <LegalPageShell
        icon={Cookie}
        eyebrow="Legal"
        title="Cookie Policy"
        intro="What cookies Dentora AI uses, why, and how you can control them."
        effectiveDate="August 7, 2026"
      >
        <LegalSection title="1. What are cookies">
          <p>
            Cookies are small text files stored on your device when you visit a website. We use cookies (and similar technologies like local
            storage) to make Dentora work, remember your preferences, and understand how the product is used.
          </p>
        </LegalSection>

        <LegalSection title="2. Essential cookies">
          <p>
            These are required for the site to function and cannot be switched off -- they include your sign-in session, your selected
            language, and your selected currency. Without them, core features like logging in and viewing prices in your currency would not
            work.
          </p>
        </LegalSection>

        <LegalSection title="3. Analytics cookies">
          <p>
            We use analytics to understand which pages and features are used, so we can improve the product. Analytics data is aggregated and
            used only to understand product usage patterns -- not to build individual advertising profiles.
          </p>
        </LegalSection>

        <LegalSection title="4. Preference cookies">
          <p>Preference cookies remember choices like your light/dark theme, so you don&apos;t have to reset it on every visit.</p>
        </LegalSection>

        <LegalSection title="5. Third-party cookies">
          <p>
            When you check out with Stripe, Stripe may set its own cookies for fraud prevention and to process your payment securely. These
            are governed by Stripe&apos;s own cookie and privacy policies, not by Dentora.
          </p>
        </LegalSection>

        <LegalSection title="6. Cookies we use">
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
            <table className="w-full min-w-[560px] border-collapse text-start text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                  <th className="p-3 text-start font-medium text-slate-500 dark:text-slate-400">Cookie</th>
                  <th className="p-3 text-start font-medium text-slate-500 dark:text-slate-400">Purpose</th>
                  <th className="p-3 text-start font-medium text-slate-500 dark:text-slate-400">Duration</th>
                  <th className="p-3 text-start font-medium text-slate-500 dark:text-slate-400">Type</th>
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row) => (
                  <tr key={row.name} className="border-b border-slate-100 last:border-b-0 dark:border-white/5">
                    <td className="p-3 font-mono text-xs text-slate-700 dark:text-slate-200">{row.name}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{row.purpose}</td>
                    <td className="p-3 text-slate-500 dark:text-slate-400">{row.duration}</td>
                    <td className="p-3 text-slate-500 dark:text-slate-400">{row.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LegalSection>

        <LegalSection title="7. Managing cookies">
          <ul className={legalListClass}>
            <li>You can change your language and currency preference at any time using the selectors in the site header/pricing page.</li>
            <li>You can change your theme preference from the theme toggle in the app.</li>
            <li>
              Most browsers let you block or delete cookies in their settings. Blocking essential cookies will prevent you from staying signed
              in or using currency-aware pricing correctly.
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="8. Changes to this policy">
          <p>We may update this Cookie Policy as our use of cookies changes. Material changes will be reflected by updating the effective date above.</p>
        </LegalSection>

        <LegalSection title="9. Contact us">
          <LegalContactCard>
            Questions about cookies? Email{" "}
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
