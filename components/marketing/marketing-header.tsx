"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Menu, Stethoscope, X } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
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
 * properties (background/blur/border) ever change -- never
 * height/padding -- so this never contributes to layout shift.
 */
function useIsScrolled(): boolean {
  return useSyncExternalStore(subscribeToScroll, getIsScrolled, getServerIsScrolled);
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-md shadow-blue-600/20">
        <Stethoscope className="size-4.5" aria-hidden="true" />
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">Dentora AI</span>
    </Link>
  );
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

  const links = [
    { href: "/#features", label: t.marketing.nav.features },
    { href: "/pricing", label: t.marketing.nav.pricing },
    { href: "/demo", label: t.marketing.nav.demo },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        isScrolled || menuOpen
          ? "border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/80"
          : "border-transparent bg-transparent backdrop-blur-none",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
          {links.map((link) => (
            <NavLink key={link.href} href={link.href}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher />
          <ThemeToggle />
          <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-white/10" aria-hidden="true" />
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            {t.marketing.nav.login}
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/30 transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30"
          >
            {t.marketing.nav.getStarted}
          </Link>
        </div>

        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-lg text-slate-600 md:hidden dark:text-slate-300"
          aria-label={menuOpen ? t.marketing.nav.closeMenu : t.marketing.nav.openMenu}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-200/70 bg-white px-4 py-4 md:hidden dark:border-white/10 dark:bg-slate-950">
          <nav className="flex flex-col gap-1 text-sm font-medium">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-2 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center gap-2 px-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/login"
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
            >
              {t.marketing.nav.login}
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-blue-600/30"
            >
              {t.marketing.nav.getStarted}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
