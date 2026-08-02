import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadNotificationContext } from "@/lib/notifications/context";

type Row = Record<string, unknown>;

function makeStaticTable(byId: Record<string, Row>) {
  function builder() {
    const eqFilters: Record<string, unknown> = {};
    const b = {
      select() {
        return b;
      },
      eq(column: string, value: unknown) {
        eqFilters[column] = value;
        return b;
      },
      maybeSingle() {
        const id = eqFilters.id as string | undefined;
        const row = id ? byId[id] : undefined;
        return Promise.resolve({ data: row ?? null, error: null });
      },
    };
    return b;
  }
  return { builder };
}

const CLINIC: Row = {
  id: "clinic-1",
  name: "Dentora Clinic",
  email: "clinic@example.com",
  timezone: "UTC",
  default_language: "fr",
  settings: { notifications: { reminderHoursBefore: 12, sendConfirmations: true } },
};

const PATIENT: Row = {
  id: "patient-1",
  full_name: "Amina",
  email: "amina@example.com",
  phone: "+212600000000",
  preferred_language: "ar",
  preferred_contact_channel: "whatsapp",
  reminder_opt_in: true,
};

const APPOINTMENT: Row = {
  id: "appt-1",
  patient_id: "patient-1",
  start_at: "2026-08-10T09:00:00.000Z",
  end_at: "2026-08-10T09:30:00.000Z",
  dentist_id: "dentist-1",
  service_id: "service-1",
};

const DENTIST: Row = { full_name: "Dr. Bennani" };
const SERVICE: Row = { name_translations: { en: "Cleaning", fr: "Nettoyage", ar: "تنظيف" } };

function makeFakeSupabase(overrides: Partial<Record<string, Record<string, Row>>> = {}) {
  const tables: Record<string, Record<string, Row>> = {
    clinics: { "clinic-1": CLINIC },
    patients: { "patient-1": PATIENT },
    appointments: { "appt-1": APPOINTMENT },
    dentists: { "dentist-1": DENTIST },
    services: { "service-1": SERVICE },
    appointment_drafts: {},
    ...overrides,
  };

  return {
    from: (table: string) => makeStaticTable(tables[table] ?? {}).builder(),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("loadNotificationContext", () => {
  it("resolves clinic, patient, and appointment (with dentist/service names) together", async () => {
    const supabase = makeFakeSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = await loadNotificationContext(supabase as any, { clinicId: "clinic-1", appointmentId: "appt-1" });

    expect(context).toMatchObject({
      clinicName: "Dentora Clinic",
      clinicEmail: "clinic@example.com",
      timezone: "UTC",
      defaultLanguage: "fr",
      reminderHoursBefore: 12,
      sendConfirmations: true,
      patient: {
        id: "patient-1",
        name: "Amina",
        preferredLanguage: "ar",
        preferredContactChannel: "whatsapp",
        reminderOptIn: true,
      },
      appointment: {
        id: "appt-1",
        dentistName: "Dr. Bennani",
        serviceName: "Nettoyage", // clinic default_language is fr -- picked from name_translations.fr
      },
    });
  });

  it("defaults secondaryReminderHoursBefore to 2h and googleReviewUrl to null when unset", async () => {
    const supabase = makeFakeSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = await loadNotificationContext(supabase as any, { clinicId: "clinic-1", appointmentId: "appt-1" });
    expect(context).toMatchObject({ secondaryReminderHoursBefore: 2, googleReviewUrl: null });
  });

  it("honors an explicit secondaryReminderHoursBefore: null opt-out and a configured googleReviewUrl", async () => {
    const supabase = makeFakeSupabase({
      clinics: {
        "clinic-1": {
          ...CLINIC,
          settings: { notifications: { secondaryReminderHoursBefore: null, googleReviewUrl: "https://g.page/r/example/review" } },
        },
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = await loadNotificationContext(supabase as any, { clinicId: "clinic-1", appointmentId: "appt-1" });
    expect(context).toMatchObject({ secondaryReminderHoursBefore: null, googleReviewUrl: "https://g.page/r/example/review" });
  });

  it("returns null when the clinic itself can't be found", async () => {
    const supabase = makeFakeSupabase({ clinics: {} });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await loadNotificationContext(supabase as any, { clinicId: "clinic-1" })).toBeNull();
  });

  it("falls back to a draft's free-text patient_name/patient_phone when there's no registered patient", async () => {
    const supabase = makeFakeSupabase({
      appointments: {},
      appointment_drafts: {
        "draft-1": {
          id: "draft-1",
          patient_id: null,
          patient_name: "Yasmine",
          patient_phone: "+212611111111",
          proposed_start_at: "2026-08-11T10:00:00.000Z",
          proposed_end_at: "2026-08-11T10:30:00.000Z",
          dentist_id: "dentist-1",
          service_id: "service-1",
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = await loadNotificationContext(supabase as any, { clinicId: "clinic-1", appointmentDraftId: "draft-1" });

    expect(context?.patient).toMatchObject({ id: "", name: "Yasmine", phone: "+212611111111", preferredContactChannel: "email" });
    expect(context?.appointment).toMatchObject({ id: "draft-1", dentistName: "Dr. Bennani" });
  });

  it("degrades gracefully (null fields, not a thrown error) when a secondary lookup fails", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "clinics") return makeStaticTable({ "clinic-1": CLINIC }).builder();
        if (table === "appointments") return makeStaticTable({ "appt-1": APPOINTMENT }).builder();
        if (table === "dentists")
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.reject(new Error("boom")) }) }) }),
          };
        return makeStaticTable({}).builder();
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = await loadNotificationContext(supabase as any, { clinicId: "clinic-1", appointmentId: "appt-1" });
    expect(context?.appointment?.dentistName).toBeNull();
  });

  it("has no patient context when neither an appointment/draft nor an explicit patientId resolves one", async () => {
    const supabase = makeFakeSupabase({ appointments: {}, appointment_drafts: {} });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = await loadNotificationContext(supabase as any, { clinicId: "clinic-1" });
    expect(context?.patient).toBeNull();
    expect(context?.appointment).toBeNull();
  });
});
