"use client";

import { useActionState } from "react";
import { addTreatment, type ActionFormState } from "@/app/actions/medical-records";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DEFAULT_CURRENCY, formatCurrency, isCurrencyCode } from "@/lib/currency";
import { formatDateTime, INTL_LOCALE, serviceName } from "@/lib/format";
import { interpolate, type Dictionary, type Locale } from "@/lib/i18n";

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
  t,
  locale,
}: {
  clinicId: string;
  patientId: string;
  treatments: TreatmentRow[];
  dentists: Option[];
  services: ServiceOption[];
  appointments: AppointmentOption[];
  t: Dictionary;
  locale: Locale;
}) {
  const [state, action, pending] = useActionState(
    addTreatment.bind(null, clinicId, patientId),
    initialState,
  );

  return (
    <Card id="treatments">
      <CardHeader>
        <CardTitle>{t.patientDetail.treatments.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {treatments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.patientDetail.treatments.empty}</p>
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {treatments.map((tr) => (
              <li key={tr.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {tr.dentists?.full_name ?? t.common.dash}
                    {tr.services ? ` · ${serviceName(tr.services.name_translations, locale)}` : ""}
                  </span>
                  <span>{formatDateTime(tr.treated_at, locale)}</span>
                </div>
                <p className="mt-1">{tr.description}</p>
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  {tr.tooth_reference && <span>{interpolate(t.patientDetail.treatments.toothPrefix, { tooth: tr.tooth_reference })}</span>}
                  {tr.cost != null && (
                    <span>{formatCurrency(Number(tr.cost), isCurrencyCode(tr.currency) ? tr.currency : DEFAULT_CURRENCY, INTL_LOCALE[locale])}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={action} className="flex flex-col gap-3 border-t border-border pt-4">
          <Field label={t.patientDetail.treatments.dentistLabel}>
            <select name="dentistId" required defaultValue="" className={selectClass}>
              <option value="" disabled>
                {t.appointments.dialog.selectDentist}
              </option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.patientDetail.treatments.serviceLabel}>
            <select name="serviceId" defaultValue="" className={selectClass}>
              <option value="">{t.patientDetail.treatments.noService}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {appointments.length > 0 && (
            <Field label={t.patientDetail.treatments.appointmentLabel}>
              <select name="appointmentId" defaultValue="" className={selectClass}>
                <option value="">{t.patientDetail.treatments.notLinked}</option>
                {appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatDateTime(a.start_at, locale)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t.patientDetail.treatments.descriptionLabel}>
            <Input name="description" required />
          </Field>
          <Field label={t.patientDetail.treatments.toothLabel}>
            <Input name="toothReference" />
          </Field>
          <Field label={t.patientDetail.treatments.costLabel}>
            <Input type="number" name="cost" min={0} step="0.01" />
          </Field>
          <Field label={t.patientDetail.treatments.dateLabel}>
            <Input type="datetime-local" name="treatedAt" />
          </Field>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} size="sm" className="self-start">
            {pending ? t.patientDetail.treatments.adding : t.patientDetail.treatments.add}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
