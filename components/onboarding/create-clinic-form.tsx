"use client";

import { useActionState } from "react";
import { createClinic, type CreateClinicFormState } from "@/app/actions/clinics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";

const initialState: CreateClinicFormState = undefined;

export function CreateClinicForm() {
  const [state, action, pending] = useActionState(createClinic, initialState);
  const t = useTranslations();

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          {t.onboarding.clinicNameLabel}
        </label>
        <Input id="name" name="name" type="text" autoComplete="organization" required />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? t.onboarding.creatingClinic : t.onboarding.createClinicButton}
      </Button>
    </form>
  );
}
