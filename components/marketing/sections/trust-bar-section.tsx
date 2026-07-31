"use client";

import { FileClock, Lock, ShieldCheck, UserCog } from "lucide-react";
import { Reveal } from "@/components/marketing/motion/reveal";
import { useTranslations } from "@/lib/i18n";

const ICONS = [ShieldCheck, UserCog, FileClock, Lock] as const;

export function TrustBarSection() {
  const t = useTranslations();
  const items = t.marketing.home.trustBar.items;

  return (
    <section className="border-y border-slate-200/70 bg-slate-50 dark:border-white/10 dark:bg-slate-900/40">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-10 lg:px-8">
        <Reveal>
          <p className="text-center text-xs font-medium tracking-wide text-slate-400 uppercase dark:text-slate-500">
            {t.marketing.home.trustBar.label}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 md:mt-6 md:grid-cols-4 md:gap-6">
            {items.map((item, index) => {
              const Icon = ICONS[index % ICONS.length];
              return (
                <div key={item} className="flex flex-col items-center gap-2 text-center md:flex-row md:justify-center md:text-start">
                  <Icon className="size-4.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{item}</span>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
