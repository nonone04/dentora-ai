"use client";

import { useActionState, useState } from "react";
import { completePasswordReset, type AuthFormState } from "@/app/actions/auth";
import { PasswordStrengthMeter } from "@/components/account/password-strength-meter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";

const initialState: AuthFormState = undefined;

export default function ResetPasswordPage() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(completePasswordReset, initialState);
  const [password, setPassword] = useState("");

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t.resetPassword.title}</CardTitle>
          <CardDescription>{t.resetPassword.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium">
                {t.resetPassword.newPasswordLabel}
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <PasswordStrengthMeter password={password} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                {t.resetPassword.confirmPasswordLabel}
              </label>
              <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
            </div>
            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="mt-1 w-full">
              {pending ? t.resetPassword.submitting : t.resetPassword.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
