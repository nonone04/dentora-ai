"use client";

import { CalendarCheck2, MessagesSquare, ShieldCheck, TrendingUp, UserRound, UsersRound } from "lucide-react";
import { FeatureShowcase, type FloatingBadgeConfig } from "@/components/marketing/sections/feature-showcase-section";
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
  }[] = [
    {
      key: "ai",
      eyebrow: s.ai.eyebrow,
      title: s.ai.title,
      description: s.ai.description,
      bullets: s.ai.bullets,
      screenshot: "/marketing/screenshots/ai-receptionist.jpg",
      alt: s.ai.alt,
      address: "dentora.ai/c/your-clinic",
      badge: { icon: MessagesSquare, value: s.ai.badgeValue, label: s.ai.badgeLabel, position: "top" },
    },
    {
      key: "calendar",
      eyebrow: s.calendar.eyebrow,
      title: s.calendar.title,
      description: s.calendar.description,
      bullets: s.calendar.bullets,
      screenshot: "/marketing/screenshots/calendar.jpg",
      alt: s.calendar.alt,
      address: "app.dentora.ai/calendar",
      badge: { icon: CalendarCheck2, value: s.calendar.badgeValue, label: s.calendar.badgeLabel, position: "top" },
    },
    {
      key: "patient360",
      eyebrow: s.patient360.eyebrow,
      title: s.patient360.title,
      description: s.patient360.description,
      bullets: s.patient360.bullets,
      screenshot: "/marketing/screenshots/patient-detail.jpg",
      alt: s.patient360.alt,
      address: "app.dentora.ai/patients",
      badge: { icon: UserRound, value: s.patient360.badgeValue, label: s.patient360.badgeLabel, position: "bottom" },
    },
    {
      key: "analytics",
      eyebrow: s.analytics.eyebrow,
      title: s.analytics.title,
      description: s.analytics.description,
      bullets: s.analytics.bullets,
      screenshot: "/marketing/screenshots/dashboard.jpg",
      alt: s.analytics.alt,
      address: "app.dentora.ai",
      badge: { icon: TrendingUp, value: s.analytics.badgeValue, label: s.analytics.badgeLabel, position: "bottom" },
    },
    {
      key: "staff",
      eyebrow: s.staff.eyebrow,
      title: s.staff.title,
      description: s.staff.description,
      bullets: s.staff.bullets,
      screenshot: "/marketing/screenshots/staff.jpg",
      alt: s.staff.alt,
      address: "app.dentora.ai/staff",
      badge: { icon: UsersRound, value: s.staff.badgeValue, label: s.staff.badgeLabel, position: "top" },
    },
    {
      key: "security",
      eyebrow: s.security.eyebrow,
      title: s.security.title,
      description: s.security.description,
      bullets: s.security.bullets,
      screenshot: "/marketing/screenshots/security-permissions.jpg",
      alt: s.security.alt,
      address: "app.dentora.ai/staff",
      badge: { icon: ShieldCheck, value: s.security.badgeValue, label: s.security.badgeLabel, position: "bottom" },
    },
  ];

  return (
    <section id="features" className="defer-offscreen relative overflow-hidden bg-white py-24 dark:bg-slate-950">
      <SectionBackground intensity="subtle" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto mb-20 max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">{s.title}</h2>
          <p className="mt-4 text-balance text-lg text-slate-600 dark:text-slate-300">{s.subtitle}</p>
        </Reveal>

        <div className="flex flex-col gap-28">
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
            />
          ))}
        </div>
      </div>
    </section>
  );
}
