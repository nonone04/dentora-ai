import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Lock, Sparkles, Target, Users, Workflow } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { PageHero } from "@/components/marketing/page-hero";
import { ctaGlowClass } from "@/components/marketing/motion/interactive-classes";
import { getMarketingNavState } from "@/lib/supabase/post-auth-destination";
import { cn } from "@/lib/utils";

const TITLE = "About Dentora AI";
const DESCRIPTION = "Dentora AI builds the calm, trustworthy AI front desk for modern dental clinics -- here's why, and how.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/about", type: "website", siteName: "Dentora AI" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

const VALUES = [
  {
    icon: Heart,
    title: "Care comes first",
    description: "Every feature exists to give clinic staff back time for patients -- not to replace the human side of care.",
  },
  {
    icon: Lock,
    title: "Trust by design",
    description: "Tenant-isolated data, role-based access, and full audit trails aren't add-ons -- they're the foundation.",
  },
  {
    icon: Workflow,
    title: "AI that stays in its lane",
    description: "Our AI drafts, suggests, and answers routine questions -- staff always review before anything touches a patient record.",
  },
  {
    icon: Users,
    title: "Built with real clinics",
    description: "Every workflow in Dentora was shaped by feedback from front-desk staff and dentists actually using it day to day.",
  },
];

export default async function AboutPage() {
  const navState = await getMarketingNavState();

  return (
    <>
      <MarketingHeader navState={navState} />
      <PageHero
        icon={Sparkles}
        eyebrow="About Dentora"
        title="The calm, confident front desk for modern dental clinics"
        intro="Dentora AI handles bookings, reminders, and patient messages around the clock, so clinic teams can spend less time on the phone and more time on care."
      />

      <section className="bg-white pb-20 dark:bg-slate-950">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
              <Target className="size-4" aria-hidden="true" />
              Our mission
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
              Dental clinics lose hours every day to routine phone calls, no-shows, and manual scheduling. Dentora exists to give that time
              back -- by combining an AI-powered receptionist, a real-time scheduler, and a full patient view in one product that&apos;s
              simple enough for a small clinic and robust enough for a growing multi-dentist practice. We built Dentora because we believe
              great patient care starts with a front desk that isn&apos;t overwhelmed.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-balance text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            What we believe
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {VALUES.map((value) => (
              <div
                key={value.title}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-white/10 dark:bg-slate-900"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-md shadow-blue-600/20">
                  <value.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 dark:bg-slate-950">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Want to see it for yourself?
          </h2>
          <p className="text-balance text-slate-600 dark:text-slate-300">
            Explore a fully seeded demo clinic, no signup required, or reach out if you have questions about Dentora for your practice.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/demo"
              className={cn(
                ctaGlowClass,
                "inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white",
              )}
            >
              Try the interactive demo
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:border-white/15 dark:text-slate-100"
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter navState={navState} />
    </>
  );
}
