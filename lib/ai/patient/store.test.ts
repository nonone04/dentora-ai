import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPatientProfile, refreshPatientProfile } from "@/lib/ai/patient/store";

type Row = Record<string, unknown>;

function makeFilterableBuilder(rows: Row[]) {
  let filtered = [...rows];
  const b = {
    select() {
      return b;
    },
    eq(column: string, value: unknown) {
      filtered = filtered.filter((row) => row[column] === value);
      return b;
    },
    order() {
      filtered = [...filtered].sort((a, b2) => ((a.created_at as string) < (b2.created_at as string) ? 1 : -1));
      return b;
    },
    limit(n: number) {
      filtered = filtered.slice(0, n);
      return b;
    },
    maybeSingle() {
      return Promise.resolve({ data: filtered[0] ?? null, error: null });
    },
    then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
      return Promise.resolve({ data: filtered, error: null }).then(onFulfilled, onRejected);
    },
  };
  return b;
}

function makeRejectingBuilder(errorMessage: string) {
  const b = {
    select() {
      return b;
    },
    eq() {
      return b;
    },
    order() {
      return b;
    },
    limit() {
      return b;
    },
    maybeSingle() {
      return Promise.reject(new Error(errorMessage));
    },
    then(_onFulfilled: unknown, onRejected?: (r: unknown) => unknown) {
      return Promise.reject(new Error(errorMessage)).catch(onRejected);
    },
  };
  return b;
}

/** Real insert/CAS-update in-memory patient_profiles table -- same interceptor pattern used across every other engine's store.test.ts this session. */
function makeProfilesTable() {
  const rows = new Map<string, Row>();
  let updateInterceptor: ((row: Row) => Row) | null = null;
  let interceptorPersistent = false;
  let insertAttempts = 0;
  let updateAttempts = 0;

  function key(clinicId: unknown, patientId: unknown) {
    return `${clinicId}:${patientId}`;
  }

  function builder() {
    let mode: "select" | "insert" | "update" | null = null;
    let insertPayload: Row | null = null;
    let updatePayload: Record<string, unknown> | null = null;
    const eqFilters: Record<string, unknown> = {};

    const b = {
      select() {
        if (mode === null) mode = "select";
        return b;
      },
      insert(payload: Row) {
        mode = "insert";
        insertPayload = payload;
        return b;
      },
      update(payload: Record<string, unknown>) {
        mode = "update";
        updatePayload = payload;
        return b;
      },
      eq(column: string, value: unknown) {
        eqFilters[column] = value;
        return b;
      },
      maybeSingle() {
        return execute();
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
        return execute().then(onFulfilled, onRejected);
      },
    };

    function execute(): Promise<{ data: unknown; error: unknown }> {
      const rowKey = key(eqFilters.clinic_id, eqFilters.patient_id);

      if (mode === "insert" && insertPayload) {
        insertAttempts += 1;
        const insertKey = key(insertPayload.clinic_id, insertPayload.patient_id);
        if (rows.has(insertKey)) return Promise.resolve({ data: null, error: { message: "duplicate key" } });
        rows.set(insertKey, { ...insertPayload });
        return Promise.resolve({ data: rows.get(insertKey), error: null });
      }

      if (mode === "update" && updatePayload) {
        updateAttempts += 1;
        let existing = rows.get(rowKey);
        if (updateInterceptor && existing) {
          existing = updateInterceptor(existing);
          rows.set(rowKey, existing);
          if (!interceptorPersistent) updateInterceptor = null;
        }
        if (!existing || existing.version !== eqFilters.version) return Promise.resolve({ data: null, error: null });
        const updated = { ...existing, ...updatePayload };
        rows.set(rowKey, updated);
        return Promise.resolve({ data: updated, error: null });
      }

      // select
      const existing = rows.get(rowKey);
      return Promise.resolve({ data: existing ?? null, error: null });
    }

    return b;
  }

  return {
    rows,
    builder,
    get insertAttempts() {
      return insertAttempts;
    },
    get updateAttempts() {
      return updateAttempts;
    },
    interceptNextUpdate(fn: (row: Row) => Row) {
      updateInterceptor = fn;
      interceptorPersistent = false;
    },
    interceptEveryUpdate(fn: (row: Row) => Row) {
      updateInterceptor = fn;
      interceptorPersistent = true;
    },
  };
}

