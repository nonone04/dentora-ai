import { Activity, Lock, ShieldCheck, Sparkles, Stethoscope, Zap } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { ParticleNetwork } from "@/components/auth/particle-network";
import { Logo } from "@/components/marketing/logo";
import { Reveal } from "@/components/marketing/motion/reveal";
import { SectionBackground } from "@/components/marketing/motion/section-background";
import type { Dictionary } from "@/lib/i18n";

const BENEFIT_ICONS = [Sparkles, ShieldCheck, Zap] as const;
const BADGE_ICONS = [ShieldCheck, Lock, Activity] as const;

/**
 * Split-screen shell shared by every auth-adjacent page (login,
 * forgot/reset password, verify-email, confirm-error) -- a branded deep-navy
 * left panel (hidden below `lg`) carries the marketing site's trust/value
 * messaging, while the right panel hosts a floating glassmorphism card with
 * the actual form. The right side is wrapped in `.auth-scope` (see
 * app/globals.css) so it reads as a fixed premium-dark surface regardless of
 * the user's light/dark theme choice -- every child component (Button,
 * Input, Checkbox, ...) still just uses its normal token classes and picks
 * this up through CSS custom-property inheritance. Takes the full
 * dictionary rather than fetching its own, since callers already have it
 * (some via the client `useTranslations`, some via the server
 * `getServerDictionary`) and this component has no server-only needs of its
 * own, so it stays usable from either.
 */
export function AuthShell({ t, children }: { t: Dictionary; children: React.ReactNode }) {
  const testimonial = t.marketing.home.testimonials.caseStudy;
  const initials = testimonial.name
    .split(" ")
    .map((part) => part[0])
    .join("");

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className="relative hidden overflow-hidden bg-[linear-gradient(160deg,#0b1220_0%,#0f1b3d_45%,#152657_75%,#1b2f6e_100%)] lg:flex lg:w-[50%] lg:flex-col">
        <SectionBackground intensity="auth" />
        <ParticleNetwork className="pointer-events-none absolute inset-0 h-full w-full opacity-60" />

        <div
          className="pointer-events-none absolute end-[-10%] top-1/2 size-[26rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.28)_0%,transparent_70%)] blur-2xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute end-[6%] top-1/2 flex size-40 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 opacity-70 backdrop-blur-sm"
          aria-hidden="true"
        >
          <Stethoscope className="size-16 text-white/25" aria-hidden="true" />
        </div>

        <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
          <Reveal variant="left">
            <Logo size="lg" variant="glass" />
          </Reveal>

          <div className="flex flex-col gap-10 py-12">
            <Reveal delay={100}>
              <div className="flex flex-col gap-4">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  {t.auth.panel.eyebrow}
                </span>
                <h1 className="text-balance text-3xl font-semibold tracking-tight text-white xl:text-4xl">
                  {t.auth.panel.headlineStart}
                  {t.auth.panel.headlineStart ? " " : ""}
                  <span className="bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
                    {t.auth.panel.headlineHighlight}
                  </span>
                  {t.auth.panel.headlineEnd}
                </h1>
                <p className="max-w-md text-balance text-[15px] leading-relaxed text-blue-50/80">{t.auth.panel.subheadline}</p>
              </div>
            </Reveal>

            <Reveal delay={220}>
              <ul className="flex flex-col gap-4">
                {t.auth.panel.benefits.map((benefit, index) => {
                  const Icon = BENEFIT_ICONS[index % BENEFIT_ICONS.length];
                  return (
                    <li key={benefit.title} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-200 ring-1 ring-white/15">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{benefit.title}</p>
                        <p className="text-sm leading-relaxed text-blue-50/70">{benefit.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Reveal>

            <Reveal delay={340}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
                <p className="text-sm leading-relaxed text-white/90">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white ring-1 ring-white/15">
                    {initials}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                    <p className="text-xs text-blue-50/60">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={420}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-50/70">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full rounded-full bg-emerald-300 opacity-75 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-300" />
                </span>
                {t.auth.panel.liveBadge}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-xs font-medium text-blue-50/60">
                {t.auth.panel.badges.map((badge, index) => {
                  const Icon = BADGE_ICONS[index % BADGE_ICONS.length];
                  return (
                    <span key={badge} className="inline-flex items-center gap-1.5">
                      <Icon className="size-3.5" aria-hidden="true" />
                      {badge}
                    </span>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <div className="auth-scope relative flex flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#0c111d_0%,#0a0e17_100%)]">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.16)_0%,transparent_65%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'240\' height=\'240\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'2\' stitchTiles=\'stitch\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' /%3E%3C/svg%3E")',
            backgroundSize: "220px 220px",
          }}
        />

        <div className="relative flex items-center justify-between p-4 sm:p-6 lg:justify-end lg:px-10 lg:py-8">
          <Logo size="sm" variant="glass" className="lg:hidden" />
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-4 pb-16 sm:px-6">
          <Reveal variant="scale" className="w-full max-w-[560px]">
            <div className="rounded-[28px] border border-white/10 bg-card/70 p-8 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10">
              {children}
            </div>
          </Reveal>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground lg:hidden">
            {t.auth.panel.badges.map((badge, index) => {
              const Icon = BADGE_ICONS[index % BADGE_ICONS.length];
              return (
                <span key={badge} className="inline-flex items-center gap-1.5">
                  <Icon className="size-3.5 text-blue-400" aria-hidden="true" />
                  {badge}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
