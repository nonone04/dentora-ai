"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Ban, Check, RotateCcw, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { cardHoverClass, ctaGlowClass } from "@/components/marketing/motion/interactive-classes";
import { Reveal } from "@/components/marketing/motion/reveal";
import { SectionBackground } from "@/components/marketing/motion/section-background";
import { useTranslations, type Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const REASSURANCE_ICONS: LucideIcon[] = [RotateCcw, Ban, ShieldCheck];

type Plan = Dictionary["marketing"]["pricing"]["plans"][number];

/** Shared card body for both the desktop grid and the mobile swipe carousel -- only the surrounding container/layout differs between the two. */
function PlanCard({ plan, isPopular, popularLabel }: { plan: Plan; isPopular: boolean; popularLabel: string }) {
  const isCustom = !plan.yearlyBilledTotal;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-white p-7 dark:bg-slate-900",
        isPopular
          ? "border-blue-600 shadow-xl shadow-blue-600/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:border-blue-400/40"
          : cn("border-slate-200/80 dark:border-white/10", cardHoverClass),
      )}
    >
      {isPopular && (
        <span className="absolute -top-3 start-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
          <Sparkles className="size-3" aria-hidden="true" />
          {popularLabel}
        </span>
      )}
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{plan.name}</p>
      <p className="mt-2 text-balance text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{plan.monthlyPrice}</span>
        {!isCustom && plan.priceSuffix && <span className="text-sm text-slate-400 dark:text-slate-500">{plan.priceSuffix}</span>}
      </div>
      <ul className="mt-6 flex flex-1 flex-col gap-2.5">
        {plan.features.slice(0, 3).map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Check className="mt-0.5 size-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PricingPreviewSection() {
  const t = useTranslations();
  const plans = t.marketing.pricing.plans;
  const popularIndex = 1;
  const mobileTrackRef = useRef<HTMLDivElement>(null);

  // Opens the mobile carousel already snapped to the Professional plan --
  // an instant (non-animated) scroll on mount, so it never visibly jumps
  // after paint.
  useEffect(() => {
    const track = mobileTrackRef.current;
    const popularCard = track?.children[popularIndex] as HTMLElement | undefined;
    popularCard?.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
  }, []);

  return (
    <section className="defer-offscreen relative overflow-hidden bg-slate-50 py-16 dark:bg-slate-900/40 md:py-24">
      <SectionBackground intensity="subtle" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center md:mb-16">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 md:text-4xl dark:text-white">
            {t.marketing.home.pricingPreview.title}
          </h2>
          <p className="mt-3 text-balance text-base text-slate-600 md:mt-4 md:text-lg dark:text-slate-300">
            {t.marketing.home.pricingPreview.subtitle}
          </p>
        </Reveal>

        {/* Desktop: static 3-up grid, unchanged. */}
        <div className="hidden md:grid md:gap-6 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 100}>
              <PlanCard plan={plan} isPopular={index === popularIndex} popularLabel={t.marketing.pricing.popular} />
            </Reveal>
          ))}
        </div>

        {/* Mobile: swipeable cards opened on the Professional plan, plus a sticky bottom CTA that rides along while this section scrolls by. */}
        <div className="md:hidden">
          <div ref={mobileTrackRef} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1">
            {plans.map((plan, index) => (
              <div key={plan.name} className="w-[85%] shrink-0 snap-center">
                <PlanCard plan={plan} isPopular={index === popularIndex} popularLabel={t.marketing.pricing.popular} />
              </div>
            ))}
          </div>

          <div className="sticky bottom-3 z-10 mt-5">
            <Link
              href="/pricing"
              className={cn(
                "flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20",
                ctaGlowClass,
              )}
            >
              {t.marketing.home.pricingPreview.viewAll}
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <Reveal
          delay={150}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-slate-500 dark:text-slate-400"
        >
          {t.marketing.pricing.reassurance.map((item, i) => {
            const Icon = REASSURANCE_ICONS[i] ?? ShieldCheck;
            return (
              <span key={item} className="inline-flex items-center gap-2">
                <Icon className="size-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                {item}
              </span>
            );
          })}
        </Reveal>

        <Reveal className="mt-8 hidden justify-center md:flex">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
          >
            {t.marketing.home.pricingPreview.viewAll}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
