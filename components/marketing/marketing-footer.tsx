"use client";

import Link from "next/link";
import { Lock, ShieldCheck, Stethoscope, UserCheck } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export function MarketingFooter() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  const trustItems = [
    { icon: ShieldCheck, label: t.marketing.footer.trust.isolation },
    { icon: UserCheck, label: t.marketing.footer.trust.rbac },
    { icon: Lock, label: t.marketing.footer.trust.encryption },
  ];

  return (
    <footer className="border-t border-slate-200/70 bg-slate-50 dark:border-white/10 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white">
                <Stethoscope className="size-4.5" aria-hidden="true" />
              </span>
              <span className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">Dentora AI</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">{t.marketing.footer.tagline}</p>
            <div className="mt-6 flex flex-col gap-2.5">
              {trustItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <item.icon className="size-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{t.marketing.footer.product}</span>
            <nav className="mt-4 flex flex-col gap-3 text-sm">
              <Link href="/#features" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                {t.marketing.nav.features}
              </Link>
              <Link href="/pricing" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                {t.marketing.nav.pricing}
              </Link>
              <Link href="/demo" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                {t.marketing.nav.demo}
              </Link>
            </nav>
          </div>

          <div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{t.marketing.footer.account}</span>
            <nav className="mt-4 flex flex-col gap-3 text-sm">
              <Link href="/login" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                {t.marketing.nav.login}
              </Link>
              <Link href="/login" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                {t.marketing.nav.getStarted}
              </Link>
            </nav>
          </div>
        </div>

        <div className="mt-14 flex flex-col-reverse items-center justify-between gap-4 border-t border-slate-200/70 pt-8 sm:flex-row dark:border-white/10">
          <p className="text-xs text-slate-400 dark:text-slate-500">{t.marketing.footer.copyright.replace("{year}", String(year))}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t.marketing.footer.madeFor}</p>
        </div>
      </div>
    </footer>
  );
}
