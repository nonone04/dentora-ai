"use client";

import { CalendarCheck2, MessagesSquare, ShieldCheck, TrendingUp, UserRound, UsersRound } from "lucide-react";
import {
  FeatureShowcase,
  MobileFeatureStack,
  type FloatingBadgeConfig,
} from "@/components/marketing/sections/feature-showcase-section";
import { Reveal } from "@/components/marketing/motion/reveal";
import { SectionBackground } from "@/components/marketing/motion/section-background";
import { useTranslations } from "@/lib/i18n";

export function ShowcaseSections() {
  const t = useTranslations();
  const s = t.marketing.home.showcase;

  const features: {
    key: string;
    eyebrow: string;
    title: string;
    description: string;
    bullets: string[];
    screenshot: string;
    alt: string;
    address: string;
    badge: FloatingBadgeConfig;
    secondaryCta: string;
  }[] = [
    {
      key: "ai",
      eyebrow: s.ai.eyebrow,
      title: s.ai.title,
      description: s.ai.description,
      bullets: s.ai.bullets,
      screenshot: "/screenshots/ai-receptionist.webp",
      alt: s.ai.alt,
      address: "app.dentora.ai/ai-inbox",
      badge: { icon: MessagesSquare, value: s.ai.badgeValue, label: s.ai.badgeLabel, position: "top" },
      secondaryCta: s.ai.secondaryCta,
    },
    {
      key: "calendar",
      eyebrow: s.calendar.eyebrow,
      title: s.calendar.title,
      description: s.calendar.description,
      bullets: s.calendar.bullets,
      screenshot: "/screenshots/calendar.webp",
      alt: s.calendar.alt,
      address: "app.dentora.ai/calendar",
      badge: { icon: CalendarCheck2, value: s.calendar.badgeValue, label: s.calendar.badgeLabel, position: "top" },
      secondaryCta: s.calendar.secondaryCta,
    },
    {
      key: "patient360",
      eyebrow: s.patient360.eyebrow,
      title: s.patient360.title,
      description: s.patient360.description,
      bullets: s.patient360.bullets,
      screenshot: "/screenshots/patient-detail.webp",
      alt: s.patient360.alt,
      address: "app.dentora.ai/patients",
      badge: { icon: UserRound, value: s.patient360.badgeValue, label: s.patient360.badgeLabel, position: "bottom" },
      secondaryCta: s.patient360.secondaryCta,
    },
    {
      key: "analytics",
      eyebrow: s.analytics.eyebrow,
      title: s.analytics.title,
      description: s.analytics.description,
      bullets: s.analytics.bullets,
      screenshot: "/screenshots/analytics.webp",
      alt: s.analytics.alt,
      address: "app.dentora.ai",
      badge: { icon: TrendingUp, value: s.analytics.badgeValue, label: s.analytics.badgeLabel, position: "bottom" },
      secondaryCta: s.analytics.secondaryCta,
    },
    {
      key: "staff",
      eyebrow: s.staff.eyebrow,
      title: s.staff.title,
      description: s.staff.description,
      bullets: s.staff.bullets,
      screenshot: "/screenshots/staff.webp",
      alt: s.staff.alt,
      address: "app.dentora.ai/staff",
      badge: { icon: UsersRound, value: s.staff.badgeValue, label: s.staff.badgeLabel, position: "top" },
      secondaryCta: s.staff.secondaryCta,
    },
    {
      key: "security",
      eyebrow: s.security.eyebrow,
      title: s.security.title,
      description: s.security.description,
      bullets: s.security.bullets,
      screenshot: "/screenshots/settings.webp",
      alt: s.security.alt,
      address: "app.dentora.ai/settings",
      badge: { icon: ShieldCheck, value: s.security.badgeValue, label: s.security.badgeLabel, position: "bottom" },
      secondaryCta: s.security.secondaryCta,
    },
  ];

  return (
    <section id="features" className="defer-offscreen relative overflow-hidden bg-white py-20 dark:bg-slate-950 md:py-24">
      <SectionBackground intensity="subtle" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center md:mb-20">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-slate-900 md:text-4xl md:font-semibold dark:text-white">
            {s.title}
          </h2>
          <p className="mt-4 text-balance text-base text-slate-600 md:mt-4 md:text-lg dark:text-slate-300">
            {s.subtitle}
          </p>
        </Reveal>

        {/* Desktop: alternating text/screenshot stack, unchanged. */}
        <div className="hidden md:flex md:flex-col md:gap-28">
          {features.map((feature, index) => (
            <FeatureShowcase
              key={feature.key}
              eyebrow={feature.eyebrow}
              title={feature.title}
              description={feature.description}
              bullets={feature.bullets}
              screenshot={feature.screenshot}
              screenshotAlt={feature.alt}
              address={feature.address}
              reverse={index % 2 === 1}
              badges={[feature.badge]}
              secondaryCta={feature.secondaryCta}
            />
          ))}
        </div>

        {/* Mobile: vertical stack, one full-width premium card per feature. */}
        <div className="md:hidden">
          <MobileFeatureStack
            items={features.map((feature) => ({
              key: feature.key,
              eyebrow: feature.eyebrow,
              title: feature.title,
              description: feature.description,
              bullets: feature.bullets,
              screenshot: feature.screenshot,
              alt: feature.alt,
              address: feature.address,
            }))}
          />
        </div>
      </div>
    </section>
  );
}
