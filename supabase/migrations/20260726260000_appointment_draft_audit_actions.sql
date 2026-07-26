-- ============================================================
-- Extends the existing audit_action enum (Phase 10) with two values
-- for the draft review workflow. No table, no policy, no AI
-- permission is touched -- purely additive to the audit vocabulary.
-- ============================================================

alter type audit_action add value 'appointment_draft_approved';
alter type audit_action add value 'appointment_draft_rejected';
