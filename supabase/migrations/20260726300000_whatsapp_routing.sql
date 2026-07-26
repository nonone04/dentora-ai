-- ============================================================
-- WhatsApp inbound routing (Phase 15).
--
-- clinics.whatsapp_number (init migration) is a free-text display
-- number shown to patients via the get_clinic_info tool -- not a
-- reliable routing key (formatting varies, not guaranteed unique).
-- whatsapp_phone_number_id stores the Meta Cloud API phone_number_id
-- instead: a stable Graph API identifier the webhook payload always
-- carries, safe to exact-match against. No RLS change -- it's a new
-- column on an existing table, inheriting clinics' existing policies.
-- ============================================================

alter table clinics add column whatsapp_phone_number_id text;

create unique index clinics_whatsapp_phone_number_id_idx
  on clinics (whatsapp_phone_number_id)
  where whatsapp_phone_number_id is not null;
