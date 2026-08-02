import type { SupabaseClient } from "@supabase/supabase-js";
import { isResponseLanguage, type ResponseLanguage } from "@/lib/ai/nlu/language";
import type { NotificationChannel } from "@/lib/notifications/provider";
import { DEFAULT_REMINDER_HOURS_BEFORE, DEFAULT_SECONDARY_REMINDER_HOURS_BEFORE, getClinicNotificationSettings } from "@/lib/notifications/settings";

export type NotificationContextPatient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferredLanguage: ResponseLanguage;
  preferredContactChannel: NotificationChannel;
  reminderOptIn: boolean;
};

export type NotificationContextAppointment = {
  id: string;
  startAt: string;
  endAt: string;
  dentistName: string | null;
  serviceName: string | null;
};

export type NotificationContext = {
  clinicId: string;
  clinicName: string;
  clinicEmail: string | null;
  timezone: string;
  defaultLanguage: ResponseLanguage;
  reminderHoursBefore: number;
  /** null when the clinic has explicitly opted out of the second reminder -- see lib/notifications/settings.ts. */
  secondaryReminderHoursBefore: number | null;
  sendConfirmations: boolean;
  googleReviewUrl: string | null;
  /** Notification preference gates -- default true when unset, see lib/notifications/settings.ts. Consumed by engine.ts's buildDeliveryPlans. */
  emailChannelEnabled: boolean;
  inAppChannelEnabled: boolean;
  appointmentRemindersEnabled: boolean;
  aiSummariesEnabled: boolean;
  patient: NotificationContextPatient | null;
  appointment: NotificationContextAppointment | null;
};

function pickTranslation(translations: Record<string, string> | null | undefined, language: ResponseLanguage): string | null {
  if (!translations) return null;
  return translations[language] ?? translations.en ?? translations.fr ?? translations.ar ?? Object.values(translations)[0] ?? null;
}

/**
 * Gathers everything a notification template needs to render: the
 * clinic's own name/email/timezone/language/settings, the recipient
 * patient's contact details and preferences (when there is a resolved
 * patient), and the appointment/draft's dentist and service names.
 * Every secondary lookup runs via Promise.allSettled -- a single failed
 * query (e.g. the dentist row) degrades that one field to null rather
 * than failing the whole context, mirroring lib/ai/patient/store.ts's
 * gatherFacts.
 */
