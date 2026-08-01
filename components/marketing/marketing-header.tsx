"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Menu, MonitorPlay, Sparkles, Tag, X, type LucideIcon } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/marketing/logo";
import { ctaGlowClass } from "@/components/marketing/motion/interactive-classes";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SCROLL_THRESHOLD = 24;

function subscribeToScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

function getIsScrolled(): boolean {
  return window.scrollY > SCROLL_THRESHOLD;
}

function getServerIsScrolled(): boolean {
  return false;
}

/**
 * Transparent-at-top -> solid-on-scroll, via useSyncExternalStore rather
 * than a useEffect+setState scroll listener -- React only re-renders when
 * the boolean snapshot actually flips past the threshold, so this is
 * naturally throttled with no manual rAF bookkeeping. Only paint
 * properties (background/blur/border/shadow) ever change -- never
 * height/padding -- so this never contributes to layout shift.
 */
function useIsScrolled(): boolean {
  return useSyncExternalStore(subscribeToScroll, getIsScrolled, getServerIsScrolled);
}

/** Hover/focus-visible animated underline -- not scroll-spy, since the only in-page anchor is `/#features` alongside two real routes, making true "active section" tracking disproportionate for one link. */
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group relative py-1 transition-colors hover:text-slate-900 dark:hover:text-white">
      {children}
      <span
        className="absolute inset-x-0 -bottom-0.5 h-px origin-center scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
        aria-hidden="true"
      />
    </Link>
  );
}

export function MarketingHeader() {
  const t = useTranslations();
  const [menuOpen, setMenuOpen] = useState(false);
  const isScrolled = useIsScrolled();
  const isSolid = isScrolled || menuOpen;
  const drawerRef = useRef<HTMLDivElement>(null);

  const links: { href: string; label: string; icon: LucideIcon }[] = [
    { href: "/#features", label: t.marketing.nav.features, icon: Sparkles },
    { href: "/pricing", label: t.marketing.nav.pricing, icon: Tag },
    { href: "/demo", label: t.marketing.nav.demo, icon: MonitorPlay },
  ];

  // Locks background scroll while the drawer is open, and marks it `inert`
  // when closed so its off-screen (translate-x-full) content is neither
  // focusable nor exposed to assistive tech -- the panel stays mounted at
  // all times so `transition-transform` can animate both the open and the
  // close, instead of the old conditional-render's hard cut.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    if (drawerRef.current) drawerRef.current.inert = !menuOpen;
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  return (
    // Floating pill rather than a full-bleed bar -- reads as one deliberate
    // object placed over the page rather than a strip glued to the edges.
    // `-mt-20` on the first section (see hero-section.tsx) tucks its
    // background directly behind this header's top gap, so the two read as
    // one continuous surface while at rest.
    <header className="sticky top-0 z-40 w-full px-3 pt-3 sm:px-4">
      <div className="mx-auto max-w-6xl">
        <div
          className={cn(
            "flex h-14 items-center justify-between rounded-2xl border px-3 backdrop-blur-2xl transition-all duration-300 sm:px-4",
            isSolid
              ? "border-slate-200/70 bg-white/85 shadow-lg shadow-slate-900/[0.06] dark:border-white/10 dark:bg-slate-950/80"
              : "border-white/25 bg-white/15 shadow-sm shadow-slate-900/[0.02] dark:border-white/8 dark:bg-white/[0.04]",
          )}
        >
          <Logo size="sm" />

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
            {links.map((link) => (
              <NavLink key={link.href} href={link.href}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher />
            <ThemeToggle />
            <span className="mx-1.5 h-5 w-px bg-slate-200 dark:bg-white/10" aria-hidden="true" />
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              {t.marketing.nav.login}
            </Link>
            <Link
              href="/login"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700",
                ctaGlowClass,
              )}
            >
              {t.marketing.nav.getStarted}
              <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>

          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-lg text-slate-600 md:hidden dark:text-slate-300"
            aria-label={menuOpen ? t.marketing.nav.closeMenu : t.marketing.nav.openMenu}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/*
       * Premium glass drawer -- always mounted (see the `inert` effect
       * above) so `transition-transform`/`transition-opacity` can animate
       * both the open AND the close, unlike the old `menuOpen && (...)`
       * conditional render which just hard-cut in and out. Anchored to the
       * logical `end` edge (right in LTR, left in RTL) so it slides in
       * from the correct side under `dir="rtl"` with no JS branching --
       * `rtl:` mirrors the closed-state translate automatically.
       */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
      />
      <div
        id="mobile-nav-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.marketing.nav.openMenu}
        className={cn(
          "fixed inset-y-0 end-0 z-50 flex w-[85%] max-w-xs flex-col border-s border-slate-200/70 bg-white/95 shadow-2xl backdrop-blur-2xl transition-transform duration-300 ease-out md:hidden dark:border-white/10 dark:bg-slate-950/95",
          menuOpen ? "translate-x-0" : "translate-x-full rtl:-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5 dark:border-white/5">
          <Logo size="sm" />
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={t.marketing.nav.closeMenu}
            onClick={() => setMenuOpen(false)}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 pt-5">
          {links.map((link, index) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{ transitionDelay: menuOpen ? `${80 + index * 60}ms` : "0ms" }}
                className={cn(
                  "group flex min-h-14 items-center gap-3 rounded-2xl px-3.5 text-base font-semibold text-slate-700 transition-all duration-300 ease-out motion-reduce:transition-none hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/5 dark:hover:text-white",
                  menuOpen ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0 rtl:-translate-x-3",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-teal-50 text-blue-600 transition-colors group-hover:from-blue-100 group-hover:to-teal-100 dark:from-blue-400/10 dark:to-teal-400/10 dark:text-blue-400">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                {link.label}
                <ChevronRight
                  className="ms-auto size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 dark:text-slate-600 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 flex-col gap-4 border-t border-slate-100 p-5 dark:border-white/5">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-1.5 dark:border-white/5 dark:bg-white/[0.03]">
            <LanguageSwitcher variant="labelled" />
            <ThemeToggle variant="labelled" />
          </div>
          <div className="flex flex-col gap-2.5">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-4 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
            >
              {t.marketing.nav.login}
            </Link>
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-base font-semibold text-white",
                ctaGlowClass,
              )}
            >
              {t.marketing.nav.getStarted}
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
