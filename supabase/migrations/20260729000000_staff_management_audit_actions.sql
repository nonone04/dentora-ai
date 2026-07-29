-- ============================================================
-- Extends the existing audit_action enum (Phase 10, further extended
-- for the draft review workflow) with seven values for the Staff
-- Management module: role changes, suspension/reactivation, removal,
-- ownership transfer, and API key issuance/revocation. No table, no
-- policy, no existing permission is touched -- purely additive to the
-- audit vocabulary, same as 20260726260000_appointment_draft_audit_actions.sql.
-- ============================================================

alter type audit_action add value 'member_role_changed';
alter type audit_action add value 'member_suspended';
alter type audit_action add value 'member_reactivated';
alter type audit_action add value 'member_removed';
alter type audit_action add value 'ownership_transferred';
alter type audit_action add value 'api_key_created';
alter type audit_action add value 'api_key_revoked';
