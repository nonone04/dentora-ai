"use client";

import Link from "next/link";
import { Lock, ShieldCheck, UserCheck } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/marketing/logo";
import { useTranslations } from "@/lib/i18n";
import type { MarketingNavState } from "@/lib/supabase/post-auth-destination";

const FOOTER_LINK_CLASS = "text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white";

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
      <nav className="mt-4 flex flex-col gap-3 text-sm">{children}</nav>
    </div>
  );
}

export function MarketingFooter({ navState }: { navState: MarketingNavState }) {
  const t = useTranslations();
  const dashboardHref = navState.authenticated ? navState.dashboardHref : null;
  const year = new Date().getFullYear();
  const links = t.marketing.footer.links;

  const trustItems = [
    { icon: ShieldCheck, label: t.marketing.footer.trust.isolation },
    { icon: UserCheck, label: t.marketing.footer.trust.rbac },
    { icon: Lock, label: t.marketing.footer.trust.encryption },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-slate-200/70 bg-white dark:border-white/10 dark:bg-slate-950">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10"
        aria-hidden="true"
      />
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr] lg:gap-8">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Logo />
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

          <FooterColumn title={t.marketing.footer.company}>
            <Link href="/about" className={FOOTER_LINK_CLASS}>
              {links.about}
            </Link>
            <Link href="/pricing" className={FOOTER_LINK_CLASS}>
              {t.marketing.nav.pricing}
            </Link>
            <Link href="/contact" className={FOOTER_LINK_CLASS}>
              {t.marketing.nav.contact}
            </Link>
            <Link href="/demo" className={FOOTER_LINK_CLASS}>
              {t.marketing.nav.demo}
            </Link>
          </FooterColumn>

          <FooterColumn title={t.marketing.footer.resources}>
            <Link href="/help-center" className={FOOTER_LINK_CLASS}>
              {links.helpCenter}
            </Link>
            <Link href="/documentation" className={FOOTER_LINK_CLASS}>
              {links.documentation}
            </Link>
            <Link href="/api-docs" className={FOOTER_LINK_CLASS}>
              {links.api}
            </Link>
          </FooterColumn>

          <FooterColumn title={t.marketing.footer.legal}>
            <Link href="/privacy-policy" className={FOOTER_LINK_CLASS}>
              {links.privacyPolicy}
            </Link>
            <Link href="/terms" className={FOOTER_LINK_CLASS}>
              {links.termsOfService}
            </Link>
            <Link href="/refund-policy" className={FOOTER_LINK_CLASS}>
              {links.refundPolicy}
            </Link>
            <Link href="/cookies" className={FOOTER_LINK_CLASS}>
              {links.cookiePolicy}
            </Link>
            <Link href="/kyc" className={FOOTER_LINK_CLASS}>
              {links.kycVerification}
            </Link>
          </FooterColumn>

          <FooterColumn title={t.marketing.footer.account}>
            {navState.authenticated ? (
              <>
                <Link href="/account/security" className={FOOTER_LINK_CLASS}>
                  {t.marketing.nav.account}
                </Link>
                <form action={signOut}>
                  <button type="submit" className={`text-start ${FOOTER_LINK_CLASS}`}>
                    {t.marketing.nav.signOut}
                  </button>
                </form>
                <Link href={dashboardHref ?? "/pricing"} className={FOOTER_LINK_CLASS}>
                  {dashboardHref ? t.marketing.nav.goToDashboard : t.marketing.nav.choosePlan}
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className={FOOTER_LINK_CLASS}>
                  {t.marketing.nav.login}
                </Link>
                <Link href="/pricing" className={FOOTER_LINK_CLASS}>
                  {t.marketing.nav.getStarted}
                </Link>
              </>
            )}
          </FooterColumn>
        </div>

        <div className="mt-14 flex flex-col-reverse items-center justify-between gap-4 border-t border-slate-200/70 pt-8 sm:flex-row dark:border-white/10">
          <p className="text-xs text-slate-400 dark:text-slate-500">{t.marketing.footer.copyright.replace("{year}", String(year))}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t.marketing.footer.madeFor}</p>
        </div>
      </div>
    </footer>
  );
}
