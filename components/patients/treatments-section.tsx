"use client";

import { useActionState } from "react";
import { addTreatment, type ActionFormState } from "@/app/actions/medical-records";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime, serviceName } from "@/lib/format";

type TreatmentRow = {
  id: string;
  description: string;
  tooth_reference: string | null;
  cost: number | string | null;
  currency: string;
  treated_at: string;
  dentists: { full_name: string } | null;
  services: { name_translations: Record<string, string> } | null;
};

type Option = { id: string; full_name: string };
type ServiceOption = { id: string; name: string };
type AppointmentOption = { id: string; start_at: string };

const initialState: ActionFormState = undefined;

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

export function TreatmentsSection({
  clinicId,
  patientId,
  treatments,
  dentists,
  services,
  appointments,
}: {
  clinicId: string;
  patientId: string;
  treatments: TreatmentRow[];
  dentists: Option[];
  services: ServiceOption[];
  appointments: AppointmentOption[];
}) {
  const [state, action, pending] = useActionState(
    addTreatment.bind(null, clinicId, patientId),
    initialState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Treatments</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {treatments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No treatments recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {treatments.map((t) => (
              <li key={t.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {t.dentists?.full_name ?? "—"}
                    {t.services ? ` · ${serviceName(t.services.name_translations)}` : ""}
                  </span>
                  <span>{formatDateTime(t.treated_at)}</span>
                </div>
                <p className="mt-1">{t.description}</p>
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  {t.tooth_reference && <span>Tooth: {t.tooth_reference}</span>}
                  {t.cost != null && (
                    <span>
                      {t.cost} {t.currency}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={action} className="flex flex-col gap-3 border-t border-border pt-4">
          <Field label="Dentist">
            <select name="dentistId" required defaultValue="" className={selectClass}>
              <option value="" disabled>
                Select a dentist
              </option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Service (optional)">
            <select name="serviceId" defaultValue="" className={selectClass}>
              <option value="">No service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {appointments.length > 0 && (
            <Field label="Linked appointment (optional)">
              <select name="appointmentId" defaultValue="" className={selectClass}>
                <option value="">Not linked</option>
                {appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatDateTime(a.start_at)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Description">
            <Input name="description" required />
          </Field>
          <Field label="Tooth reference (optional)">
            <Input name="toothReference" />
          </Field>
          <Field label="Cost (optional)">
            <Input type="number" name="cost" min={0} step="0.01" />
          </Field>
          <Field label="Treatment date">
            <Input type="datetime-local" name="treatedAt" />
          </Field>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} size="sm" className="self-start">
            {pending ? "Adding..." : "Add treatment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
