import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { sendTextMessage } from "@/lib/whatsapp/client";
import { renderWhatsAppMessage } from "@/lib/whatsapp/templates";
import type { WhatsAppApiConfig, WhatsAppSendResult } from "@/lib/whatsapp/types";

/**
 * Standalone, DB-free "compose and send one WhatsApp message" API --
 * exactly the reusable functions requested for direct/programmatic use
 * (e.g. the Settings page's Send Test Message button, which has no
 * appointment/notification_event to attach a send to). For anything
 * tied to an appointment (dashboard Send Reminder/Confirmation/Review
 * Request buttons), app/actions/whatsapp-messages.ts goes through the
 * full notification_events/notification_deliveries pipeline instead
 * (lib/notifications/engine.ts's createNotificationEvent with a
 * channelOverride), so delivery status/retries/Communication History
 * all come for free -- these functions intentionally do not duplicate
 * that bookkeeping.
 */
function getConfig(): WhatsAppApiConfig | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId };
}

const NOT_CONFIGURED_ERROR = "WhatsApp is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing).";

export async function sendAppointmentReminder(params: {
  patientName: string;
  phone: string;
  appointmentDate: string;
  appointmentTime: string;
  clinicName: string;
  dentistName?: string | null;
  language?: ResponseLanguage;
}): Promise<WhatsAppSendResult> {
  const config = getConfig();
  if (!config) return { success: false, error: NOT_CONFIGURED_ERROR };

  const body = renderWhatsAppMessage("reminder", params.language ?? "en", {
    patientName: params.patientName,
    clinicName: params.clinicName,
    dentistName: params.dentistName,
    appointmentDate: params.appointmentDate,
    appointmentTime: params.appointmentTime,
  });
  return sendTextMessage(config, params.phone, body);
}

export async function sendAppointmentConfirmation(params: {
  patientName: string;
  phone: string;
  appointmentDate: string;
  appointmentTime: string;
  clinicName: string;
  dentistName?: string | null;
  language?: ResponseLanguage;
}): Promise<WhatsAppSendResult> {
  const config = getConfig();
  if (!config) return { success: false, error: NOT_CONFIGURED_ERROR };

  const body = renderWhatsAppMessage("confirmation", params.language ?? "en", {
    patientName: params.patientName,
    clinicName: params.clinicName,
    dentistName: params.dentistName,
    appointmentDate: params.appointmentDate,
    appointmentTime: params.appointmentTime,
  });
  return sendTextMessage(config, params.phone, body);
}

export async function sendCancellationMessage(params: {
  patientName: string;
  phone: string;
  appointmentDate?: string | null;
  clinicName: string;
  reason?: string | null;
  language?: ResponseLanguage;
}): Promise<WhatsAppSendResult> {
  const config = getConfig();
  if (!config) return { success: false, error: NOT_CONFIGURED_ERROR };

  const body = renderWhatsAppMessage("cancellation", params.language ?? "en", {
    patientName: params.patientName,
    clinicName: params.clinicName,
    appointmentDate: params.appointmentDate,
    reason: params.reason,
  });
  return sendTextMessage(config, params.phone, body);
}

export async function sendRescheduleMessage(params: {
  patientName: string;
  phone: string;
  appointmentDate: string;
  appointmentTime: string;
  clinicName: string;
  language?: ResponseLanguage;
}): Promise<WhatsAppSendResult> {
  const config = getConfig();
  if (!config) return { success: false, error: NOT_CONFIGURED_ERROR };

  const body = renderWhatsAppMessage("reschedule", params.language ?? "en", {
    patientName: params.patientName,
    clinicName: params.clinicName,
    appointmentDate: params.appointmentDate,
    appointmentTime: params.appointmentTime,
  });
  return sendTextMessage(config, params.phone, body);
}

export async function sendCompletedThankYou(params: {
  patientName: string;
  phone: string;
  clinicName: string;
  dentistName?: string | null;
  reviewUrl?: string | null;
  language?: ResponseLanguage;
}): Promise<WhatsAppSendResult> {
  const config = getConfig();
  if (!config) return { success: false, error: NOT_CONFIGURED_ERROR };

  const body = renderWhatsAppMessage("completed", params.language ?? "en", {
    patientName: params.patientName,
    clinicName: params.clinicName,
    dentistName: params.dentistName,
    reviewUrl: params.reviewUrl,
  });
  return sendTextMessage(config, params.phone, body);
}

/** Free-form text, no template -- used by the dashboard's Custom Message action and the Settings page's Test Message button. */
export async function sendCustomMessage(phone: string, body: string): Promise<WhatsAppSendResult> {
  const config = getConfig();
  if (!config) return { success: false, error: NOT_CONFIGURED_ERROR };
  if (!body.trim()) return { success: false, error: "Message body is empty." };
  return sendTextMessage(config, phone, body);
}
