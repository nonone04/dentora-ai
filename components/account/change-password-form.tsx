"use client";

import { useActionState, useState } from "react";
import { changePasswordAction, type ChangePasswordState } from "@/app/actions/account-security";
import { PasswordStrengthMeter } from "@/components/account/password-strength-meter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";

const initialState: ChangePasswordState = undefined;

export function ChangePasswordForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(changePasswordAction, initialState);
  const [newPassword, setNewPassword] = useState("");

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="currentPassword" className="text-sm font-medium">
          {t.accountSecurity.changePassword.currentPasswordLabel}
        </label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="newPassword" className="text-sm font-medium">
          {t.accountSecurity.changePassword.newPasswordLabel}
        </label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <PasswordStrengthMeter password={newPassword} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          {t.accountSecurity.changePassword.confirmPasswordLabel}
        </label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.success && <p className="text-sm text-muted-foreground">{t.accountSecurity.changePassword.success}</p>}
      <Button type="submit" disabled={pending} className="mt-1 self-start">
        {pending ? t.accountSecurity.changePassword.submitting : t.accountSecurity.changePassword.submit}
      </Button>
    </form>
  );
}
