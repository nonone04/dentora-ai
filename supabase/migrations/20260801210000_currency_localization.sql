-- ============================================================
-- International currency & localization: adds the clinic-level fields
-- needed to drive Business Settings (onboarding) and Regional Settings
-- (dashboard). `default_language` and `timezone` already exist and are
-- reused as-is -- this migration only adds the columns that were missing.
--
-- `currency` is validated against lib/currency's CURRENCY_CODES in app
-- code (not a DB check constraint) so adding a 13th currency never
-- requires a migration. `country` is a plain ISO 3166-1 alpha-2 string,
-- also app-validated against lib/currency/country-map.ts.
--
-- services.currency (added in the init migration) is unaffected: a
-- service can still be quoted in a different currency than its clinic;
-- app code falls back to clinics.currency wherever a more specific
-- currency isn't available (see lib/dashboard/trends.ts).
-- ============================================================

alter table clinics add column country text;
alter table clinics add column currency text not null default 'MAD';
alter table clinics add column date_format text not null default 'DD/MM/YYYY';
alter table clinics add column number_format text not null default 'fr-FR';
