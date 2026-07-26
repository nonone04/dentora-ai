import { notFound } from "next/navigation";
import { DetailField } from "@/components/detail-field";
import { MedicalNotesSection } from "@/components/patients/medical-notes-section";
import { NotificationsSection } from "@/components/patients/notifications-section";
import { PatientTimeline, type TimelineEntry } from "@/components/patients/patient-timeline";
import { TreatmentsSection } from "@/components/patients/treatments-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { serviceName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type PatientAppointmentRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  dentists: { full_name: string } | null;
  services: { name_translations: Record<string, string> } | null;
};

type NoteRow = {
  id: string;
  note: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
};

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

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ clinicId: string; patientId: string }>;
}) {
  const { clinicId, patientId } = await params;
  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select(
      "id, full_name, phone, email, date_of_birth, gender, preferred_language, notes, preferred_contact_channel, reminder_opt_in",
    )
    .eq("clinic_id", clinicId)
    .eq("id", patientId)
    .maybeSingle();

  if (!patient) {
    notFound();
  }

  const [
    { data: appointmentsData },
    { data: notesData },
    { data: treatmentsData },
    { data: dentistsData },
    { data: servicesData },
    { data: notificationsData },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, start_at, end_at, status, dentists(full_name), services(name_translations)")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("start_at", { ascending: false }),
    supabase
      .from("medical_notes")
      .select("id, note, created_at, profiles(full_name)")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("treatments")
      .select(
        "id, description, tooth_reference, cost, currency, treated_at, dentists(full_name), services(name_translations)",
      )
      .eq("patient_id", patientId)
      .order("treated_at", { ascending: false }),
    supabase
      .from("dentists")
      .select("id, full_name")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("services")
      .select("id, name_translations")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("created_at"),
    supabase
      .from("notifications")
      .select("id, type, channel, status, scheduled_for, sent_at")
      .eq("patient_id", patientId)
      .order("scheduled_for", { ascending: false }),
  ]);

  const appointments = (appointmentsData ?? []) as unknown as PatientAppointmentRow[];
  const notes = (notesData ?? []) as unknown as NoteRow[];
  const treatments = (treatmentsData ?? []) as unknown as TreatmentRow[];
  const dentists = dentistsData ?? [];
  const services = (servicesData ?? []).map((s) => ({
    id: s.id,
    name: serviceName(s.name_translations),
  }));

  const timelineEntries: TimelineEntry[] = [
    ...appointments.map((appt) => ({
      id: `appointment-${appt.id}`,
      date: appt.start_at,
      kind: "appointment" as const,
      title: `Appointment with ${appt.dentists?.full_name ?? "—"}`,
      description: `${serviceName(appt.services?.name_translations)} · ${appt.status.replace("_", " ")}`,
    })),
    ...notes.map((note) => ({
      id: `note-${note.id}`,
      date: note.created_at,
      kind: "note" as const,
      title: `Note by ${note.profiles?.full_name ?? "Unknown"}`,
      description: note.note,
    })),
    ...treatments.map((treatment) => ({
      id: `treatment-${treatment.id}`,
      date: treatment.treated_at,
      kind: "treatment" as const,
      title: treatment.description,
      description: [treatment.dentists?.full_name, serviceName(treatment.services?.name_translations)]
        .filter(Boolean)
        .join(" · "),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">{patient.full_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Patient profile, medical history, and treatments.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <DetailField label="Phone" value={patient.phone} />
          <DetailField label="Email" value={patient.email} />
          <DetailField label="Date of birth" value={patient.date_of_birth} />
          <DetailField label="Gender" value={patient.gender} />
          <DetailField label="Preferred language" value={patient.preferred_language?.toUpperCase()} />
          <DetailField
            label="Preferred contact channel"
            value={patient.preferred_contact_channel?.toUpperCase()}
          />
          <DetailField
            label="Reminders"
            value={patient.reminder_opt_in ? "Opted in" : "Opted out"}
          />
          {patient.notes && (
            <div className="col-span-full">
              <div className="text-muted-foreground">Notes</div>
              <div>{patient.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <PatientTimeline entries={timelineEntries} />

      <MedicalNotesSection
        clinicId={clinicId}
        patientId={patientId}
        notes={notes}
        appointments={appointments.map((a) => ({ id: a.id, start_at: a.start_at }))}
      />

      <TreatmentsSection
        clinicId={clinicId}
        patientId={patientId}
        treatments={treatments}
        dentists={dentists}
        services={services}
        appointments={appointments.map((a) => ({ id: a.id, start_at: a.start_at }))}
      />

      <NotificationsSection notifications={notificationsData ?? []} />
    </div>
  );
}
