"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import { requestPasswordReset, type AuthFormState } from "@/app/actions/auth";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthField } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { useTranslations } from "@/lib/i18n";

const initialState: AuthFormState = undefined;

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <AuthShell t={t}>
      <Link
        href="/login"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t.forgotPassword.backToLogin}
      </Link>

      <div className="flex flex-col gap-1.5 text-center sm:text-start">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t.forgotPassword.title}</h2>
        <p className="text-sm text-muted-foreground">{t.forgotPassword.description}</p>
      </div>

      <form action={action} className="mt-7 flex flex-col gap-4">
        <AuthField label={t.forgotPassword.emailLabel} name="email" type="email" icon={Mail} autoComplete="email" required />
        {state?.error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        )}
        {state?.message && (
          <p className="flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.message}
          </p>
        )}
        <AuthButton type="submit" disabled={pending} className="mt-1">
          {pending ? t.forgotPassword.submitting : t.forgotPassword.submit}
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
        </AuthButton>
      </form>
    </AuthShell>
  );
}
