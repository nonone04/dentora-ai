"use client";

import { useState, useTransition } from "react";
import { resendVerificationEmail } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

export function ResendVerificationButton({ email }: { email: string }) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await resendVerificationEmail(email);
            setFeedback({ ok: result.ok, message: result.message });
          });
        }}
      >
        {isPending ? t.verifyEmail.resending : t.verifyEmail.resend}
      </Button>
      {feedback && (
        <p role="alert" className={feedback.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
          {feedback.message}
        </p>
      )}
    </div>
  );
}