export async function loadNotificationContext(
  supabase: SupabaseClient,
  params: { clinicId: string; appointmentId?: string | null; appointmentDraftId?: string | null; patientId?: string | null },
): Promise<NotificationContext | null> {
  const [clinicResult, appointmentResult, draftResult] = await Promise.allSettled([
    supabase.from("clinics").select("name, email, timezone, default_language, settings").eq("id", params.clinicId).maybeSingle(),
    params.appointmentId
      ? supabase
          .from("appointments")
          .select("id, patient_id, start_at, end_at, dentist_id, service_id")
          .eq("id", params.appointmentId)
          .eq("clinic_id", params.clinicId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    params.appointmentDraftId
      ? supabase
          .from("appointment_drafts")
          .select("id, patient_id, patient_name, patient_phone, proposed_start_at, proposed_end_at, dentist_id, service_id")
          .eq("id", params.appointmentDraftId)
          .eq("clinic_id", params.clinicId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const clinic = clinicResult.status === "fulfilled" ? (clinicResult.value.data as Record<string, unknown> | null) : null;
  if (!clinic) return null;

  const appointment = appointmentResult.status === "fulfilled" ? (appointmentResult.value.data as Record<string, unknown> | null) : null;
  const draft = draftResult.status === "fulfilled" ? (draftResult.value.data as Record<string, unknown> | null) : null;

  const resolvedPatientId = params.patientId ?? (appointment?.patient_id as string | undefined) ?? (draft?.patient_id as string | undefined) ?? null;
  const dentistId = (appointment?.dentist_id as string | undefined) ?? (draft?.dentist_id as string | undefined) ?? null;
  const serviceId = (appointment?.service_id as string | undefined) ?? (draft?.service_id as string | undefined) ?? null;

  const [patientResult, dentistResult, serviceResult] = await Promise.allSettled([
    resolvedPatientId
      ? supabase
          .from("patients")
          .select("id, full_name, email, phone, preferred_language, preferred_contact_channel, reminder_opt_in")
          .eq("id", resolvedPatientId)
          .eq("clinic_id", params.clinicId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    dentistId
      ? supabase.from("dentists").select("full_name").eq("id", dentistId).eq("clinic_id", params.clinicId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    serviceId
      ? supabase.from("services").select("name_translations").eq("id", serviceId).eq("clinic_id", params.clinicId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const patientRow = patientResult.status === "fulfilled" ? (patientResult.value.data as Record<string, unknown> | null) : null;
  const dentistRow = dentistResult.status === "fulfilled" ? (dentistResult.value.data as Record<string, unknown> | null) : null;
  const serviceRow = serviceResult.status === "fulfilled" ? (serviceResult.value.data as Record<string, unknown> | null) : null;

  const defaultLanguage = isResponseLanguage(clinic.default_language as string) ? (clinic.default_language as ResponseLanguage) : "en";
  const notificationSettings = getClinicNotificationSettings(clinic.settings as Record<string, unknown> | null | undefined);

  // A draft's patient isn't always a registered patients row yet (see
  // lib/ai/tools/draft-appointment.ts) -- fall back to the draft's own
  // free-text patient_name/patient_phone so a booking notification still
  // has something to address, with an empty id (never a real
  // recipientPatientId to persist).
  const patient: NotificationContextPatient | null = patientRow
    ? {
        id: patientRow.id as string,
        name: (patientRow.full_name as string) ?? "This patient",
        email: (patientRow.email as string | null) ?? null,
        phone: (patientRow.phone as string | null) ?? null,
        preferredLanguage: isResponseLanguage(patientRow.preferred_language as string)
          ? (patientRow.preferred_language as ResponseLanguage)
          : defaultLanguage,
        preferredContactChannel: ((patientRow.preferred_contact_channel as NotificationChannel | undefined) ?? "email") as NotificationChannel,
        reminderOptIn: patientRow.reminder_opt_in !== false,
      }
    : draft && (draft.patient_name || draft.patient_phone)
      ? {
          id: "",
          name: (draft.patient_name as string | null) ?? "This patient",
          email: null,
          phone: (draft.patient_phone as string | null) ?? null,
          preferredLanguage: defaultLanguage,
          preferredContactChannel: "email",
          reminderOptIn: true,
        }
      : null;

  const serviceName = pickTranslation(serviceRow?.name_translations as Record<string, string> | null | undefined, defaultLanguage);
  const dentistName = (dentistRow?.full_name as string | undefined) ?? null;

  const appointmentInfo: NotificationContextAppointment | null = appointment
    ? {
        id: appointment.id as string,
        startAt: appointment.start_at as string,
        endAt: appointment.end_at as string,
        dentistName,
        serviceName,
      }
    : draft
      ? {
          id: draft.id as string,
          startAt: draft.proposed_start_at as string,
          endAt: draft.proposed_end_at as string,
          dentistName,
          serviceName,
        }
      : null;

  return {
    clinicId: params.clinicId,
    clinicName: (clinic.name as string) ?? "",
    clinicEmail: (clinic.email as string | null) ?? null,
    timezone: (clinic.timezone as string) ?? "UTC",
    defaultLanguage,
    reminderHoursBefore: notificationSettings.reminderHoursBefore ?? DEFAULT_REMINDER_HOURS_BEFORE,
    secondaryReminderHoursBefore:
      notificationSettings.secondaryReminderHoursBefore === null
        ? null
        : (notificationSettings.secondaryReminderHoursBefore ?? DEFAULT_SECONDARY_REMINDER_HOURS_BEFORE),
    sendConfirmations: notificationSettings.sendConfirmations !== false,
    googleReviewUrl: notificationSettings.googleReviewUrl ?? null,
    emailChannelEnabled: notificationSettings.channels?.email !== false,
    inAppChannelEnabled: notificationSettings.channels?.inApp !== false,
    appointmentRemindersEnabled: notificationSettings.categories?.appointmentReminders !== false,
    aiSummariesEnabled: notificationSettings.categories?.aiSummaries !== false,
    patient,
    appointment: appointmentInfo,
  };
}
