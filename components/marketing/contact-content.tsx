"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Mail, Send, Sparkles } from "lucide-react";
import { submitContactRequest, type ContactFormState } from "@/app/actions/contact";
import { Reveal } from "@/components/marketing/motion/reveal";
import { ctaGlowClass } from "@/components/marketing/motion/interactive-classes";
import { useTranslations } from "@/lib/i18n";
import { CONTACT_INQUIRY_TYPES } from "@/lib/marketing/contact";
import { cn } from "@/lib/utils";

const initialState: ContactFormState = undefined;

const FIELD_CLASS =
  "h-12 w-full rounded-xl border border-slate-200/80 bg-white px-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
      {children}
    </div>
  );
}

export function ContactContent() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(submitContactRequest, initialState);
  const copy = t.marketing.contact;

  return (
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
                <Field label={copy.form.emailLabel}>
                  <input name="email" type="email" required autoComplete="email" className={FIELD_CLASS} />
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={copy.form.companyLabel}>
                  <input name="company" type="text" autoComplete="organization" className={FIELD_CLASS} />
                </Field>
                <Field label={copy.form.inquiryTypeLabel}>
                  <select name="inquiryType" defaultValue="enterprise" className={cn(FIELD_CLASS, "appearance-none")}>
                    {CONTACT_INQUIRY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {copy.inquiryTypes[type]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
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
            <a href="mailto:support@dentora.ai" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
              support@dentora.ai
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
