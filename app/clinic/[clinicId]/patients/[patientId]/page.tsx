import { notFound } from "next/navigation";
import { getDashboardSummaryAction } from "@/app/actions/analytics";
import { AISummaryCard } from "@/components/patients/ai-summary-card";
import { CommunicationHistorySection, type PatientConversationRow } from "@/components/patients/communication-history-section";
import { MedicalInfoCard } from "@/components/patients/medical-info-card";
import { MedicalNotesSection } from "@/components/patients/medical-notes-section";
import { NotificationsSection } from "@/components/patients/notifications-section";
import { PatientTimeline, type TimelineEntry } from "@/components/patients/patient-timeline";
import { QuickActionsBar } from "@/components/patients/quick-actions-bar";
import { ReliabilityCard } from "@/components/patients/reliability-card";
import { TreatmentsSection } from "@/components/patients/treatments-section";
import { UpcomingAppointmentsCard } from "@/components/patients/upcoming-appointments-card";
import { FeatureUsageBeacon } from "@/components/telemetry/feature-usage-beacon";
import { loadPatientProfile, type ReliabilityScore } from "@/lib/ai/patient";
import { serviceName } from "@/lib/format";
import { getServerDictionary, getServerLocale, interpolate } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
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

type ConversationRow = {
  id: string;
  channel: string;
  status: string;
  started_at: string;
  ended_at: string | null;
};

