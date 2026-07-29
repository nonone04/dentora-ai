import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { loadNotificationContext, type NotificationContext, type NotificationContextPatient } from "@/lib/notifications/context";
import { sendDelivery } from "@/lib/notifications/dispatch";
import { recordNotificationEvent } from "@/lib/notifications/events";
import { createDelivery, skipPendingDeliveriesForAppointment } from "@/lib/notifications/store";
import { templateKeyFor } from "@/lib/notifications/templates";
import type { NotificationDeliveryChannel, NotificationEvent, NotificationEventType, NotificationRecipientType } from "@/lib/notifications/types";

export type CreateNotificationEventParams = {
  clinicId: string;
  type: NotificationEventType;
  appointmentId?: string | null;
  appointmentDraftId?: string | null;
  patientId?: string | null;
  conversationId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  /** ISO datetime; defaults to now. A future value (e.g. a reminder) is left pending for the cron dispatcher instead of sent immediately. */
  scheduledFor?: string;
};

export type CreateNotificationEventOutcome = { event: NotificationEvent; deliveriesCreated: number };

const STAFF_CHANNELS: NotificationDeliveryChannel[] = ["email", "in_app"];
const STAFF_EVENT_TYPES = new Set<NotificationEventType>(["appointment_booked", "conversation_escalated"]);

type DeliveryPlan = {
  recipientType: NotificationRecipientType;
  recipientPatientId: string | null;
  recipientAddress: string | null;
  channel: NotificationDeliveryChannel;
  language: ResponseLanguage;
};

function resolvePatientAddress(channel: NotificationDeliveryChannel, patient: NotificationContextPatient): string | null {
  if (channel === "email") return patient.email;
  if (channel === "whatsapp" || channel === "sms") return patient.phone;
  return "in_app";
}

/** Whether a channel is currently allowed at all, per the clinic's channel preferences (lib/notifications/settings.ts) -- whatsapp/sms have no kill switch today. */
function isChannelEnabled(channel: NotificationDeliveryChannel, context: NotificationContext): boolean {
  if (channel === "email") return context.emailChannelEnabled;
  if (channel === "in_app") return context.inAppChannelEnabled;
  return true;
}

/**
 * Determines who gets notified for a given event type, given the
 * resolved clinic/patient/appointment context -- one audience per event
 * (staff for booked/escalated, the patient for everything else), on
 * every channel that applies (staff: email + in_app; patient: their own
 * single preferred_contact_channel). Pure given a resolved context.
 */
function buildDeliveryPlans(type: NotificationEventType, context: NotificationContext): DeliveryPlan[] {
  if (STAFF_EVENT_TYPES.has(type)) {
    if (!context.clinicEmail) return [];
    if (type === "conversation_escalated" && !context.aiSummariesEnabled) return [];
    return STAFF_CHANNELS.filter((channel) => isChannelEnabled(channel, context)).map((channel) => ({
      recipientType: "staff" as const,
      recipientPatientId: null,
      recipientAddress: channel === "email" ? context.clinicEmail : "in_app",
      channel,
      language: context.defaultLanguage,
    }));
  }

  if (!context.patient) return [];
  if (type === "appointment_confirmed" && !context.sendConfirmations) return [];
  if (type === "appointment_reminder" && (!context.patient.reminderOptIn || !context.appointmentRemindersEnabled)) return [];

  const channel = context.patient.preferredContactChannel as NotificationDeliveryChannel;
  if (!isChannelEnabled(channel, context)) return [];

  return [
    {
      recipientType: "patient",
      recipientPatientId: context.patient.id || null,
      recipientAddress: resolvePatientAddress(channel, context.patient),
      channel,
      language: context.patient.preferredLanguage,
    },
  ];
}

/**
 * Top-level, hook-facing entry point: records the immutable event, then
 * fans out one or more notification_deliveries rows for it, and
 * immediately dispatches every delivery that isn't scheduled for the
 * future. Never throws -- every failure mode (missing context, missing
 * contact address, provider failure) degrades to a delivery recorded as
 * failed/retry-pending rather than an exception, so every caller
 * (Appointment Lifecycle Engine hooks, AI tools) can always treat this
 * as best-effort, exactly like the Patient Intelligence/Knowledge Engine
 * hooks elsewhere in lib/ai.
 */
