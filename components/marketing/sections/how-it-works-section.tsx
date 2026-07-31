"use client";

import { ClipboardList, MessageCircle, UploadCloud } from "lucide-react";
import { cardHoverClass } from "@/components/marketing/motion/interactive-classes";
import { Reveal } from "@/components/marketing/motion/reveal";
import { SectionBackground } from "@/components/marketing/motion/section-background";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ICONS = [ClipboardList, UploadCloud, MessageCircle] as const;

export function HowItWorksSection() {
  const t = useTranslations();
  const steps = t.marketing.home.howItWorks.steps;

  return (
    <section className="defer-offscreen relative overflow-hidden bg-slate-50 py-16 dark:bg-slate-900/40 md:py-24">
      <SectionBackground intensity="subtle" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center md:mb-16">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 md:text-4xl dark:text-white">
            {t.marketing.home.howItWorks.title}
          </h2>
          <p className="mt-3 text-balance text-base text-slate-600 md:mt-4 md:text-lg dark:text-slate-300">
            {t.marketing.home.howItWorks.subtitle}
          </p>
        </Reveal>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = ICONS[index % ICONS.length];
            return (
              <Reveal key={step.title} delay={index * 100}>
                <div
                  className={cn(
                    "relative flex h-full flex-col items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900",
                    cardHoverClass,
                  )}
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-md shadow-blue-600/20">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
