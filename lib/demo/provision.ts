import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_CLINIC, DEMO_DENTISTS, DEMO_OWNER, DEMO_PATIENTS, DEMO_SERVICES, buildDemoAppointments } from "@/lib/demo/fixtures";

export const DEMO_ACCOUNT_EMAIL = process.env.DEMO_ACCOUNT_EMAIL ?? "demo@dentora.ai";
export const DEMO_ACCOUNT_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD ?? "DentoraInteractiveDemo-2026";

type AdminClient = ReturnType<typeof createAdminClient>;

async function findDemoAuthUserId(admin: AdminClient): Promise<string | null> {
  // Small, fixed user set in this project -- a single page is always enough
  // to find the one demo account by email (no getUserByEmail in this SDK version).
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return null;
  return data.users.find((u) => u.email === DEMO_ACCOUNT_EMAIL)?.id ?? null;
}

async function ensureDemoAuthUser(admin: AdminClient): Promise<string> {
  const existingId = await findDemoAuthUserId(admin);
  if (existingId) return existingId;

  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_ACCOUNT_EMAIL,
    password: DEMO_ACCOUNT_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: DEMO_OWNER.fullName },
  });

  if (error || !data.user) {
    // Race with a concurrent provisioning call -- look it up instead of failing.
    const raceId = await findDemoAuthUserId(admin);
    if (raceId) return raceId;
    throw new Error(error?.message ?? "Failed to create demo account");
  }

  return data.user.id;
}

async function seedClinicData(admin: AdminClient, clinicId: string) {
  // Single multi-row inserts without ON CONFLICT return rows in the same
  // order they were given, so dentistIds[i]/serviceIds[i] line up
  // positionally with DEMO_DENTISTS[i]/DEMO_SERVICES[i] -- that's what lets
  // buildDemoAppointments() reference dentists/services by fixture index.
  const [{ data: dentists }, { data: services }] = await Promise.all([
    admin
      .from("dentists")
      .insert(
        DEMO_DENTISTS.map((d) => ({
          clinic_id: clinicId,
          full_name: d.fullName,
          specialty: d.specialty,
          license_number: d.licenseNumber,
          color: d.color,
        })),
      )
      .select("id"),
    admin
      .from("services")
      .insert(
        DEMO_SERVICES.map((s) => ({
          clinic_id: clinicId,
          name_translations: { fr: s.name, en: s.name },
          default_duration_minutes: s.durationMinutes,
          price: s.price,
          currency: "MAD",
        })),
      )
      .select("id"),
  ]);

  const { data: patients } = await admin
    .from("patients")
    .insert(
      DEMO_PATIENTS.map((p) => ({
        clinic_id: clinicId,
        full_name: p.fullName,
        phone: p.phone,
        email: p.email ?? null,
        gender: p.gender ?? null,
        preferred_language: p.preferredLanguage,
        notes: p.notes ?? null,
      })),
    )
    .select("id");

  const dentistIds = (dentists ?? []).map((d) => d.id);
  const serviceIds = (services ?? []).map((s) => s.id);
  const patientIds = (patients ?? []).map((p) => p.id);
  if (dentistIds.length === 0 || serviceIds.length === 0 || patientIds.length === 0) return;

  const appointments = buildDemoAppointments().map((draft) => ({
    clinic_id: clinicId,
    patient_id: patientIds[draft.patientIndex % patientIds.length],
    dentist_id: dentistIds[draft.dentistIndex % dentistIds.length],
    service_id: serviceIds[draft.serviceIndex % serviceIds.length],
    start_at: draft.startAt,
    end_at: draft.endAt,
    status: draft.status,
    source: "staff" as const,
  }));

  if (appointments.length > 0) {
    await admin.from("appointments").insert(appointments);
  }
}

/** Idempotent: returns the existing demo clinic id if already provisioned, otherwise creates + seeds it. */
export async function ensureDemoClinic(): Promise<string> {
  const admin = createAdminClient();

  const { data: existing } = await admin.from("clinics").select("id").eq("slug", DEMO_CLINIC.slug).maybeSingle();
  if (existing) return existing.id;

  const ownerId = await ensureDemoAuthUser(admin);

  await admin
    .from("profiles")
    .upsert({ id: ownerId, full_name: DEMO_OWNER.fullName, preferred_language: DEMO_OWNER.preferredLanguage });

  const { data: clinic, error: clinicError } = await admin
    .from("clinics")
    .insert({
      name: DEMO_CLINIC.name,
      slug: DEMO_CLINIC.slug,
      phone: DEMO_CLINIC.phone,
      whatsapp_number: DEMO_CLINIC.whatsappNumber,
      email: DEMO_CLINIC.email,
      address: DEMO_CLINIC.address,
      city: DEMO_CLINIC.city,
      timezone: DEMO_CLINIC.timezone,
      default_language: DEMO_CLINIC.defaultLanguage,
      is_demo: true,
    })
    .select("id")
    .single();

  if (clinicError || !clinic) throw new Error(clinicError?.message ?? "Failed to create demo clinic");

  await admin.from("clinic_members").insert({
    clinic_id: clinic.id,
    user_id: ownerId,
    role: "owner",
    is_active: true,
  });

  await seedClinicData(admin, clinic.id);

  return clinic.id;
}

/** Wipes and re-seeds the demo clinic's data. Guarded to is_demo clinics only, so it can never touch a real tenant. */
export async function resetDemoClinicData(clinicId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: clinic } = await admin.from("clinics").select("id, is_demo").eq("id", clinicId).maybeSingle();
  if (!clinic || !clinic.is_demo) {
    throw new Error("Not a demo clinic");
  }

  await admin.from("appointments").delete().eq("clinic_id", clinicId);
  await admin.from("patients").delete().eq("clinic_id", clinicId);
  await admin.from("dentists").delete().eq("clinic_id", clinicId);
  await admin.from("services").delete().eq("clinic_id", clinicId);

  await seedClinicData(admin, clinicId);
}
