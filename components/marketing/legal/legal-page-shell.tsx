import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { SectionBackground } from "@/components/marketing/motion/section-background";

/**
 * Shared hero + article wrapper for the legal pages (/privacy-policy,
 * /terms, /refund-policy, /cookies, /kyc) -- kept server-rendered (no
 * "use client") since none of these pages need interactivity, and their
 * content is what search engines/SEO checks need to see in the initial
 * HTML.
 */
export function LegalPageShell({
  icon: Icon = ShieldCheck,
  eyebrow,
  title,
  intro,
  effectiveDate,
  children,
}: {
  icon?: LucideIcon;
  eyebrow: string;
  title: string;
  intro: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-white dark:bg-slate-950">
      <SectionBackground intensity="subtle" />
      <div className="relative mx-auto max-w-3xl px-4 pt-20 pb-24 sm:px-6 sm:pt-28 lg:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
            <Icon className="size-3.5" aria-hidden="true" />
            {eyebrow}
          </span>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-white">{title}</h1>
          <p className="mt-4 text-balance text-lg text-slate-600 dark:text-slate-300">{intro}</p>
          <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">Effective date: {effectiveDate}</p>
        </div>

        <article className="mt-14 flex flex-col gap-10">{children}</article>
      </div>
    </section>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
    </div>
  );
}

export const legalListClass = "list-disc space-y-2 ps-5 marker:text-slate-400 dark:marker:text-slate-600";

export function LegalContactCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-6 text-[15px] leading-relaxed text-blue-900 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
      {children}
    </div>
  );
}
