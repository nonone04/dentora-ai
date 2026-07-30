"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BadgeCheck,
  Ban,
  BarChart3,
  BellRing,
  Bot,
  CalendarCheck2,
  Check,
  CheckCheck,
  CreditCard,
  FileCheck2,
  FileClock,
  FileText,
  GraduationCap,
  Handshake,
  Languages,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Minus,
  Palette,
  Plug,
  Puzzle,
  Repeat2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ctaGlowClass, ctaHoverClass, cardHoverClass } from "@/components/marketing/motion/interactive-classes";
import { FinalCtaSection } from "@/components/marketing/sections/final-cta-section";
import { PlanCheckoutButton } from "@/components/marketing/plan-checkout-button";
import { Reveal } from "@/components/marketing/motion/reveal";
import { SectionBackground } from "@/components/marketing/motion/section-background";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CheckoutPlan } from "@/lib/stripe/checkout";

type BillingPeriod = "monthly" | "yearly";

// Plans render in a fixed order (Starter, Professional, Enterprise) from the
// i18n dictionary; only the first two map to a real Stripe price -- Enterprise
// stays a plain link since it's sales-assisted, not self-serve checkout.
const CHECKOUT_PLANS: (CheckoutPlan | undefined)[] = ["standard", "professional", undefined];

const FEATURE_ICONS: LucideIcon[][] = [
  [MessagesSquare, CalendarCheck2, Users, UserCheck, MapPin, FileText, BarChart3, Mail, Lock, BadgeCheck],
  [Users, MessageCircle, BellRing, Repeat2, TrendingUp, FileClock, Palette, Zap, Workflow, Languages],
  [MapPin, UserCheck, Bot, Plug, Puzzle, Palette, ShieldCheck, FileCheck2, Handshake, GraduationCap],
];

const TRUST_ROW_ICONS: LucideIcon[] = [Ban, RotateCcw, CreditCard, BadgeCheck, ShieldCheck];

const COMPARISON_ROW_ICONS: LucideIcon[] = [
  Bot,
  CalendarCheck2,
  MessageCircle,
  Repeat2,
  BarChart3,
  Users,
  MapPin,
  Zap,
  Plug,
  UserCheck,
  Palette,
  Puzzle,
  ShieldCheck,
  FileCheck2,
];

function ComparisonCell({ value }: { value: string }) {
  if (value === "true") {
    return (
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-teal-50 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
        <Check className="size-3.5" aria-hidden="true" />
      </span>
    );
  }
  if (value === "false") {
    return <Minus className="size-4 text-slate-300 dark:text-slate-600" aria-hidden="true" />;
  }
  return <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{value}</span>;
}

