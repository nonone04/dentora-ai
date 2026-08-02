"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  HeartHandshake,
  Loader2,
  Mail,
  MapPin,
  MonitorPlay,
  Send,
  Sparkles,
} from "lucide-react";
import { submitContactRequest, type ContactFormState } from "@/app/actions/contact";
import { FacebookIcon, InstagramIcon, LinkedInIcon, XIcon, YouTubeIcon } from "@/components/marketing/social-icons";
import { Reveal } from "@/components/marketing/motion/reveal";
import { SectionBackground } from "@/components/marketing/motion/section-background";
import { ctaGlowClass } from "@/components/marketing/motion/interactive-classes";
import { useTranslations } from "@/lib/i18n";
import { CONTACT_INQUIRY_TYPES, type ContactInquiryType } from "@/lib/marketing/contact";
import { cn } from "@/lib/utils";

const initialState: ContactFormState = undefined;

const FIELD_CLASS =
  "h-12 w-full rounded-xl border border-slate-200/80 bg-white px-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500";

// Placeholders -- no confirmed social handles exist yet. Swap these four
// values for the real profile URLs once Dentora's accounts are live; every
// other part of the section (icons, layout, hover states) is ready as-is.
const SOCIAL_LINKS: { key: string; href: string; Icon: typeof LinkedInIcon }[] = [
  { key: "linkedin", href: "#", Icon: LinkedInIcon },
  { key: "instagram", href: "#", Icon: InstagramIcon },
  { key: "facebook", href: "#", Icon: FacebookIcon },
  { key: "x", href: "#", Icon: XIcon },
  { key: "youtube", href: "#", Icon: YouTubeIcon },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
      {children}
    </div>
  );
}

