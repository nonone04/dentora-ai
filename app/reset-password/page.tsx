"use client";

import { useActionState, useState } from "react";
import { AlertCircle, KeyRound, Loader2 } from "lucide-react";
import { completePasswordReset, type AuthFormState } from "@/app/actions/auth";
import { PasswordStrengthMeter } from "@/components/account/password-strength-meter";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { useTranslations } from "@/lib/i18n";

const initialState: AuthFormState = undefined;

export default function ResetPasswordPage() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(completePasswordReset, initialState);
  const [password, setPassword] = useState("");

  return (
    <AuthShell t={t}>
      <div className="flex flex-col gap-1.5 text-center sm:text-start">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#2563EB_0%,#4F46E5_100%)] text-white shadow-md shadow-blue-600/20 sm:mx-0">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{t.resetPassword.title}</h2>
        <p className="text-sm text-muted-foreground">{t.resetPassword.description}</p>
      </div>

      <form action={action} className="mt-7 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <PasswordField
            label={t.resetPassword.newPasswordLabel}
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordStrengthMeter password={password} />
        </div>
        <PasswordField
          label={t.resetPassword.confirmPasswordLabel}
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {state?.error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        )}
        <AuthButton type="submit" disabled={pending} className="mt-1">
          {pending ? t.resetPassword.submitting : t.resetPassword.submit}
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        </AuthButton>
      </form>
    </AuthShell>
  );
}
