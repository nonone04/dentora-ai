"use client";

import { useActionState } from "react";
import { createPatient, type CreatePatientFormState } from "@/app/actions/patients";
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
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/lib/i18n";

const initialState: CreatePatientFormState = undefined;

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

export function NewPatientDialog({ clinicId }: { clinicId: string }) {
  const [state, action, pending] = useActionState(
    createPatient.bind(null, clinicId),
    initialState,
  );
  const t = useTranslations();

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>{t.dashboard.quickActions.newPatient}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.patients.dialog.newTitle}</DialogTitle>
          <DialogDescription>{t.patients.dialog.newDescription}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <Field label={t.patients.dialog.fullNameLabel}>
            <Input name="fullName" required />
          </Field>
          <Field label={`${t.patients.dialog.phoneLabel} (${t.common.optional})`}>
            <Input name="phone" type="tel" />
          </Field>
          <Field label={`${t.patients.dialog.emailLabel} (${t.common.optional})`}>
            <Input name="email" type="email" />
          </Field>
          <Field label={`${t.patients.dialog.dobLabel} (${t.common.optional})`}>
            <Input name="dateOfBirth" type="date" />
          </Field>
          <Field label={`${t.patients.dialog.genderLabel} (${t.common.optional})`}>
            <Input name="gender" />
          </Field>
          <Field label={t.patients.dialog.preferredLanguageLabel}>
            <select name="preferredLanguage" defaultValue="fr" className={selectClass}>
              <option value="fr">{t.patients.dialog.languageFrench}</option>
              <option value="ar">{t.patients.dialog.languageArabic}</option>
              <option value="en">{t.patients.dialog.languageEnglish}</option>
            </select>
          </Field>
          <Field label={t.patients.dialog.preferredChannelLabel}>
            <select name="preferredContactChannel" defaultValue="email" className={selectClass}>
              <option value="email">{t.patients.dialog.channelEmail}</option>
              <option value="sms">{t.patients.dialog.channelSms}</option>
              <option value="whatsapp">{t.patients.dialog.channelWhatsapp}</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="reminderOptIn"
              defaultChecked
              className="size-4 rounded border-input"
            />
            {t.patients.dialog.reminderOptIn}
          </label>
          <Field label={`${t.patients.dialog.notesLabel} (${t.common.optional})`}>
            <Textarea name="notes" rows={3} />
          </Field>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t.common.creating : t.patients.dialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
