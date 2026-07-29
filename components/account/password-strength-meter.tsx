"use client";

import { Progress } from "@/components/ui/progress";
import { scorePasswordStrength } from "@/lib/auth/password";
import { useTranslations } from "@/lib/i18n";

const TIER_CLASSNAME = ["bg-destructive", "bg-destructive", "bg-amber-500", "bg-lime-500", "bg-emerald-500"];

export function PasswordStrengthMeter({ password }: { password: string }) {
  const t = useTranslations();
  const score = scorePasswordStrength(password);
  const labels = [
    t.resetPassword.strength.veryWeak,
    t.resetPassword.strength.veryWeak,
    t.resetPassword.strength.weak,
    t.resetPassword.strength.fair,
    t.resetPassword.strength.strong,
  ];
  const label = password.length === 0 ? null : score === 4 ? t.resetPassword.strength.veryStrong : labels[score];

  return (
    <div className="flex flex-col gap-1">
      <Progress
        value={password.length === 0 ? 0 : ((score + 1) / 5) * 100}
        indicatorClassName={TIER_CLASSNAME[score]}
        aria-label={t.resetPassword.strength.label}
      />
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {label ? `${t.resetPassword.strength.label}: ${label}` : t.resetPassword.strength.label}
      </p>
    </div>
  );
}
