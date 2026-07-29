import { AppointmentStatusForm } from "@/components/appointments/appointment-status-form";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, serviceName } from "@/lib/format";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type AppointmentRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  notes: string | null;
  patients: { full_name: string } | null;
  dentists: { full_name: string } | null;
  services: { name_translations: Record<string, string> } | null;
};

export default async function AppointmentsPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const supabase = await createClient();

  const [{ data: appointmentsData }, { data: patients }, { data: dentists }, { data: services }, t, locale] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, start_at, end_at, status, notes, patients(full_name), dentists(full_name), services(name_translations)",
        )
        .eq("clinic_id", clinicId)
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true }),
      supabase.from("patients").select("id, full_name").eq("clinic_id", clinicId).order("full_name"),
      supabase
        .from("dentists")
        .select("id, full_name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("services")
        .select("id, name_translations, default_duration_minutes")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("created_at"),
      getServerDictionary(),
      getServerLocale(),
    ]);

  const appointments = (appointmentsData ?? []) as unknown as AppointmentRow[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t.appointments.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.appointments.description}</p>
        </div>
        <NewAppointmentDialog
          clinicId={clinicId}
          patients={patients ?? []}
          dentists={dentists ?? []}
          services={(services ?? []).map((s) => ({
            id: s.id,
            name: serviceName(s.name_translations, locale),
            defaultDurationMinutes: s.default_duration_minutes,
          }))}
        />
      </div>

      {!appointments || appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.appointments.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.appointments.patient}</TableHead>
              <TableHead>{t.appointments.dentist}</TableHead>
              <TableHead>{t.appointments.service}</TableHead>
              <TableHead>{t.appointments.start}</TableHead>
              <TableHead>{t.appointments.end}</TableHead>
              <TableHead>{t.appointments.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((appt) => (
              <TableRow key={appt.id}>
                <TableCell>{appt.patients?.full_name ?? t.common.dash}</TableCell>
                <TableCell>{appt.dentists?.full_name ?? t.common.dash}</TableCell>
                <TableCell>{serviceName(appt.services?.name_translations, locale)}</TableCell>
                <TableCell>{formatDateTime(appt.start_at, locale)}</TableCell>
                <TableCell>{formatDateTime(appt.end_at, locale)}</TableCell>
                <TableCell>
                  <AppointmentStatusForm
                    clinicId={clinicId}
                    appointmentId={appt.id}
                    status={appt.status}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
