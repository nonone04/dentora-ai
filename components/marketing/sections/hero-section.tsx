"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck2, Shield, Sparkles } from "lucide-react";
import { CountUp } from "@/components/marketing/motion/count-up";
import { ctaGlowClass, ctaHoverClass } from "@/components/marketing/motion/interactive-classes";
import { ParallaxLayer, ParallaxProvider } from "@/components/marketing/motion/mouse-parallax";
import { Reveal } from "@/components/marketing/motion/reveal";
import { SectionBackground } from "@/components/marketing/motion/section-background";
import { TextReveal } from "@/components/marketing/motion/text-reveal";
import { TiltFrame } from "@/components/marketing/motion/tilt-frame";
import { ProductFrame } from "@/components/marketing/product-frame";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function HeroSection() {
  const t = useTranslations();
  const headlineLabel = `${t.marketing.home.headlineStart} ${t.marketing.home.headlineHighlight}`;

  return (
    <section className="relative overflow-hidden bg-white dark:bg-slate-950">
      <ParallaxProvider className="relative">
        <SectionBackground intensity="hero" />

        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-8 sm:px-6 sm:pt-28 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
                <Sparkles className="size-3.5" aria-hidden="true" />
                {t.marketing.home.eyebrow}
              </span>
            </Reveal>

            <h1
              aria-label={headlineLabel}
              className="mt-6 text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl dark:text-white"
            >
              <TextReveal
                segments={[
                  { text: t.marketing.home.headlineStart },
                  {
                    node: (
                      <span className="bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent">
                        {t.marketing.home.headlineHighlight}
                      </span>
                    ),
                  },
                ]}
              />
            </h1>

            <Reveal delay={550}>
              <p className="mt-6 max-w-2xl text-balance text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                {t.marketing.home.subheadline}
              </p>
            </Reveal>

            <Reveal delay={700}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700",
                    ctaGlowClass,
                  )}
                >
                  {t.marketing.home.ctaPrimary}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
                <Link
                  href="/demo"
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10",
                    ctaHoverClass,
                  )}
                >
                  {t.marketing.home.ctaSecondary}
                </Link>
              </div>
            </Reveal>

            <Reveal delay={850}>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-400 dark:text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="size-3.5" aria-hidden="true" />
                  {t.marketing.home.trustLine}
                </span>
                <span>{t.marketing.home.noCreditCard}</span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={950} className="relative mx-auto mt-16 max-w-5xl">
            <TiltFrame>
              <ProductFrame src="/marketing/screenshots/dashboard.jpg" alt={t.marketing.home.heroScreenshotAlt} priority premium className="mx-auto" />
            </TiltFrame>

            <ParallaxLayer strength={6} className="absolute -start-6 top-10 hidden w-52 sm:block">
              <div
                className="float-slow flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/95 p-3.5 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/95"
                aria-hidden="true"
              >
                <span className="flex size-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
                  <CalendarCheck2 className="size-4" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{t.marketing.home.floatingCardAppointments}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{t.marketing.home.floatingCardAppointmentsSub}</p>
                </div>
              </div>
            </ParallaxLayer>

            <ParallaxLayer strength={6} className="absolute -end-6 bottom-10 hidden w-48 sm:block">
              <div
                className="float-slow-delayed rounded-xl border border-slate-200/80 bg-white/95 p-3.5 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/95"
                aria-hidden="true"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{t.marketing.home.floatingCardReliability}</p>
                  <CountUp value={92} suffix="%" className="text-[13px] font-semibold text-teal-600 dark:text-teal-400" />
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-blue-500 to-teal-500" />
                </div>
              </div>
            </ParallaxLayer>
          </Reveal>
        </div>
      </ParallaxProvider>
    </section>
  );
}