const EMPTY_RELIABILITY: ReliabilityScore = {
  score: 0,
  label: "insufficient_data",
  completedCount: 0,
  noShowCount: 0,
  cancelledCount: 0,
  sampleSize: 0,
};

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ clinicId: string; patientId: string }>;
}) {
  const { clinicId, patientId } = await params;
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);
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

  const isManager = membership.role === "owner" || membership.role === "admin";

  const [
    { data: appointmentsData },
    { data: notesData },
    { data: treatmentsData },
    { data: dentistsData },
    { data: servicesData },
    { data: notificationsData },
    { data: conversationsData },
    profile,
    t,
    locale,
    dashboardResult,
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
      .select("id, name_translations, default_duration_minutes")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("created_at"),
    supabase
      .from("notifications")
      .select("id, type, channel, status, scheduled_for, sent_at")
      .eq("patient_id", patientId)
      .order("scheduled_for", { ascending: false }),
    supabase
      .from("ai_conversations")
      .select("id, channel, status, started_at, ended_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("started_at", { ascending: false }),
    loadPatientProfile(supabase, { clinicId, patientId }),
    getServerDictionary(),
    getServerLocale(),
    isManager ? getDashboardSummaryAction(clinicId) : Promise.resolve(null),
  ]);

  const appointments = (appointmentsData ?? []) as unknown as PatientAppointmentRow[];
  const notes = (notesData ?? []) as unknown as NoteRow[];
  const treatments = (treatmentsData ?? []) as unknown as TreatmentRow[];
  const dentists = dentistsData ?? [];
  const services = (servicesData ?? []).map((s) => ({
    id: s.id,
    name: serviceName(s.name_translations, locale),
    defaultDurationMinutes: s.default_duration_minutes,
  }));
  const conversations = (conversationsData ?? []) as unknown as ConversationRow[];

  const conversationIds = conversations.map((c) => c.id);
  const { data: messageRows } =
    conversationIds.length > 0
      ? await supabase.from("ai_messages").select("conversation_id").in("conversation_id", conversationIds)
      : { data: [] as { conversation_id: string }[] };
  const messageCountByConversationId = new Map<string, number>();
  for (const row of messageRows ?? []) {
    messageCountByConversationId.set(row.conversation_id, (messageCountByConversationId.get(row.conversation_id) ?? 0) + 1);
  }
  const conversationRows: PatientConversationRow[] = conversations.map((c) => ({
    id: c.id,
    channel: c.channel,
    status: c.status,
    started_at: c.started_at,
    ended_at: c.ended_at,
    messageCount: messageCountByConversationId.get(c.id) ?? 0,
  }));

  const now = new Date().getTime();
  const upcomingAppointments = appointments
    .filter((a) => new Date(a.start_at).getTime() >= now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const dentistNameById = Object.fromEntries(dentists.map((d) => [d.id, d.full_name]));
  const appointmentOptions = appointments.map((a) => ({ id: a.id, start_at: a.start_at }));

  const timelineEntries: TimelineEntry[] = [
    ...appointments.map((appt) => ({
      id: `appointment-${appt.id}`,
      date: appt.start_at,
      kind: "appointment" as const,
      title: interpolate(t.patientDetail.timeline.appointmentTitle, { dentist: appt.dentists?.full_name ?? t.common.dash }),
      description: `${serviceName(appt.services?.name_translations, locale)} · ${t.appointmentStatus[appt.status as keyof typeof t.appointmentStatus] ?? appt.status}`,
    })),
    ...notes.map((note) => ({
      id: `note-${note.id}`,
      date: note.created_at,
      kind: "note" as const,
      title: interpolate(t.patientDetail.timeline.noteTitle, { author: note.profiles?.full_name ?? t.patientDetail.timeline.unknownAuthor }),
      description: note.note,
    })),
    ...treatments.map((treatment) => ({
      id: `treatment-${treatment.id}`,
      date: treatment.treated_at,
      kind: "treatment" as const,
      title: treatment.description,
      description: [treatment.dentists?.full_name, serviceName(treatment.services?.name_translations, locale)]
        .filter(Boolean)
        .join(" · "),
    })),
    ...conversations.map((conversation) => ({
      id: `conversation-${conversation.id}`,
      date: conversation.started_at,
      kind: "conversation" as const,
      title: interpolate(t.patientDetail.timeline.conversationTitle, {
        channel: t.channel[conversation.channel as keyof typeof t.channel] ?? conversation.channel,
      }),
      description: t.conversationStatus[conversation.status as keyof typeof t.conversationStatus] ?? conversation.status,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const clinicAverageScore =
    isManager && dashboardResult && "data" in dashboardResult ? dashboardResult.data.patientBehavior.avgReliabilityScore : null;

  return (
    <div className="flex flex-col gap-6">
      <FeatureUsageBeacon feature="patient_profile" clinicId={clinicId} />
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-lg font-semibold">{patient.full_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.patientDetail.description}</p>
        </div>
        <QuickActionsBar
          clinicId={clinicId}
          patientId={patientId}
          phone={patient.phone}
          patients={[{ id: patient.id, full_name: patient.full_name }]}
          dentists={dentists}
          services={services}
          t={t}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <MedicalInfoCard patient={patient} t={t} locale={locale} />
          <PatientTimeline entries={timelineEntries} t={t} locale={locale} />
          <MedicalNotesSection clinicId={clinicId} patientId={patientId} notes={notes} appointments={appointmentOptions} t={t} locale={locale} />
          <TreatmentsSection
            clinicId={clinicId}
            patientId={patientId}
            treatments={treatments}
            dentists={dentists}
            services={services}
            appointments={appointmentOptions}
            t={t}
            locale={locale}
          />
        </div>

        <div className="flex flex-col gap-6">
          <AISummaryCard clinicId={clinicId} patientId={patientId} profile={profile} dentistNameById={dentistNameById} t={t} locale={locale} />
          <ReliabilityCard reliability={profile?.reliability ?? EMPTY_RELIABILITY} clinicAverageScore={clinicAverageScore} t={t} />
          <UpcomingAppointmentsCard clinicId={clinicId} appointments={upcomingAppointments} t={t} locale={locale} />
          <CommunicationHistorySection clinicId={clinicId} conversations={conversationRows} role={membership.role} t={t} locale={locale} />
          <NotificationsSection notifications={notificationsData ?? []} t={t} locale={locale} />
        </div>
      </div>
    </div>
  );
}
