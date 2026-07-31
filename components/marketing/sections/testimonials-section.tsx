"use client";

import { Quote, Sparkles } from "lucide-react";
import { Reveal } from "@/components/marketing/motion/reveal";
import { SectionBackground } from "@/components/marketing/motion/section-background";
import { useTranslations } from "@/lib/i18n";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

/**
 * One detailed case study rather than a wall of short quotes -- three
 * near-identical cards from the same clinic read as thin social proof
 * stretched across cards. A single, fuller story with named, concrete
 * results is more credible until there are genuinely distinct customers
 * to feature.
 */
export function TestimonialsSection() {
  const t = useTranslations();
  const { eyebrow, title, caseStudy } = t.marketing.home.testimonials;

  return (
    <section className="defer-offscreen relative overflow-hidden bg-white py-24 dark:bg-slate-950">
      <SectionBackground intensity="subtle" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {eyebrow}
          </span>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">{title}</h2>
        </Reveal>

        <Reveal variant="scale" className="mx-auto max-w-4xl">
          <figure className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-slate-900">
            <div className="p-8 sm:p-10">
              <Quote className="size-8 text-blue-200 dark:text-blue-500/30" aria-hidden="true" />
              <blockquote className="mt-5 text-balance text-lg leading-relaxed text-slate-700 dark:text-slate-200">
                {caseStudy.quote}
              </blockquote>
              <figcaption className="mt-7 flex items-center gap-3">
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-semibold text-white"
                  aria-hidden="true"
                >
                  {initials(caseStudy.name)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{caseStudy.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{caseStudy.role}</p>
                </div>
              </figcaption>
            </div>

            <div className="grid grid-cols-1 divide-y divide-slate-100 border-t border-slate-100 bg-slate-50 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-white/5 dark:border-white/5 dark:bg-white/[0.02]">
              {caseStudy.stats.map((stat) => (
                <div key={stat.label} className="p-6 text-center">
                  <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
