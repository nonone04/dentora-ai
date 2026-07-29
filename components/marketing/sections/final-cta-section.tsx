"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/marketing/motion/reveal";
import { SectionBackground } from "@/components/marketing/motion/section-background";
import { useTranslations } from "@/lib/i18n";

export function FinalCtaSection() {
  const t = useTranslations();

  return (
    <section className="defer-offscreen relative overflow-hidden bg-gradient-to-br from-blue-600 to-teal-500 py-24">
      <SectionBackground intensity="gradient" />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">{t.marketing.home.finalCtaTitle}</h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="mt-4 text-balance text-lg text-blue-50">{t.marketing.home.finalCtaSubtitle}</p>
        </Reveal>
        <Reveal delay={160}>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-xl"
            >
              {t.marketing.home.ctaPrimary}
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              {t.marketing.home.ctaSecondary}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
