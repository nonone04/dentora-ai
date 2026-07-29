-- ============================================================
-- In-app Notification Center: "archive" support.
--
-- Purely additive: a nullable archived_at column on the existing
-- notification_deliveries table. Archived-vs-not is a visibility axis
-- orthogonal to delivery status (pending/sending/sent/delivered/read/
-- failed) -- it's mutated directly by lib/notifications/store.ts's
-- archiveDelivery(), bypassing the delivery-status FSM in machine.ts,
-- rather than added as a new status value. One-directional (no
-- unarchive), matching the existing one-directional mark-read design.
--
-- No RLS change needed: the existing notification_deliveries_update
-- policy (clinic_id in (select auth_user_clinic_ids())) has no `with
-- check` column restriction, so it already covers writes to this column.
-- ============================================================

alter table notification_deliveries add column archived_at timestamptz;

create index notification_deliveries_archived_idx on notification_deliveries (clinic_id, archived_at);