export async function createNotificationEvent(
  supabase: SupabaseClient,
  params: CreateNotificationEventParams,
): Promise<CreateNotificationEventOutcome | null> {
  try {
    const event = await recordNotificationEvent(supabase, {
      clinicId: params.clinicId,
      type: params.type,
      appointmentId: params.appointmentId,
      appointmentDraftId: params.appointmentDraftId,
      patientId: params.patientId,
      conversationId: params.conversationId,
      metadata: { ...(params.metadata ?? {}), ...(params.reason ? { reason: params.reason } : {}) },
    });
    if (!event) return null;

    if ((params.type === "appointment_cancelled" || params.type === "appointment_rescheduled") && params.appointmentId) {
      await skipPendingDeliveriesForAppointment(supabase, {
        clinicId: params.clinicId,
        appointmentId: params.appointmentId,
        reason: params.type === "appointment_cancelled" ? "Appointment was cancelled." : "Appointment was rescheduled.",
      });
    }

    const context = await loadNotificationContext(supabase, {
      clinicId: params.clinicId,
      appointmentId: params.appointmentId,
      appointmentDraftId: params.appointmentDraftId,
      patientId: params.patientId,
    });
    if (!context) return { event, deliveriesCreated: 0 };

    const scheduledFor = params.scheduledFor ?? new Date().toISOString();
    const plans = buildDeliveryPlans(params.type, context);

    let deliveriesCreated = 0;
    for (const plan of plans) {
      const delivery = await createDelivery(supabase, {
        clinicId: params.clinicId,
        notificationEventId: event.id,
        recipientType: plan.recipientType,
        recipientPatientId: plan.recipientPatientId,
        recipientAddress: plan.recipientAddress,
        channel: plan.channel,
        templateKey: templateKeyFor(params.type, plan.channel),
        language: plan.language,
        scheduledFor,
      });
      if (!delivery) continue;
      deliveriesCreated += 1;

      if (delivery.scheduledFor <= new Date().toISOString()) {
        try {
          await sendDelivery(supabase, delivery);
        } catch (err) {
          console.error("[notifications] immediate dispatch failed", err instanceof Error ? err.message : err);
        }
      }
    }

    return { event, deliveriesCreated };
  } catch (err) {
    console.error("[notifications] createNotificationEvent failed", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Computes when a reminder should fire for an appointment starting at `startAtIso`, or null if that time has already passed. */
function computeReminderScheduledFor(startAtIso: string, reminderHoursBefore: number): string | null {
  const scheduledFor = new Date(new Date(startAtIso).getTime() - reminderHoursBefore * 60 * 60 * 1000);
  return scheduledFor.getTime() > Date.now() ? scheduledFor.toISOString() : null;
}

/** Staff notification that the AI created a new draft awaiting review -- no equivalent in the old notifications table/schedule.ts, which only ever notified patients. */
export async function notifyAppointmentBooked(
  supabase: SupabaseClient,
  params: { clinicId: string; appointmentDraftId: string; conversationId?: string | null },
): Promise<void> {
  await createNotificationEvent(supabase, {
    clinicId: params.clinicId,
    type: "appointment_booked",
    appointmentDraftId: params.appointmentDraftId,
    conversationId: params.conversationId,
  });
}

/** Patient confirmation, plus (if opted in and the appointment is still ahead) a reminder scheduled for later -- two independent events, since each carries its own template. */
export async function notifyAppointmentConfirmed(
  supabase: SupabaseClient,
  params: { clinicId: string; appointmentId: string; patientId?: string | null; conversationId?: string | null },
): Promise<void> {
  await createNotificationEvent(supabase, {
    clinicId: params.clinicId,
    type: "appointment_confirmed",
    appointmentId: params.appointmentId,
    patientId: params.patientId,
    conversationId: params.conversationId,
  });

  const context = await loadNotificationContext(supabase, { clinicId: params.clinicId, appointmentId: params.appointmentId });
  const startAt = context?.appointment?.startAt;
  if (!context || !startAt) return;

  const reminderAt = computeReminderScheduledFor(startAt, context.reminderHoursBefore);
  if (!reminderAt) return;

  await createNotificationEvent(supabase, {
    clinicId: params.clinicId,
    type: "appointment_reminder",
    appointmentId: params.appointmentId,
    patientId: params.patientId,
    conversationId: params.conversationId,
    scheduledFor: reminderAt,
  });
}

export async function notifyAppointmentCancelled(
  supabase: SupabaseClient,
  params: { clinicId: string; appointmentId: string; patientId?: string | null; conversationId?: string | null; reason?: string | null },
): Promise<void> {
  await createNotificationEvent(supabase, {
    clinicId: params.clinicId,
    type: "appointment_cancelled",
    appointmentId: params.appointmentId,
    patientId: params.patientId,
    conversationId: params.conversationId,
    reason: params.reason,
  });
}

/** Rescheduled notice, plus a fresh reminder scheduled against the new time (the stale one for the old time is skipped by createNotificationEvent above). */
export async function notifyAppointmentRescheduled(
  supabase: SupabaseClient,
  params: { clinicId: string; appointmentId: string; patientId?: string | null; conversationId?: string | null },
): Promise<void> {
  await createNotificationEvent(supabase, {
    clinicId: params.clinicId,
    type: "appointment_rescheduled",
    appointmentId: params.appointmentId,
    patientId: params.patientId,
    conversationId: params.conversationId,
  });

  const context = await loadNotificationContext(supabase, { clinicId: params.clinicId, appointmentId: params.appointmentId });
  const startAt = context?.appointment?.startAt;
  if (!context || !startAt) return;

  const reminderAt = computeReminderScheduledFor(startAt, context.reminderHoursBefore);
  if (!reminderAt) return;

  await createNotificationEvent(supabase, {
    clinicId: params.clinicId,
    type: "appointment_reminder",
    appointmentId: params.appointmentId,
    patientId: params.patientId,
    conversationId: params.conversationId,
    scheduledFor: reminderAt,
  });
}

export async function notifyEscalation(
  supabase: SupabaseClient,
  params: { clinicId: string; conversationId?: string | null; reason: string },
): Promise<void> {
  await createNotificationEvent(supabase, {
    clinicId: params.clinicId,
    type: "conversation_escalated",
    conversationId: params.conversationId,
    reason: params.reason,
  });
}
