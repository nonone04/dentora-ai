-- ============================================================
-- Clinic profile fields + logo storage (single-page clinic creation).
--
-- The onboarding form now collects a clinic type, website, description,
-- and logo alongside the columns that already existed (name, phone,
-- email, address, timezone). New columns inherit clinics' existing RLS
-- policies (clinics_select / clinics_update), so no policy change is
-- needed there.
--
-- The logo is uploaded before the clinic row exists (chicken-and-egg:
-- there's no clinic id yet at upload time on the creation form), so
-- objects are keyed by the uploading user's id rather than the clinic
-- id: `{auth.uid()}/logo-<timestamp>.<ext>`. The bucket is public
-- (logos are shown in nav/headers across the app, not sensitive), so
-- reads never need a signed URL; writes are restricted to each user's
-- own folder.
-- ============================================================

alter table clinics add column clinic_type text;
alter table clinics add column website text;
alter table clinics add column description text;
alter table clinics add column logo_url text;

insert into storage.buckets (id, name, public)
values ('clinic-logos', 'clinic-logos', true)
on conflict (id) do nothing;

create policy clinic_logos_public_read on storage.objects
  for select using (bucket_id = 'clinic-logos');

create policy clinic_logos_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'clinic-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy clinic_logos_owner_update on storage.objects
  for update using (
    bucket_id = 'clinic-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy clinic_logos_owner_delete on storage.objects
  for delete using (
    bucket_id = 'clinic-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