const NOW = "2026-08-10T09:00:00Z";

function makeFakeSupabase(params: {
  patient?: Row;
  appointments?: Row[];
  conversations?: Row[];
  activity?: Row[];
  failAppointments?: boolean;
  failConversations?: boolean;
  profilesTable?: ReturnType<typeof makeProfilesTable>;
}) {
  const profilesTable = params.profilesTable ?? makeProfilesTable();

  const client = {
    from(table: string) {
      if (table === "patients") return makeFilterableBuilder(params.patient ? [params.patient] : []);
      if (table === "appointments") {
        if (params.failAppointments) return makeRejectingBuilder("appointments query failed");
        return makeFilterableBuilder(params.appointments ?? []);
      }
      if (table === "ai_conversations") {
        if (params.failConversations) return makeRejectingBuilder("ai_conversations query failed");
        return makeFilterableBuilder(params.conversations ?? []);
      }
      if (table === "patient_activity_events") return makeFilterableBuilder(params.activity ?? []);
      if (table === "patient_profiles") return profilesTable.builder();
      throw new Error(`unexpected table: ${table}`);
    },
  };

  return { client, profilesTable };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("loadPatientProfile", () => {
  it("returns null when no profile has been computed yet", async () => {
    const fake = makeFakeSupabase({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await loadPatientProfile(fake.client as any, { clinicId: "clinic-1", patientId: "patient-1" });
    expect(result).toBeNull();
  });

  it("returns the parsed profile when one exists", async () => {
    const fake = makeFakeSupabase({});
    fake.profilesTable.rows.set("clinic-1:patient-1", {
      clinic_id: "clinic-1",
      patient_id: "patient-1",
      reliability_score: 0.8,
      reliability_label: "good",
      completed_count: 4,
      no_show_count: 1,
      cancelled_count: 0,
      preferred_channel: "whatsapp",
      channel_sample_size: 2,
      preferred_time_of_day: "morning",
      preferred_dentist_id: "dentist-1",
      summary: "Sara has 5 past appointments.",
      summary_source: "rule_based",
      version: 3,
      last_computed_at: NOW,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await loadPatientProfile(fake.client as any, { clinicId: "clinic-1", patientId: "patient-1" });
    expect(result?.reliability.label).toBe("good");
    expect(result?.version).toBe(3);
  });

  it("recovers with null rather than throwing when the query itself fails", async () => {
    const fake = { client: { from: () => makeRejectingBuilder("connection reset") } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(loadPatientProfile(fake.client as any, { clinicId: "clinic-1", patientId: "patient-1" })).resolves.toBeNull();
  });
});

describe("refreshPatientProfile: computing the profile", () => {
  it("computes reliability, preferences, and a rule-based summary from real data", async () => {
    const fake = makeFakeSupabase({
      patient: { id: "patient-1", clinic_id: "clinic-1", full_name: "Sara Idrissi" },
      appointments: [
        { clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "dentist-1", status: "completed", start_at: "2026-07-01T09:00:00Z" },
        { clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "dentist-1", status: "completed", start_at: "2026-07-08T09:30:00Z" },
        { clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "dentist-1", status: "no_show", start_at: "2026-07-15T09:00:00Z" },
      ],
      conversations: [
        { clinic_id: "clinic-1", patient_id: "patient-1", channel: "whatsapp" },
        { clinic_id: "clinic-1", patient_id: "patient-1", channel: "whatsapp" },
      ],
      activity: [{ clinic_id: "clinic-1", patient_id: "patient-1", type: "appointment_completed", created_at: NOW }],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = await refreshPatientProfile(fake.client as any, { clinicId: "clinic-1", patientId: "patient-1" });

    expect(profile.reliability).toMatchObject({ completedCount: 2, noShowCount: 1, cancelledCount: 0, sampleSize: 3 });
    expect(profile.communication).toEqual({ preferredChannel: "whatsapp", sampleSize: 2 });
    expect(profile.scheduling.preferredTimeOfDay).toBe("morning");
    expect(profile.scheduling.preferredDentistId).toBe("dentist-1");
    expect(profile.summarySource).toBe("rule_based");
    expect(profile.summary).toContain("Sara Idrissi");
    expect(profile.summary).toContain("3 past appointments");
  });

  it("handles a patient with no history gracefully", async () => {
    const fake = makeFakeSupabase({ patient: { id: "patient-1", clinic_id: "clinic-1", full_name: "New Patient" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = await refreshPatientProfile(fake.client as any, { clinicId: "clinic-1", patientId: "patient-1" });

    expect(profile.reliability).toMatchObject({ sampleSize: 0, label: "insufficient_data" });
    expect(profile.summary).toContain("no appointment history yet");
  });
});

describe("refreshPatientProfile: persistence", () => {
  it("inserts a brand-new profile on the first refresh", async () => {
    const fake = makeFakeSupabase({ patient: { id: "patient-1", clinic_id: "clinic-1", full_name: "Sara Idrissi" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = await refreshPatientProfile(fake.client as any, { clinicId: "clinic-1", patientId: "patient-1" });

    expect(profile.version).toBe(1);
    expect(fake.profilesTable.rows.get("clinic-1:patient-1")?.version).toBe(1);
  });

  it("bumps the version on each subsequent refresh", async () => {
    const profilesTable = makeProfilesTable();
    const fake1 = makeFakeSupabase({ patient: { id: "patient-1", clinic_id: "clinic-1", full_name: "Sara Idrissi" }, profilesTable });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await refreshPatientProfile(fake1.client as any, { clinicId: "clinic-1", patientId: "patient-1" });

    const fake2 = makeFakeSupabase({
      patient: { id: "patient-1", clinic_id: "clinic-1", full_name: "Sara Idrissi" },
      appointments: [{ clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "d1", status: "completed", start_at: "2026-07-01T09:00:00Z" }],
      profilesTable,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const second = await refreshPatientProfile(fake2.client as any, { clinicId: "clinic-1", patientId: "patient-1" });

    expect(second.version).toBe(2);
    expect(second.reliability.completedCount).toBe(1);
  });
});

describe("refreshPatientProfile: concurrent updates", () => {
  it("retries and succeeds when a concurrent refresh wrote first", async () => {
    const profilesTable = makeProfilesTable();
    const seedFake = makeFakeSupabase({ patient: { id: "patient-1", clinic_id: "clinic-1", full_name: "Sara Idrissi" }, profilesTable });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await refreshPatientProfile(seedFake.client as any, { clinicId: "clinic-1", patientId: "patient-1" });
    // version is now 1.

    profilesTable.interceptNextUpdate((row) => ({ ...row, version: (row.version as number) + 1 }));

    const fake = makeFakeSupabase({ patient: { id: "patient-1", clinic_id: "clinic-1", full_name: "Sara Idrissi" }, profilesTable });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await refreshPatientProfile(fake.client as any, { clinicId: "clinic-1", patientId: "patient-1" });

    expect(result.version).toBe(3); // our own write landed as version 3, after the concurrent writer's version 2
    expect(profilesTable.updateAttempts).toBe(2);
  });

  it("gives up after bounded retries and returns an unpersisted local profile instead of blocking", async () => {
    const profilesTable = makeProfilesTable();
    const seedFake = makeFakeSupabase({ patient: { id: "patient-1", clinic_id: "clinic-1", full_name: "Sara Idrissi" }, profilesTable });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await refreshPatientProfile(seedFake.client as any, { clinicId: "clinic-1", patientId: "patient-1" });

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    profilesTable.interceptEveryUpdate((row) => ({ ...row, version: (row.version as number) + 1 }));

    const fake = makeFakeSupabase({ patient: { id: "patient-1", clinic_id: "clinic-1", full_name: "Sara Idrissi" }, profilesTable });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await refreshPatientProfile(fake.client as any, { clinicId: "clinic-1", patientId: "patient-1" });

    expect(result.patientId).toBe("patient-1"); // still returns a usable, freshly-computed profile
    expect(profilesTable.updateAttempts).toBe(2);
  });

  it("always updates (never inserts) once a profile row already exists", async () => {
    const profilesTable = makeProfilesTable();
    // A row already exists (e.g. computed by an earlier, separate refresh) -- the version-check read should see it and go straight to the update path.
    profilesTable.rows.set("clinic-1:patient-1", {
      clinic_id: "clinic-1",
      patient_id: "patient-1",
      version: 1,
      completed_count: 0,
      no_show_count: 0,
      cancelled_count: 0,
      reliability_score: 0,
      reliability_label: "insufficient_data",
      summary: "",
      summary_source: "rule_based",
      channel_sample_size: 0,
      last_computed_at: NOW,
    });

    const fake = makeFakeSupabase({ patient: { id: "patient-1", clinic_id: "clinic-1", full_name: "Sara Idrissi" }, profilesTable });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await refreshPatientProfile(fake.client as any, { clinicId: "clinic-1", patientId: "patient-1" });

    expect(result.version).toBe(2);
    expect(profilesTable.insertAttempts).toBe(0);
    expect(profilesTable.updateAttempts).toBe(1);
  });
});

describe("refreshPatientProfile: recovery from partial failures", () => {
  it("still computes reliability/scheduling from appointments when the ai_conversations fetch fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fake = makeFakeSupabase({
      patient: { id: "patient-1", clinic_id: "clinic-1", full_name: "Sara Idrissi" },
      appointments: [
        { clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "d1", status: "completed", start_at: "2026-07-01T09:00:00Z" },
        { clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "d1", status: "completed", start_at: "2026-07-08T09:00:00Z" },
        { clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "d1", status: "completed", start_at: "2026-07-15T09:00:00Z" },
      ],
      failConversations: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = await refreshPatientProfile(fake.client as any, { clinicId: "clinic-1", patientId: "patient-1" });

    expect(profile.reliability.completedCount).toBe(3);
    expect(profile.reliability.label).toBe("excellent");
    expect(profile.communication).toEqual({ preferredChannel: null, sampleSize: 0 }); // degraded, not crashed
    expect(errorSpy).toHaveBeenCalled();
  });

  it("still computes communication preferences when the appointments fetch fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fake = makeFakeSupabase({
      patient: { id: "patient-1", clinic_id: "clinic-1", full_name: "Sara Idrissi" },
      conversations: [{ clinic_id: "clinic-1", patient_id: "patient-1", channel: "sms" }],
      failAppointments: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = await refreshPatientProfile(fake.client as any, { clinicId: "clinic-1", patientId: "patient-1" });

    expect(profile.reliability.sampleSize).toBe(0);
    expect(profile.communication).toEqual({ preferredChannel: "sms", sampleSize: 1 });
  });

  it("never throws, even when every optional data source fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fake = makeFakeSupabase({ failAppointments: true, failConversations: true });

    await expect(
      refreshPatientProfile(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fake.client as any,
        { clinicId: "clinic-1", patientId: "patient-1" },
      ),
    ).resolves.toMatchObject({ patientId: "patient-1", summary: expect.stringContaining("This patient") });
  });
});