export function ContactContent({ defaultInquiryType = "general" }: { defaultInquiryType?: ContactInquiryType }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(submitContactRequest, initialState);
  const [inquiryType, setInquiryType] = useState<ContactInquiryType>(defaultInquiryType);
  const copy = t.marketing.contact;
  const isCustomPlan = inquiryType === "enterprise";

  const infoCards = useMemo(
    () => [
      { ...copy.info.general, Icon: Mail },
      { ...copy.info.sales, Icon: HeartHandshake },
      { ...copy.info.support, Icon: Sparkles },
    ],
    [copy.info],
  );

  return (
    <>
      <section className="relative overflow-hidden bg-white dark:bg-slate-950">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute start-1/2 top-[-10%] size-[500px] -translate-x-1/2 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-500/10" />
        </div>

        <div className="relative mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <Reveal className="flex flex-col items-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {copy.eyebrow}
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              {copy.title}
            </h1>
            <p className="mt-4 max-w-xl text-balance text-lg text-slate-600 dark:text-slate-300">{copy.subtitle}</p>
          </Reveal>

          <div id="contact-form" className="h-0 scroll-mt-24" aria-hidden="true" />

          <Reveal
            delay={120}
            className="mt-10 w-full rounded-2xl border border-slate-200/80 bg-white p-8 text-start shadow-sm dark:border-white/10 dark:bg-slate-900"
          >
            {state?.success ? (
              <p
                role="status"
                className="flex items-start gap-2.5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {copy.form.success}
              </p>
            ) : (
              <form action={action} className="flex flex-col gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={copy.form.nameLabel}>
                    <input name="name" type="text" required autoComplete="name" className={FIELD_CLASS} />
                  </Field>
                  <Field label={copy.form.companyLabel}>
                    <input name="company" type="text" autoComplete="organization" className={FIELD_CLASS} />
                  </Field>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={copy.form.emailLabel}>
                    <input name="email" type="email" required autoComplete="email" className={FIELD_CLASS} />
                  </Field>
                  <Field label={copy.form.phoneLabel}>
                    <input name="phone" type="tel" required autoComplete="tel" className={FIELD_CLASS} />
                  </Field>
                </div>
                <Field label={copy.form.inquiryTypeLabel}>
                  <select
                    name="inquiryType"
                    value={inquiryType}
                    onChange={(event) => setInquiryType(event.target.value as ContactInquiryType)}
                    className={cn(FIELD_CLASS, "appearance-none")}
                  >
                    {CONTACT_INQUIRY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {copy.inquiryTypes[type]}
                      </option>
                    ))}
                  </select>
                </Field>

                {isCustomPlan && (
                  <div className="flex flex-col gap-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-400/20 dark:bg-blue-400/5">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">{copy.form.customPlanTitle}</p>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label={copy.form.countryLabel}>
                        <input name="country" type="text" autoComplete="country-name" className={FIELD_CLASS} />
                      </Field>
                      <Field label={copy.form.currentSoftwareLabel}>
                        <input name="currentSoftware" type="text" className={FIELD_CLASS} />
                      </Field>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label={copy.form.dentistCountLabel}>
                        <input name="dentistCount" type="text" inputMode="numeric" className={FIELD_CLASS} />
                      </Field>
                      <Field label={copy.form.clinicCountLabel}>
                        <input name="clinicCount" type="text" inputMode="numeric" className={FIELD_CLASS} />
                      </Field>
                    </div>
                    <Field label={copy.form.requestedFeaturesLabel}>
                      <input name="requestedFeatures" type="text" className={FIELD_CLASS} />
                    </Field>
                  </div>
                )}

                <Field label={copy.form.messageLabel}>
                  <textarea
                    name="message"
                    required
                    rows={5}
                    placeholder={copy.form.messagePlaceholder}
                    className={cn(FIELD_CLASS, "h-auto resize-none py-3")}
                  />
                </Field>

                {state?.error && (
                  <p role="alert" className="flex items-start gap-2.5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {state.error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/25 disabled:opacity-70",
                    ctaGlowClass,
                  )}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                  {pending ? copy.form.submitting : copy.form.submit}
                </button>
              </form>
            )}

            <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400 dark:text-slate-500">
              <Mail className="size-3.5 shrink-0" aria-hidden="true" />
              {copy.directEmailPrefix}{" "}
              <a href={`mailto:${copy.info.general.email}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                {copy.info.general.email}
              </a>
            </p>
          </Reveal>
        </div>
      </section>

      <section className="defer-offscreen relative overflow-hidden bg-slate-50 py-16 dark:bg-slate-900/40 md:py-20">
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-10 text-center">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {copy.info.title}
            </h2>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-3">
            {infoCards.map(({ label, email, Icon }, index) => (
              <Reveal key={label} delay={index * 60}>
                <a
                  href={`mailto:${email}`}
                  className="flex h-full flex-col items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-slate-900"
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-teal-50 text-blue-600 dark:from-blue-400/10 dark:to-teal-400/10 dark:text-blue-400">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
                  <span className="text-sm text-blue-600 dark:text-blue-400">{email}</span>
                </a>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200} className="mt-12 text-center">
            <p className="mb-4 text-sm font-medium text-slate-500 dark:text-slate-400">{copy.social.title}</p>
            <div className="flex items-center justify-center gap-3">
              {SOCIAL_LINKS.map(({ key, href, Icon }) => (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={key}
                  className="flex size-10 items-center justify-center rounded-full border border-slate-200/80 text-slate-500 transition-colors hover:border-blue-200 hover:text-blue-600 dark:border-white/10 dark:text-slate-400 dark:hover:border-blue-400/30 dark:hover:text-blue-400"
                >
                  <Icon className="size-4.5" />
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="defer-offscreen relative overflow-hidden bg-white py-16 dark:bg-slate-950 md:py-20">
        <SectionBackground intensity="subtle" />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-blue-50/40 p-10 text-center dark:border-white/10 dark:from-slate-900 dark:to-blue-950/20">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400">
                <MapPin className="size-6" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">{copy.location.title}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">{copy.location.description}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
                {copy.location.badge}
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="defer-offscreen relative overflow-hidden bg-gradient-to-br from-blue-600 to-teal-500 py-20 md:py-24">
        <SectionBackground intensity="gradient" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-white md:text-4xl md:font-semibold">
              {copy.faqCta.title}
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-8 flex flex-col justify-center gap-3.5 md:flex-row">
              <a
                href={`mailto:${copy.info.support.email}`}
                className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-xl md:min-h-0 md:w-auto"
              >
                <Building2 className="size-4" aria-hidden="true" />
                {copy.faqCta.contactSupport}
              </a>
              <Link
                href="/contact?type=demo#contact-form"
                className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 md:min-h-0 md:w-auto"
              >
                <MonitorPlay className="size-4" aria-hidden="true" />
                {copy.faqCta.scheduleDemo}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
