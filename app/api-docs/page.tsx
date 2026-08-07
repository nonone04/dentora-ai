import type { Metadata } from "next";
import Link from "next/link";
import { Key, Lock, Plug, ShieldCheck, Terminal, Webhook } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { PageHero } from "@/components/marketing/page-hero";
import { getMarketingNavState } from "@/lib/supabase/post-auth-destination";

const TITLE = "API -- Dentora AI";
const DESCRIPTION = "Integrate with Dentora AI using scoped, revocable API keys generated from your clinic's staff settings.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/api-docs" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/api-docs", type: "website", siteName: "Dentora AI" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

const PRINCIPLES = [
  {
    icon: Key,
    title: "Scoped API keys",
    description:
      "Clinic owners and admins generate API keys from Staff settings. Each key is tied to your clinic's tenant and can be revoked at any time.",
  },
  {
    icon: Lock,
    title: "Shown once, stored hashed",
    description:
      "The full key secret is shown to you exactly once at creation time. Dentora stores only its hash, so we can never display or recover it afterward.",
  },
  {
    icon: ShieldCheck,
    title: "Same isolation guarantees",
    description: "API access respects the same tenant isolation and role-based permissions as the Dentora dashboard -- nothing bypasses them.",
  },
  {
    icon: Webhook,
    title: "Built for integrations",
    description: "Designed to connect Dentora to your clinic's other tools -- practice management software, reporting, or custom workflows.",
  },
];

export default async function ApiDocsPage() {
  const navState = await getMarketingNavState();

  return (
    <>
      <MarketingHeader navState={navState} />
      <PageHero
        icon={Plug}
        eyebrow="API"
        title="Connect Dentora to your stack"
        intro="Generate a scoped API key from your clinic's Staff settings and authenticate your requests with it -- built on the same security model as the rest of Dentora."
      />

      <section className="bg-white pb-16 dark:bg-slate-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title} className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-md shadow-blue-600/20">
                  <principle.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{principle.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{principle.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 dark:bg-slate-900/40">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
            <Terminal className="size-4" aria-hidden="true" />
            Authenticating requests
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            Generated keys are prefixed <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm dark:bg-white/10">dta_live_</code>{" "}
            so you can identify them at a glance. Every request is authenticated with a bearer token, in the shape below:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-900 p-5 text-sm text-slate-100 dark:border-white/10">
            <code>{`curl https://dentora.vip/api/v1/appointments \\
  -H "Authorization: Bearer dta_live_••••••••••••••••••••"`}</code>
          </pre>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            This is an illustrative example of the request shape, not a live public endpoint yet. The full endpoint reference (appointments,
            patients, availability, and webhooks) is shared directly with clinics once API access is enabled on their account -- reach out
            below to request it.
          </p>
        </div>
      </section>

      <section className="bg-white py-20 dark:bg-slate-950">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Ready to integrate?
          </h2>
          <p className="text-balance text-slate-600 dark:text-slate-300">
            Generate a key from your clinic&apos;s Staff settings, or contact us if you need API access enabled or have integration
            questions.
          </p>
          <Link
            href="/contact"
            className="mt-2 inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25"
          >
            Contact us about API access
          </Link>
        </div>
      </section>

      <MarketingFooter navState={navState} />
    </>
  );
}
