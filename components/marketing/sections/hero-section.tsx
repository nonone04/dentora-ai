"use client";

import Link from "next/link";
import { ArrowRight, Bot, CalendarCheck2, FileClock, Lock, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { CountUp } from "@/components/marketing/motion/count-up";
import { ctaGlowClass, ctaHoverClass, glassPanelClass } from "@/components/marketing/motion/interactive-classes";
import { ParallaxLayer, ParallaxProvider } from "@/components/marketing/motion/mouse-parallax";
import { Reveal } from "@/components/marketing/motion/reveal";
import { SectionBackground } from "@/components/marketing/motion/section-background";
import { TiltFrame } from "@/components/marketing/motion/tilt-frame";
import { ProductFrame } from "@/components/marketing/product-frame";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function HeroSection({ dashboardHref = null }: { dashboardHref?: string | null }) {
  const t = useTranslations();

  return (
    <section className="relative -mt-[4.25rem] overflow-hidden bg-white dark:bg-slate-950">
      <ParallaxProvider className="relative">
        <SectionBackground intensity="hero" />

        <div className="relative mx-auto max-w-7xl px-4 pt-24 pb-6 sm:px-6 md:pt-40 md:pb-8 lg:pt-48 lg:px-8">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
                <Sparkles className="size-3.5" aria-hidden="true" />
                {t.marketing.home.eyebrow}
              </span>
            </Reveal>

            {/* Rendered at full opacity immediately -- no mount/scroll reveal -- since this is the
                first thing anyone reads and it must never be the thing motion makes them wait for. */}
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-slate-900 md:mt-7 md:text-6xl lg:text-7xl dark:text-white">
              {t.marketing.home.headlineStart}{" "}
              <span className="bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent">
                {t.marketing.home.headlineHighlight}
              </span>
            </h1>

            <Reveal delay={550}>
              <p className="mt-4 max-w-2xl text-balance text-base leading-relaxed text-slate-600 md:mt-7 md:text-lg dark:text-slate-300">
                {t.marketing.home.subheadline}
              </p>
            </Reveal>

            <Reveal delay={700}>
              <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row md:mt-9 md:w-auto">
                <Link
                  href={dashboardHref ?? "/pricing"}
                  className={cn(
                    "inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 md:min-h-0 md:w-auto",
                    ctaGlowClass,
                  )}
                >
                  {dashboardHref ? t.marketing.nav.goToDashboard : t.marketing.home.ctaPrimary}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
                <Link
                  href="/demo"
                  className={cn(
                    "inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 md:min-h-0 md:w-auto dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10",
                    ctaHoverClass,
                  )}
                >
                  {t.marketing.home.ctaSecondary}
                </Link>
              </div>
            </Reveal>

            <Reveal delay={850}>
              <div className="no-scrollbar -mx-4 mt-5 flex snap-x snap-mandatory items-center gap-2 overflow-x-auto px-4 md:mx-0 md:mt-7 md:flex-wrap md:justify-center md:overflow-visible md:px-0">
                {[
                  { icon: Lock, label: t.marketing.home.trustChips.encryption },
                  { icon: UserCheck, label: t.marketing.home.trustChips.rbac },
                  { icon: FileClock, label: t.marketing.home.trustChips.auditLogs },
                  { icon: ShieldCheck, label: t.marketing.home.trustChips.gdpr },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className={cn(
                      "inline-flex shrink-0 snap-center items-center gap-1.5 rounded-full border border-slate-200/60 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-white/10 dark:text-slate-300",
                      glassPanelClass,
                    )}
                  >
                    <Icon className="size-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs font-medium text-slate-400 dark:text-slate-500">{t.marketing.home.noCreditCard}</p>
            </Reveal>
          </div>

          <Reveal delay={950} className="relative -mx-4 mt-8 md:mx-auto md:mt-16 md:max-w-5xl">
            <TiltFrame>
              <ProductFrame src="/screenshots/dashboard-overview.webp" alt={t.marketing.home.heroScreenshotAlt} priority premium className="mx-auto" />
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

            {/* Purely decorative "AI is working" pulse -- no copy of its own (aria-hidden), since it's
                an ambient life signal rather than a fact that needs to survive translation. */}
            <ParallaxLayer strength={10} className="absolute -end-3 top-1/2 hidden -translate-y-1/2 sm:block">
              <div
                className="float-slow flex size-14 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/95"
                aria-hidden="true"
              >
                <span className="relative flex items-center justify-center">
                  <Bot className="size-6 text-blue-600 dark:text-blue-400" />
                  <span className="absolute -end-1 -top-1 flex size-2.5">
                    <span className="absolute inline-flex size-full rounded-full bg-teal-400 opacity-75 motion-safe:animate-ping" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-teal-500" />
                  </span>
                </span>
              </div>
            </ParallaxLayer>
          </Reveal>
        </div>
      </ParallaxProvider>
    </section>
  );
}
