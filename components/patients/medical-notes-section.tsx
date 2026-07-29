"use client";

import { useActionState } from "react";
import { addMedicalNote, type ActionFormState } from "@/app/actions/medical-records";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";

type NoteRow = {
  id: string;
  note: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
};

type AppointmentOption = { id: string; start_at: string };

const initialState: ActionFormState = undefined;

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

export function MedicalNotesSection({
  clinicId,
  patientId,
  notes,
  appointments,
  t,
  locale,
}: {
  clinicId: string;
  patientId: string;
  notes: NoteRow[];
  appointments: AppointmentOption[];
  t: Dictionary;
  locale: Locale;
}) {
  const [state, action, pending] = useActionState(
    addMedicalNote.bind(null, clinicId, patientId),
    initialState,
  );

  return (
    <Card id="medical-notes">
      <CardHeader>
        <CardTitle>{t.patientDetail.medicalNotes.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.patientDetail.medicalNotes.empty}</p>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {notes.map((n) => (
              <li key={n.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{n.profiles?.full_name ?? t.patientDetail.medicalNotes.unknownAuthor}</span>
                  <span>{formatDateTime(n.created_at, locale)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{n.note}</p>
              </li>
            ))}
          </ul>
        )}

        <form action={action} className="flex flex-col gap-2 border-t border-border pt-4">
          <Textarea name="note" rows={3} placeholder={t.patientDetail.medicalNotes.placeholder} required />
          {appointments.length > 0 && (
            <select name="appointmentId" defaultValue="" className={selectClass}>
              <option value="">{t.patientDetail.medicalNotes.notLinked}</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {formatDateTime(a.start_at, locale)}
                </option>
              ))}
            </select>
          )}
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} size="sm" className="self-start">
            {pending ? t.patientDetail.medicalNotes.adding : t.patientDetail.medicalNotes.add}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
