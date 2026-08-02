-- ============================================================
-- Stores the outbound provider's own message id (e.g. Meta WhatsApp
-- Cloud API's `messages[0].id`, a "wamid...." string) on the delivery
-- row that produced it. Needed so an inbound webhook status callback
-- (delivered/read/failed) can be matched back to the exact
-- notification_deliveries row it's reporting on -- see
-- lib/whatsapp/webhook.ts's status-callback handler and
-- lib/notifications/machine.ts's mark_delivered/mark_read/mark_failed
-- events, previously unreachable for lack of this id. Nullable: most
-- channels (email, in_app) never populate it and keep resting at
-- status 'sent'.
-- ============================================================

alter table notification_deliveries add column provider_message_id text;

create index notification_deliveries_provider_message_id_idx
  on notification_deliveries (provider_message_id)
  where provider_message_id is not null;
