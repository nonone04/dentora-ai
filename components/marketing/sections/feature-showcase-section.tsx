"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Check, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { CountUp, parseCountableValue } from "@/components/marketing/motion/count-up";
import { ctaGlowClass } from "@/components/marketing/motion/interactive-classes";
import { Reveal } from "@/components/marketing/motion/reveal";
import { TiltFrame } from "@/components/marketing/motion/tilt-frame";
import { ProductFrame } from "@/components/marketing/product-frame";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Replaces the old fixed-duration `frame-parallax` CSS bob with a real
 * scroll-linked offset -- the frame drifts a few px as its own section
 * scrolls through the viewport, rather than looping on a timer regardless
 * of scroll position. Disabled under prefers-reduced-motion (range
 * collapses to 0, so `useScroll`/`useTransform` still run but produce no
 * visible movement) for the same reason parallax is gated everywhere else
 * in this sprint.
 */
function ScrollParallaxFrame({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const range = shouldReduceMotion ? [0, 0] : [-16, 16];
  const y = useTransform(scrollYProgress, [0, 1], range);

  return (
    <motion.div ref={ref} style={{ y }}>
      {children}
    </motion.div>
  );
}

export type FloatingBadgeConfig = {
  icon: LucideIcon;
  label: string;
  value: string;
  position: "top" | "bottom";
  delayed?: boolean;
};

function FloatingBadge({ icon: Icon, label, value, position, delayed }: FloatingBadgeConfig) {
  const countable = parseCountableValue(value);

  return (
    <div
      className={cn(
        "absolute z-10 hidden w-52 rounded-xl border border-slate-200/80 bg-white/95 p-3.5 shadow-xl backdrop-blur-sm sm:block dark:border-white/10 dark:bg-slate-900/95",
        delayed ? "float-slow-delayed" : "float-slow",
        position === "top" ? "-top-6 -start-6" : "-bottom-6 -end-6",
      )}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">
            {countable ? <CountUp value={countable.value} suffix={countable.suffix} /> : value}
          </p>
          <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function FeatureShowcase({
  eyebrow,
  title,
  description,
  bullets,
  screenshot,
  screenshotAlt,
  address,
  reverse,
  badges,
  secondaryCta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  screenshot: string;
  screenshotAlt: string;
  address: string;
  reverse?: boolean;
  badges?: FloatingBadgeConfig[];
  secondaryCta: string;
}) {
  const t = useTranslations();

  return (
    <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
      <Reveal variant={reverse ? "right" : "left"} className={cn(reverse && "lg:order-2")}>
        <span className="text-sm font-semibold text-teal-600 dark:text-teal-400">{eyebrow}</span>
        <h3 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-4 text-balance leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>
        <ul className="mt-6 flex flex-col gap-3">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
              <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
                <Check className="size-3" aria-hidden="true" />
              </span>
              {bullet}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <Link
            href="/login"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700",
              ctaGlowClass,
            )}
          >
            {t.marketing.home.ctaPrimary}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
          <Link
            href="/demo"
            className="text-sm font-semibold text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900 dark:text-slate-300 dark:decoration-slate-600 dark:hover:text-white"
          >
            {secondaryCta}
          </Link>
        </div>
      </Reveal>

      <Reveal delay={120} variant="scale" className={cn("relative", reverse && "lg:order-1")}>
        <ScrollParallaxFrame>
          <TiltFrame>
            <ProductFrame src={screenshot} alt={screenshotAlt} address={address} premium />
          </TiltFrame>
        </ScrollParallaxFrame>
        {badges?.map((badge) => <FloatingBadge key={badge.label} {...badge} />)}
      </Reveal>
    </div>
  );
}

export type MobileShowcaseItem = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  screenshot: string;
  alt: string;
  address: string;
};

/**
 * Mobile-only vertical stack -- one full-width premium card per feature,
 * flowing top to bottom (replaces the old horizontal snap-scroll carousel,
 * which read as a bad mobile-web pattern and hid most features off-screen).
 * Each card leads with the screenshot as its hero element, shown at full
 * width via `ProductFrame` (uncropped, real aspect ratio, never squeezed).
 */
export function MobileFeatureStack({ items }: { items: MobileShowcaseItem[] }) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-8">
      {items.map((item, index) => (
        <Reveal key={item.key} delay={index === 0 ? 0 : 60}>
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.25)] dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)]">
            <div className="p-6 pb-5">
              <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
                {item.eyebrow}
              </span>
              <h3 className="mt-4 text-balance text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{item.title}</h3>
            </div>

            <div className="px-5">
              <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-slate-100 to-slate-50 p-3 dark:from-white/[0.05] dark:to-white/[0.02]">
                <ProductFrame src={item.screenshot} alt={item.alt} address={item.address} />
              </div>
            </div>

            <div className="p-6 pt-5">
              <p className="text-balance leading-relaxed text-slate-600 dark:text-slate-300">{item.description}</p>

              <ul className="mt-5 flex flex-col gap-3">
                {item.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                    {bullet}
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className={cn(
                  "mt-6 flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-5 text-[15px] font-semibold text-white",
                  ctaGlowClass,
                )}
              >
                {t.marketing.home.ctaPrimary}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
