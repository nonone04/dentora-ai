"use client";

import { useActionState } from "react";
import { CheckCircle2, PlayCircle, Sparkles } from "lucide-react";
import { enterDemoAction, type EnterDemoFormState } from "@/app/actions/demo";
import { Reveal } from "@/components/marketing/motion/reveal";
import { useTranslations } from "@/lib/i18n";

const initialState: EnterDemoFormState = undefined;

export function DemoContent() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(enterDemoAction, initialState);

  return (
    <section className="relative overflow-hidden bg-white dark:bg-slate-950">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute start-1/2 top-[-10%] size-[500px] -translate-x-1/2 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-500/10" />
      </div>

      <div className="relative mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <Reveal className="flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {t.marketing.nav.demo}
          </span>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
            {t.marketing.demoPage.title}
          </h1>
          <p className="mt-4 max-w-xl text-balance text-lg text-slate-600 dark:text-slate-300">{t.marketing.demoPage.subtitle}</p>
        </Reveal>

        <Reveal delay={120} className="mt-10 w-full rounded-2xl border border-slate-200/80 bg-white p-8 text-start shadow-sm dark:border-white/10 dark:bg-slate-900">
          <ul className="flex flex-col gap-3">
            {t.marketing.demoPage.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          <form action={action} className="mt-6">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/25 disabled:opacity-70"
            >
              <PlayCircle className="size-4" aria-hidden="true" />
              {pending ? t.marketing.demoPage.launching : t.marketing.demoPage.launch}
            </button>
            {state?.error && (
              <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
                {state.error}
              </p>
            )}
          </form>
          <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">{t.marketing.demoPage.disclaimer}</p>
        </Reveal>
      </div>
    </section>
  );
}
