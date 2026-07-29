export { loadNotificationContext } from "@/lib/notifications/context";
export type { NotificationContext, NotificationContextAppointment, NotificationContextPatient } from "@/lib/notifications/context";
export { processDueNotificationDeliveries, sendDelivery } from "@/lib/notifications/dispatch";
export type { ProcessDeliveriesResult, SendDeliveryResult } from "@/lib/notifications/dispatch";
export {
  createNotificationEvent,
  notifyAppointmentBooked,
  notifyAppointmentCancelled,
  notifyAppointmentConfirmed,
  notifyAppointmentRescheduled,
  notifyEscalation,
} from "@/lib/notifications/engine";
export type { CreateNotificationEventOutcome, CreateNotificationEventParams } from "@/lib/notifications/engine";
export { recordNotificationEvent } from "@/lib/notifications/events";
export type { RecordNotificationEventParams } from "@/lib/notifications/events";
export { DELIVERY_EVENTS, isTerminalDeliveryStatus, transitionDelivery } from "@/lib/notifications/machine";
export type { DeliveryEvent, DeliveryTransitionResult } from "@/lib/notifications/machine";
export { getNotificationProvider } from "@/lib/notifications/provider";
export type { NotificationChannel, NotificationMessage, NotificationProvider, NotificationResult } from "@/lib/notifications/provider";
export { computeBackoffMinutes, computeNextAttemptAt, DEFAULT_MAX_ATTEMPTS, shouldRetry } from "@/lib/notifications/retry";
export { DEFAULT_REMINDER_HOURS_BEFORE, getClinicNotificationSettings } from "@/lib/notifications/settings";
export type { ClinicNotificationSettings } from "@/lib/notifications/settings";
export {
  applyDeliveryEvent,
  createDelivery,
  listDueDeliveries,
  loadDelivery,
  skipPendingDeliveriesForAppointment,
} from "@/lib/notifications/store";
export type { ApplyDeliveryEventOutcome, CreateDeliveryParams } from "@/lib/notifications/store";
export { formatAppointmentDateTime, renderNotificationTemplate, templateKeyFor } from "@/lib/notifications/templates";
export type { RenderedTemplate, TemplateData } from "@/lib/notifications/templates";
export {
  NOTIFICATION_DELIVERY_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_RECIPIENT_TYPES,
  parseNotificationDeliveryRow,
  TERMINAL_DELIVERY_STATUSES,
} from "@/lib/notifications/types";
export type {
  NotificationDelivery,
  NotificationDeliveryChannel,
  NotificationDeliveryRow,
  NotificationDeliveryStatus,
  NotificationEvent,
  NotificationEventType,
  NotificationRecipientType,
} from "@/lib/notifications/types";
