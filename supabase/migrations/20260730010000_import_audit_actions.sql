-- Audit trail coverage for the CSV import wizard, matching the existing
-- one-migration-per-batch-of-audit-actions convention.
alter type audit_action add value 'patients_imported';
alter type audit_action add value 'dentists_imported';
alter type audit_action add value 'services_imported';
