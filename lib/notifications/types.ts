import type { ResponseLanguage } from "@/lib/ai/nlu/language";

export const NOTIFICATION_EVENT_TYPES = [
  "appointment_booked",
  "appointment_confirmed",
  "appointment_cancelled",
  "appointment_rescheduled",
  "appointment_reminder",
  "conversation_escalated",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export const NOTIFICATION_RECIPIENT_TYPES = ["patient", "staff"] as const;

export type NotificationRecipientType = (typeof NOTIFICATION_RECIPIENT_TYPES)[number];

/**
 * A separate, wider channel set than lib/notifications/provider.ts's
 * original NotificationChannel (email/sms/whatsapp) -- this pipeline
 * also supports in_app. provider.ts's NotificationChannel is widened to
 * match (see provider.ts) rather than kept as two unrelated types.
 */
export const NOTIFICATION_DELIVERY_CHANNELS = ["email", "sms", "whatsapp", "in_app"] as const;

export type NotificationDeliveryChannel = (typeof NOTIFICATION_DELIVERY_CHANNELS)[number];

export const NOTIFICATION_DELIVERY_STATUSES = ["pending", "sending", "sent", "delivered", "read", "failed"] as const;

export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export const TERMINAL_DELIVERY_STATUSES: ReadonlySet<NotificationDeliveryStatus> = new Set(["read", "failed"]);

/** One row of the immutable notification_events log. */
export type NotificationEvent = {
  id: string;
  clinicId: string;
  type: NotificationEventType;
  appointmentId: string | null;
  appointmentDraftId: string | null;
  patientId: string | null;
  conversationId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

/** One row of notification_deliveries -- a single message attempt/schedule, with retry state. */
export type NotificationDelivery = {
  id: string;
  clinicId: string;
  notificationEventId: string;
  recipientType: NotificationRecipientType;
  recipientPatientId: string | null;
  recipientAddress: string | null;
  channel: NotificationDeliveryChannel;
  templateKey: string;
  language: ResponseLanguage;
  status: NotificationDeliveryStatus;
  scheduledFor: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  /** Visibility axis for the in-app Notification Center -- orthogonal to `status`, set via store.ts's archiveDelivery(), never through the delivery-status FSM. */
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type NotificationDeliveryRow = {
  id: string;
  clinic_id: string;
  notification_event_id: string;
  recipient_type: NotificationRecipientType;
  recipient_patient_id: string | null;
  recipient_address: string | null;
  channel: NotificationDeliveryChannel;
  template_key: string;
  language: string;
  status: NotificationDeliveryStatus;
  scheduled_for: string;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  archived_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export function parseNotificationDeliveryRow(row: NotificationDeliveryRow): NotificationDelivery {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    notificationEventId: row.notification_event_id,
    recipientType: row.recipient_type,
    recipientPatientId: row.recipient_patient_id,
    recipientAddress: row.recipient_address,
    channel: row.channel,
    templateKey: row.template_key,
    language: (row.language as ResponseLanguage) ?? "en",
    status: row.status,
    scheduledFor: row.scheduled_for,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    archivedAt: row.archived_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
