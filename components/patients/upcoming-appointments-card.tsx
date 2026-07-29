import { CalendarClock } from "lucide-react";
import { AppointmentStatusForm } from "@/components/appointments/appointment-status-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, serviceName } from "@/lib/format";
import { interpolate, type Dictionary, type Locale } from "@/lib/i18n";

type UpcomingAppointmentRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  dentists: { full_name: string } | null;
  services: { name_translations: Record<string, string> } | null;
};

export function UpcomingAppointmentsCard({
  clinicId,
  appointments,
  t,
  locale,
}: {
  clinicId: string;
  appointments: UpcomingAppointmentRow[];
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.patientDetail.upcomingAppointments.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={t.patientDetail.upcomingAppointments.empty}
            description={t.patientDetail.upcomingAppointments.emptyDescription}
          />
        ) : (
          <ul className="flex flex-col gap-3 text-sm">
            {appointments.map((appt) => (
              <li key={appt.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                <div>
                  <div className="font-medium">
                    {interpolate(t.patientDetail.upcomingAppointments.with, { dentist: appt.dentists?.full_name ?? t.common.dash })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {serviceName(appt.services?.name_translations, locale)} · {formatDateTime(appt.start_at, locale)}
                  </div>
                </div>
                <AppointmentStatusForm clinicId={clinicId} appointmentId={appt.id} status={appt.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
