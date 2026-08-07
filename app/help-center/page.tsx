import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarCheck2, CreditCard, LifeBuoy, MessageCircle, ShieldCheck, Sparkles, Users } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { PageHero } from "@/components/marketing/page-hero";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getServerDictionary } from "@/lib/i18n/server";
import { getMarketingNavState } from "@/lib/supabase/post-auth-destination";

const TITLE = "Help Center -- Dentora AI";
const DESCRIPTION = "Find answers about getting started, billing, AI features, WhatsApp integration, and account security for Dentora AI.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/help-center" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/help-center", type: "website", siteName: "Dentora AI" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

const CATEGORIES = [
  {
    icon: Sparkles,
    title: "Getting started",
    description: "Create your clinic, import patients and dentists, and connect WhatsApp -- most clinics are live the same day.",
  },
  {
    icon: CreditCard,
    title: "Billing & subscriptions",
    description: "Plans, monthly vs. yearly billing, upgrading or downgrading, and how refunds work.",
    href: "/refund-policy",
  },
  {
    icon: MessageCircle,
    title: "AI features",
    description: "How the AI inbox, message drafting, and appointment suggestions work -- and what always needs staff review.",
  },
  {
    icon: CalendarCheck2,
    title: "Scheduling",
    description: "Drag-and-drop appointments, conflict detection, and managing multiple dentists' calendars.",
  },
  {
    icon: Users,
    title: "Staff & roles",
    description: "Inviting team members, assigning owner/admin/dentist/receptionist roles, and managing access.",
  },
  {
    icon: ShieldCheck,
    title: "Security & data",
    description: "Tenant isolation, audit logs, and how your clinic's and patients' data is protected.",
    href: "/privacy-policy",
  },
];

export default async function HelpCenterPage() {
  const [navState, t] = await Promise.all([getMarketingNavState(), getServerDictionary()]);
  const faqItems = t.marketing.home.faq.items;

  return (
    <>
      <MarketingHeader navState={navState} />
      <PageHero
        icon={LifeBuoy}
        eyebrow="Help Center"
        title="How can we help?"
        intro="Browse common topics below, or reach out to our team directly if you can't find what you're looking for."
      />

      <section className="bg-white pb-4 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((category) => {
              const Card = (
                <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 transition-colors hover:border-blue-200 dark:border-white/10 dark:bg-slate-900 dark:hover:border-blue-400/30">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-md shadow-blue-600/20">
                    <category.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{category.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{category.description}</p>
                </div>
              );
              return category.href ? (
                <Link key={category.title} href={category.href}>
                  {Card}
                </Link>
              ) : (
                <div key={category.title}>{Card}</div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20 dark:bg-slate-900/40">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-balance text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Frequently asked questions
          </h2>
          <div className="mt-10">
            <Accordion className="divide-y divide-slate-200 rounded-2xl border border-slate-200/80 bg-white px-6 dark:divide-white/10 dark:border-white/10 dark:bg-slate-900">
              {faqItems.map((item) => (
                <AccordionItem key={item.question} value={item.question} className="border-slate-200 py-1.5 dark:border-white/10">
                  <AccordionTrigger className="py-4 text-base font-medium text-slate-900 dark:text-white">{item.question}</AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 dark:bg-slate-950">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-md shadow-blue-600/20">
            <BookOpen className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Still need help?
          </h2>
          <p className="text-balance text-slate-600 dark:text-slate-300">
            Check the{" "}
            <Link href="/documentation" className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400">
              documentation
            </Link>{" "}
            for step-by-step guides, or contact our team directly.
          </p>
          <Link
            href="/contact"
            className="mt-2 inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25"
          >
            Contact support
          </Link>
        </div>
      </section>

      <MarketingFooter navState={navState} />
    </>
  );
}
