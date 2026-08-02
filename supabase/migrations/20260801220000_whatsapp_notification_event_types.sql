-- ============================================================
-- WhatsApp integration: two new notification_event_type values.
--
-- appointment_completed: post-visit thank-you + Google review request,
-- fired from lib/ai/appointments/store.ts's applyNotificationHook on the
-- "complete" lifecycle transition (previously a no-op there).
-- custom_message: a free-form WhatsApp message staff compose from the
-- Appointment Details dashboard panel -- not tied to any lifecycle
-- transition, but routed through the same notification_events/
-- notification_deliveries pipeline as every other event type so it gets
-- the same retry/status tracking and shows up in Communication History.
--
-- Same pattern as 20260730020000_whatsapp_audit_actions.sql (two ADD
-- VALUEs for the same enum in one migration).
-- ============================================================

alter type notification_event_type add value 'appointment_completed';
alter type notification_event_type add value 'custom_message';
