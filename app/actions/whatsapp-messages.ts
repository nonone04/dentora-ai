"use server";

import { revalidatePath } from "next/cache";
import { getServerDictionary } from "@/lib/i18n/server";
import { createNotificationEvent } from "@/lib/notifications";
import { getLatestWhatsAppDeliveryForAppointment, type AppointmentWhatsAppStatus } from "@/lib/notifications/queries";
import type { NotificationEventType } from "@/lib/notifications/types";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type WhatsAppMessageResult = { ok: true } | { ok: false; message: string };

type AppointmentPatientRow = { patient_id: string | null; patients: { phone: string | null } | null };

/**
 * Every button on the Appointment Details WhatsApp panel funnels
 * through here: an explicit staff action, so it always targets whatsapp
 * regardless of the patient's stored channel preference
 * (createNotificationEvent's channelOverride), and always reuses the
 * same notification_events/notification_deliveries pipeline every
 * automated send already goes through -- retries, status tracking, and
 * Communication History all come for free, no separate send path.
 */
async function sendManualWhatsApp(
  clinicId: string,
  appointmentId: string,
  type: NotificationEventType,
  metadata?: Record<string, unknown>,
): Promise<WhatsAppMessageResult> {
  await requireUser();
  const t = await getServerDictionary();
  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("patient_id, patients(phone)")
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId)
    .maybeSingle<AppointmentPatientRow>();

  if (!appointment?.patient_id) {
    return { ok: false, message: t.calendar.detail.whatsapp.errors.noPatient };
  }
  if (!appointment.patients?.phone) {
    return { ok: false, message: t.calendar.detail.whatsapp.errors.noPhone };
  }

  const outcome = await createNotificationEvent(supabase, {
    clinicId,
    type,
    appointmentId,
    patientId: appointment.patient_id,
    channelOverride: "whatsapp",
    metadata,
  });

  if (!outcome || outcome.deliveriesCreated === 0) {
    return { ok: false, message: t.calendar.detail.whatsapp.errors.sendFailed };
  }

  const { data: delivery } = await supabase
    .from("notification_deliveries")
    .select("status, last_error")
    .eq("notification_event_id", outcome.event.id)
    .maybeSingle();

  revalidatePath(`/clinic/${clinicId}/calendar`);
  revalidatePath(`/clinic/${clinicId}/appointments`);

  if (delivery?.status === "failed") {
    return { ok: false, message: delivery.last_error || t.calendar.detail.whatsapp.errors.sendFailed };
  }
  return { ok: true };
}

export async function sendReminderAction(clinicId: string, appointmentId: string): Promise<WhatsAppMessageResult> {
  return sendManualWhatsApp(clinicId, appointmentId, "appointment_reminder");
}

export async function sendConfirmationAction(clinicId: string, appointmentId: string): Promise<WhatsAppMessageResult> {
  return sendManualWhatsApp(clinicId, appointmentId, "appointment_confirmed");
}

export async function sendReviewRequestAction(clinicId: string, appointmentId: string): Promise<WhatsAppMessageResult> {
  return sendManualWhatsApp(clinicId, appointmentId, "appointment_completed");
}

export async function sendCustomMessageAction(clinicId: string, appointmentId: string, body: string): Promise<WhatsAppMessageResult> {
  const t = await getServerDictionary();
  const trimmed = body.trim();
  if (!trimmed) {
    return { ok: false, message: t.calendar.detail.whatsapp.errors.emptyMessage };
  }
  return sendManualWhatsApp(clinicId, appointmentId, "custom_message", { customBody: trimmed });
}

export async function getAppointmentWhatsAppStatusAction(
  clinicId: string,
  appointmentId: string,
): Promise<AppointmentWhatsAppStatus | null> {
  await requireUser();
  const supabase = await createClient();
  return getLatestWhatsAppDeliveryForAppointment(supabase, { clinicId, appointmentId });
}