export function PricingContent() {
  const t = useTranslations();
  const plans = t.marketing.pricing.plans;
  const rows = t.marketing.pricing.comparisonTable.rows;
  const faqItems = t.marketing.pricing.faq.items;
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden bg-white dark:bg-slate-950">
        <SectionBackground intensity="subtle" />
        <div className="relative mx-auto max-w-3xl px-4 pt-20 pb-4 text-center sm:px-6 sm:pt-28 lg:px-8">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {t.marketing.pricing.eyebrow}
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              {t.marketing.pricing.title}
            </h1>
            <p className="mt-4 text-balance text-lg text-slate-600 dark:text-slate-300">{t.marketing.pricing.subtitle}</p>
          </Reveal>

          <Reveal delay={80} className="mt-8 flex justify-center">
            <div
              role="group"
              aria-label={`${t.marketing.pricing.billingToggle.monthly} / ${t.marketing.pricing.billingToggle.yearly}`}
              className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-100 p-1 dark:border-white/10 dark:bg-white/5"
            >
              {(["monthly", "yearly"] as const).map((period) => {
                const isActive = billing === period;
                const label =
                  period === "monthly" ? t.marketing.pricing.billingToggle.monthly : t.marketing.pricing.billingToggle.yearly;
                return (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setBilling(period)}
                    aria-pressed={isActive}
                    className={cn(
                      "relative inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                      isActive ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                    )}
                  >
                    {isActive &&
                      (shouldReduceMotion ? (
                        <span className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm dark:bg-slate-800" aria-hidden="true" />
                      ) : (
                        <motion.span
                          layoutId="billing-toggle-pill"
                          className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm dark:bg-slate-800"
                          transition={{ type: "spring", stiffness: 500, damping: 34 }}
                          aria-hidden="true"
                        />
                      ))}
                    <span className="relative">{label}</span>
                    {period === "yearly" && (
                      <span className="relative rounded-full bg-teal-50 px-1.5 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
                        {t.marketing.pricing.billingToggle.savingsBadge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative bg-white pt-12 pb-16 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-8">
            {plans.map((plan, index) => {
              const isPopular = index === 1;
              const isCustom = !plan.yearlyBilledTotal;
              const showCrossedOut = billing === "yearly" && !isCustom && Boolean(plan.yearlyOriginalPrice);
              const displayedPrice = billing === "yearly" && !isCustom ? plan.yearlyBilledTotal : plan.monthlyPrice;
              const displayedSuffix = isCustom ? "" : billing === "yearly" ? t.marketing.pricing.perYear : t.marketing.pricing.perMonth;
              const showSavings = billing === "yearly" && !isCustom && Boolean(plan.yearlySavings);

              const priceBlock = (
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    {showCrossedOut && (
                      <span className="text-lg font-medium text-slate-400 line-through dark:text-slate-600" aria-hidden="true">
                        {plan.yearlyOriginalPrice}
                      </span>
                    )}
                    <span
                      className={cn(
                        "font-semibold tracking-tight text-slate-900 dark:text-white",
                        isPopular ? "text-5xl" : "text-4xl",
                      )}
                    >
                      {displayedPrice}
                    </span>
                    {!isCustom && displayedSuffix && <span className="text-sm text-slate-400 dark:text-slate-500">{displayedSuffix}</span>}
                  </div>
                  {showSavings && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
                      {t.marketing.pricing.savingsPrefix} {plan.yearlySavings}
                    </p>
                  )}
                </div>
              );

              return (
                <Reveal key={plan.name} delay={index * 100}>
                  <div
                    className={cn(
                      "relative flex h-full flex-col rounded-2xl border bg-white p-8 dark:bg-slate-900",
                      isPopular
                        ? "z-10 border-2 border-blue-600 bg-gradient-to-b from-blue-50/70 via-white to-white shadow-2xl shadow-blue-600/20 transition-shadow duration-300 hover:shadow-[0_25px_70px_-20px_rgba(37,99,235,0.5)] lg:-translate-y-3 lg:scale-[1.03] dark:border-blue-400/50 dark:from-blue-500/10 dark:via-slate-900 dark:to-slate-900"
                        : cn("border-slate-200/80 dark:border-white/10", cardHoverClass),
                    )}
                  >
                    {isPopular && (
                      <div className="absolute -top-4 start-1/2 -translate-x-1/2">
                        <span
                          className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-blue-600 to-teal-500 opacity-70 blur-md motion-safe:animate-pulse"
                          aria-hidden="true"
                        />
                        <span className="relative inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/30">
                          <Sparkles className="size-3.5" aria-hidden="true" />
                          {t.marketing.pricing.popular}
                        </span>
                      </div>
                    )}

                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{plan.name}</p>
                    <p className="mt-2 min-h-10 text-balance text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>

                    <div className="mt-5 min-h-[76px]">
                      {shouldReduceMotion ? (
                        priceBlock
                      ) : (
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={billing}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                          >
                            {priceBlock}
                          </motion.div>
                        </AnimatePresence>
                      )}
                    </div>

                    {plan.includesLabel && (
                      <p className="mt-7 text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
                        {plan.includesLabel}
                      </p>
                    )}

                    <ul className={cn("flex flex-1 flex-col gap-3", plan.includesLabel ? "mt-3" : "mt-7")}>
                      {plan.features.map((feature, featureIndex) => {
                        const Icon = FEATURE_ICONS[index]?.[featureIndex] ?? Check;
                        return (
                          <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                            <Icon
                              className={cn(
                                "mt-0.5 size-4 shrink-0",
                                isPopular ? "text-blue-600 dark:text-blue-400" : "text-teal-600 dark:text-teal-400",
                              )}
                              aria-hidden="true"
                            />
                            {feature}
                          </li>
                        );
                      })}
                    </ul>

                    {plan.benefits.length > 0 && (
                      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-400/20 dark:bg-blue-400/10">
                        <ul className="flex flex-col gap-2">
                          {plan.benefits.map((benefit) => (
                            <li key={benefit} className="flex items-start gap-2 text-sm font-medium text-blue-900 dark:text-blue-200">
                              <CheckCheck className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(() => {
                      const ctaClassName = cn(
                        "mt-8 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold",
                        isPopular
                          ? cn("bg-gradient-to-r from-blue-600 to-teal-500 text-white", ctaGlowClass)
                          : cn(
                              "border border-slate-200 text-slate-700 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10",
                              ctaHoverClass,
                            ),
                      );
                      const checkoutPlan = CHECKOUT_PLANS[index];

                      return checkoutPlan ? (
                        <PlanCheckoutButton plan={checkoutPlan} className={cn(ctaClassName, "w-full")}>
                          {plan.cta}
                        </PlanCheckoutButton>
                      ) : (
                        <Link href="/login" className={ctaClassName}>
                          {plan.cta}
                        </Link>
                      );
                    })()}
                  </div>
                </Reveal>
              );
            })}
          </div>

          <Reveal
            delay={200}
            className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500 dark:text-slate-400"
          >
            {t.marketing.pricing.trustRow.map((item, i) => {
              const Icon = TRUST_ROW_ICONS[i] ?? ShieldCheck;
              return (
                <span key={item} className="inline-flex items-center gap-2">
                  <Icon className="size-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                  {item}
                </span>
              );
            })}
          </Reveal>

          <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">{t.marketing.pricing.disclaimer}</p>
        </div>
      </section>

      <section className="bg-slate-50 py-24 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              {t.marketing.pricing.comparisonTable.title}
            </h2>
          </Reveal>

          <Reveal
            delay={100}
            className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
          >
            <table className="w-full min-w-[640px] border-collapse text-start">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/10">
                  <th className="p-5 text-start text-sm font-medium text-slate-500 dark:text-slate-400">
                    {t.marketing.pricing.comparisonTable.featureColumn}
                  </th>
                  {plans.map((plan, index) => (
                    <th
                      key={plan.name}
                      className={cn(
                        "p-5 text-start text-sm font-semibold text-slate-900 dark:text-white",
                        index === 1 && "bg-blue-50/60 dark:bg-blue-400/5",
                      )}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const RowIcon = COMPARISON_ROW_ICONS[rowIndex] ?? Check;
                  return (
                    <tr
                      key={row.feature}
                      className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/80 dark:border-white/5 dark:hover:bg-white/[0.03]"
                    >
                      <td className="p-5 text-sm text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-2.5">
                          <RowIcon className="size-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                          {row.feature}
                        </span>
                      </td>
                      <td className="p-5">
                        <ComparisonCell value={row.standard} />
                      </td>
                      <td className="bg-blue-50/40 p-5 dark:bg-blue-400/5">
                        <ComparisonCell value={row.professional} />
                      </td>
                      <td className="p-5">
                        <ComparisonCell value={row.enterprise} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-24 dark:bg-slate-950">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-10 flex flex-col items-center gap-3 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-md shadow-blue-600/20">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              {t.marketing.pricing.trust.title}
            </h2>
            <p className="max-w-xl text-balance leading-relaxed text-slate-600 dark:text-slate-300">{t.marketing.pricing.trust.description}</p>
          </Reveal>
        </div>
      </section>

      <section className="bg-slate-50 py-24 dark:bg-slate-900/40">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-12 text-center">
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              {t.marketing.pricing.faq.title}
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <Accordion className="divide-y divide-slate-200 rounded-2xl border border-slate-200/80 bg-white px-6 dark:divide-white/10 dark:border-white/10 dark:bg-slate-900">
              {faqItems.map((item) => (
                <AccordionItem key={item.question} value={item.question} className="border-slate-200 py-1.5 dark:border-white/10">
                  <AccordionTrigger className="py-4 text-base font-medium text-slate-900 dark:text-white">{item.question}</AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      <FinalCtaSection />
    </div>
  );
}
