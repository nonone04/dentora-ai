import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  CalendarCheck2,
  FileSpreadsheet,
  Key,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { PageHero } from "@/components/marketing/page-hero";
import { getMarketingNavState } from "@/lib/supabase/post-auth-destination";

const TITLE = "Documentation -- Dentora AI";
const DESCRIPTION = "Guides for setting up your clinic, importing data, connecting WhatsApp, managing staff, and using Dentora AI's features.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/documentation" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/documentation", type: "website", siteName: "Dentora AI" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

const GUIDES = [
  {
    icon: Sparkles,
    title: "1. Create your clinic",
    description:
      "Sign up and set up your clinic profile -- name, address, opening hours, and services -- in under a minute. You'll land straight in your dashboard.",
  },
  {
    icon: FileSpreadsheet,
    title: "2. Import your data",
    description:
      "Bring in your existing patients, dentists, and services with the CSV import wizard: upload a file or paste rows, map your columns to Dentora's fields, and review before confirming.",
  },
  {
    icon: MessageCircle,
    title: "3. Connect WhatsApp",
    description:
      "Follow the guided wizard from Settings to link your WhatsApp Business number, so the AI receptionist can start receiving and replying to patient messages.",
  },
  {
    icon: CalendarCheck2,
    title: "Manage your schedule",
    description:
      "Drag and drop appointments across every dentist's calendar, with real-time conflict detection. Switch between day, week, and month views.",
  },
  {
    icon: Users,
    title: "Invite your team",
    description:
      "From Staff settings, invite dentists and receptionists by email and assign an owner, admin, dentist, or receptionist role -- each with scoped permissions.",
  },
  {
    icon: Key,
    title: "Generate API keys",
    description:
      "Owners and admins can generate scoped API keys from Staff settings for integrations. See the API page for how key-based access works.",
    href: "/api-docs",
  },
  {
    icon: ShieldCheck,
    title: "Understand data security",
    description:
      "Every clinic's data is isolated at the database layer, every sensitive action is logged in an audit trail, and access follows least-privilege, role-based permissions.",
    href: "/privacy-policy",
  },
];

export default async function DocumentationPage() {
  const navState = await getMarketingNavState();

  return (
    <>
      <MarketingHeader navState={navState} />
      <PageHero
        icon={BookOpen}
        eyebrow="Documentation"
        title="Guides to get the most out of Dentora"
        intro="Step-by-step guides for setting up your clinic and using every part of the product. Most clinics are fully live the same day."
      />

      <section className="bg-white pb-24 dark:bg-slate-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4">
            {GUIDES.map((guide) => {
              const content = (
                <div className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 transition-colors hover:border-blue-200 dark:border-white/10 dark:bg-slate-900 dark:hover:border-blue-400/30">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-md shadow-blue-600/20">
                    <guide.icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">{guide.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{guide.description}</p>
                  </div>
                </div>
              );
              return guide.href ? (
                <Link key={guide.title} href={guide.href}>
                  {content}
                </Link>
              ) : (
                <div key={guide.title}>{content}</div>
              );
            })}
          </div>

          <div className="mt-12 rounded-2xl border border-blue-100 bg-blue-50/60 p-6 text-center dark:border-blue-400/20 dark:bg-blue-400/10">
            <p className="text-[15px] text-blue-900 dark:text-blue-200">
              Can&apos;t find what you&apos;re looking for?{" "}
              <Link href="/help-center" className="font-semibold underline underline-offset-2">
                Visit the Help Center
              </Link>{" "}
              or{" "}
              <Link href="/contact" className="font-semibold underline underline-offset-2">
                contact our team
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <MarketingFooter navState={navState} />
    </>
  );
}
