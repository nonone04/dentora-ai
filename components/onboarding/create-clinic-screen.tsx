import Link from "next/link";
import {
  BarChart3,
  Bot,
  CalendarClock,
  HelpCircle,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { UnverifiedEmailBanner } from "@/components/account/unverified-email-banner";
import { AcceptInvitationButton } from "@/components/team/accept-invitation-button";
import { CreateClinicForm } from "@/components/onboarding/create-clinic-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Reveal } from "@/components/marketing/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/server";

const FEATURE_ICONS = [Bot, CalendarClock, Users, BarChart3, MessageCircle, ShieldCheck] as const;

type PendingInvitation = {
  membership_id: string;
  clinic_id: string;
  clinic_name: string;
  role: string;
};

/**
 * Single-page clinic-creation screen -- replaces the old five-step onboarding
 * wizard's step indicator / left timeline / Previous-Next concept entirely.
 * Wrapped in `.auth-scope` (see app/globals.css) for the same reason as
 * components/auth/auth-shell.tsx: a fixed premium-dark surface regardless of
 * the user's light/dark theme choice, with every child component picking up
 * the dark tokens through CSS custom-property inheritance.
 */
export function CreateClinicScreen({
  t,
  pendingInvitations,
  unverifiedEmail,
}: {
  t: Dictionary;
  pendingInvitations: PendingInvitation[];
  unverifiedEmail?: string | null;
}) {
  return (
    <div className="auth-scope relative flex min-h-screen flex-col overflow-hidden bg-[linear-gradient(180deg,#0c111d_0%,#0a0e17_100%)] text-white">
      <div
        className="pointer-events-none absolute left-1/4 top-0 size-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.16)_0%,transparent_65%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-0 top-1/3 size-[30rem] translate-x-1/3 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.14)_0%,transparent_65%)]"
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

      <header className="relative flex items-center justify-between gap-2 p-4 sm:p-6 lg:px-10 lg:py-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-sm">
            <Stethoscope className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">Dentora AI</span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="mailto:support@dentora.ai"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <HelpCircle className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t.onboarding.needHelp}</span>
          </Link>
          <LanguageSwitcher />
          <ThemeToggle />
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-white/60 hover:bg-white/10 hover:text-white"
            >
              {t.header.signOut}
            </Button>
          </form>
        </div>
      </header>

      <div className="relative flex flex-1 flex-col lg:flex-row">
        <aside className="flex flex-col gap-10 border-white/10 px-4 pb-4 sm:px-6 lg:w-[40%] lg:border-e lg:px-10 lg:py-4 xl:w-[36%]">
          <Reveal variant="left">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h1 className="text-balance text-3xl font-semibold tracking-tight text-white xl:text-4xl">
                  {t.onboarding.sidebar.welcomeTitle}
                </h1>
                <p className="max-w-md text-balance text-[15px] leading-relaxed text-blue-50/70">
                  {t.onboarding.sidebar.welcomeSubtitle}
                </p>
              </div>

              <div className="relative flex h-48 items-center justify-center">
                <div
                  className="pointer-events-none absolute size-40 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.28)_0%,transparent_70%)] blur-xl"
                  aria-hidden="true"
                />
                <div className="relative flex size-32 items-center justify-center rounded-[2rem] bg-[linear-gradient(135deg,#2563EB_0%,#4F46E5_100%)] shadow-2xl shadow-blue-950/50 ring-1 ring-white/15">
                  <Stethoscope className="size-14 text-white/90" aria-hidden="true" />
                </div>
                <span
                  className="float-slow absolute start-2 top-2 flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm"
                  aria-hidden="true"
                >
                  <CalendarClock className="size-5 text-blue-200" />
                </span>
                <span
                  className="float-slow-delayed absolute end-2 top-6 flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm"
                  aria-hidden="true"
                >
                  <MessageCircle className="size-5 text-indigo-200" />
                </span>
                <span
                  className="float-slow absolute bottom-1 end-8 flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm"
                  aria-hidden="true"
                >
                  <Sparkles className="size-5 text-blue-200" />
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">{t.onboarding.sidebar.whyTitle}</h2>
              <ul className="flex flex-col gap-4">
                {t.onboarding.sidebar.features.map((feature, index) => {
                  const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
                  return (
                    <li key={feature.title} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-200 ring-1 ring-white/15">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{feature.title}</p>
                        <p className="text-sm leading-relaxed text-blue-50/60">{feature.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={220}>
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-center backdrop-blur-sm">
              <div className="relative flex size-16 items-center justify-center">
                <div
                  className="pointer-events-none absolute size-16 rounded-full bg-[radial-gradient(circle,rgba(52,211,153,0.22)_0%,transparent_70%)] blur-lg"
                  aria-hidden="true"
                />
                <div className="relative flex size-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                  <ShieldCheck className="size-7 text-emerald-300" aria-hidden="true" />
                </div>
              </div>
              <p className="text-sm leading-relaxed text-blue-50/70">{t.onboarding.sidebar.securityDescription}</p>
            </div>
          </Reveal>
        </aside>

        <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 lg:px-12 lg:py-12 xl:px-16">
          <Reveal variant="scale" className="mx-auto flex w-full max-w-2xl flex-col gap-8">
            {(unverifiedEmail || pendingInvitations.length > 0) && (
              <div className="flex flex-col gap-3">
                {unverifiedEmail && <UnverifiedEmailBanner email={unverifiedEmail} />}
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.membership_id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-white">{t.onboarding.invitedTitle}</p>
                      <p className="text-sm text-white/50">
                        {interpolate(t.onboarding.invitedJoinAs, { clinicName: invitation.clinic_name })}{" "}
                        <Badge variant="secondary" className="ms-1 capitalize">
                          {invitation.role}
                        </Badge>
                      </p>
                    </div>
                    <AcceptInvitationButton membershipId={invitation.membership_id} />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t.onboarding.createClinicTitle}</h2>
              <p className="text-[15px] leading-relaxed text-white/50">
                {pendingInvitations.length > 0
                  ? t.onboarding.createClinicDescriptionWithInvitations
                  : t.onboarding.createClinicSubtitle}
              </p>
            </div>

            <CreateClinicForm />

            <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-white">{t.onboarding.infoCard.title}</p>
                <p className="text-sm leading-relaxed text-white/50">{t.onboarding.infoCard.description}</p>
              </div>
            </div>
          </Reveal>
        </main>
      </div>
    </div>
  );
}
