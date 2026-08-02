"use client";

import { useActionState, useState, useTransition } from "react";
import { AlertTriangle, RotateCcwIcon } from "lucide-react";
import { resetClinicDataAction } from "@/app/actions/clinics";
import { resetDemoAction } from "@/app/actions/demo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { interpolate, useTranslations } from "@/lib/i18n";

const initialState: Awaited<ReturnType<typeof resetClinicDataAction>> = undefined;

function ResetClinicDataDialog({
  open,
  onOpenChange,
  clinicId,
  clinicName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  clinicName: string;
}) {
  const t = useTranslations();
  const dz = t.settings.dangerZone;
  const [state, action, pending] = useActionState(resetClinicDataAction.bind(null, clinicId), initialState);
  const [confirmName, setConfirmName] = useState("");
  const matches = confirmName === clinicName;

  function handleOpenChange(next: boolean) {
    if (!next) setConfirmName("");
    onOpenChange(next);
  }

  if (state?.success) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dz.resetSuccess}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => handleOpenChange(false)}>
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dz.confirmTitle}</DialogTitle>
          <DialogDescription>{interpolate(dz.confirmDescription, { clinicName })}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <label htmlFor="confirmName" className="text-sm font-medium">
            {interpolate(dz.confirmNameLabel, { clinicName })}
          </label>
          <Input
            id="confirmName"
            name="confirmName"
            type="text"
            autoComplete="off"
            placeholder={dz.confirmNamePlaceholder}
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
          />
          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="destructive" disabled={pending || !matches}>
              {pending ? t.common.saving : dz.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DemoResetSection({ clinicId }: { clinicId: string }) {
  const t = useTranslations();
  const dz = t.settings.dangerZone;
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
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          {dz.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{dz.description}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <div>
            <p className="text-sm font-medium">{dz.resetDemoData}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{dz.resetDemoDataDescription}</p>
          </div>
          <div className="flex items-center gap-2">
            {justReset && <span className="text-xs text-muted-foreground">{dz.resetSuccess}</span>}
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setConfirmOpen(true)}>
              <RotateCcwIcon className="size-3.5" aria-hidden="true" />
              {dz.resetDemoData}
            </Button>
          </div>
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={dz.resetDemoData}
        description={dz.resetDemoDataDescription}
        confirmLabel={dz.resetDemoData}
        pendingLabel={t.common.saving}
        cancelLabel={t.common.cancel}
        onConfirm={handleReset}
        variant="default"
        pending={pending}
        error={error}
      />
    </Card>
  );
}

/** Settings-page Danger Zone: real clinics get an irreversible, typed-name-confirmed wipe of transactional data; the shared demo clinic gets a reseed instead (see resetDemoAction). Owner-only -- callers must not render this for non-owners. */
export function DangerZone({ clinicId, clinicName, isDemo }: { clinicId: string; clinicName: string; isDemo: boolean }) {
  const t = useTranslations();
  const dz = t.settings.dangerZone;
  const [open, setOpen] = useState(false);

  if (isDemo) return <DemoResetSection clinicId={clinicId} />;

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          {dz.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{dz.description}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <div>
            <p className="text-sm font-medium">{dz.resetClinicData}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{dz.resetClinicDataDescription}</p>
          </div>
          <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
            {dz.resetClinicData}
          </Button>
        </div>
      </CardContent>
      <ResetClinicDataDialog open={open} onOpenChange={setOpen} clinicId={clinicId} clinicName={clinicName} />
    </Card>
  );
}
