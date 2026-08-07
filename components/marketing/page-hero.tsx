import type { LucideIcon } from "lucide-react";
import { SectionBackground } from "@/components/marketing/motion/section-background";

/** Shared hero banner for lightweight marketing pages (About, Help Center, Documentation, API) -- server-rendered, no interactivity needed. */
export function PageHero({
  icon: Icon,
  eyebrow,
  title,
  intro,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <section className="relative overflow-hidden bg-white dark:bg-slate-950">
      <SectionBackground intensity="subtle" />
      <div className="relative mx-auto max-w-3xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28 lg:px-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
          <Icon className="size-3.5" aria-hidden="true" />
          {eyebrow}
        </span>
        <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-white">{title}</h1>
        <p className="mt-4 text-balance text-lg text-slate-600 dark:text-slate-300">{intro}</p>
      </div>
    </section>
  );
}
