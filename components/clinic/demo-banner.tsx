"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { InfoIcon, RotateCcwIcon } from "lucide-react";
import { resetDemoAction } from "@/app/actions/demo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "@/lib/i18n";

export function DemoBanner({ clinicId }: { clinicId: string }) {
  const t = useTranslations();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justReset, setJustReset] = useState(false);

  function handleReset() {
    startTransition(async () => {
      const result = await resetDemoAction(clinicId);
      if (result.ok) {
        setConfirmOpen(false);
        setError(null);
        setJustReset(true);
        setTimeout(() => setJustReset(false), 4000);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-primary/10 px-4 py-2 text-sm sm:px-6">
      <div className="flex items-center gap-2">
        <InfoIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{t.demo.banner.message}</span>
      </div>
      <div className="flex items-center gap-2">
        {justReset && <span className="text-xs text-muted-foreground">{t.demo.banner.resetSuccess}</span>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setError(null);
            setConfirmOpen(true);
          }}
        >
          <RotateCcwIcon className="size-3.5" aria-hidden="true" />
          {t.demo.banner.reset}
        </Button>
        <Button size="sm" nativeButton={false} render={<Link href="/login" />}>
          {t.demo.banner.signUp}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t.demo.banner.resetConfirmTitle}
        description={t.demo.banner.resetConfirmDescription}
        confirmLabel={t.demo.banner.reset}
        pendingLabel={t.common.saving}
        cancelLabel={t.common.cancel}
        onConfirm={handleReset}
        variant="default"
        pending={pending}
        error={error}
      />
    </div>
  );
}
