"use client";

import { useActionState } from "react";
import { createDentist, type ActionFormState } from "@/app/actions/dentists";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";

const initialState: ActionFormState = undefined;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

export function NewDentistDialog({ clinicId }: { clinicId: string }) {
  const [state, action, pending] = useActionState(
    createDentist.bind(null, clinicId),
    initialState,
  );
  const t = useTranslations();

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>{t.dentists.dialog.newTitle}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.dentists.dialog.newTitle}</DialogTitle>
          <DialogDescription>{t.dentists.dialog.newDescription}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <Field label={t.dentists.dialog.fullNameLabel}>
            <Input name="fullName" required />
          </Field>
          <Field label={`${t.dentists.dialog.specialtyLabel} (${t.common.optional})`}>
            <Input name="specialty" />
          </Field>
          <Field label={`${t.dentists.dialog.licenseLabel} (${t.common.optional})`}>
            <Input name="licenseNumber" />
          </Field>
          <Field label={`${t.dentists.dialog.colorLabel} (${t.common.optional})`}>
            <Input name="color" type="color" className="h-8 w-16 p-1" />
          </Field>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t.common.creating : t.dentists.dialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
