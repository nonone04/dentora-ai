import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";

const requireOwnerMock = vi.hoisted(() => vi.fn());
const requireManagerMock = vi.hoisted(() => vi.fn());
const requireUserMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
const identifyMock = vi.hoisted(() => vi.fn());
const resetClinicDataMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getServerDictionary: () => Promise.resolve(en), getServerLocale: () => Promise.resolve("en") }));
vi.mock("@/lib/audit/log", () => ({ logAuditEvent: logAuditEventMock }));
vi.mock("@/lib/telemetry", () => ({ track: trackMock, identify: identifyMock }));
vi.mock("@/lib/clinic/reset-data", () => ({ resetClinicData: resetClinicDataMock }));
vi.mock("@/lib/supabase/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/supabase/clinic", () => ({ requireOwner: requireOwnerMock, requireManager: requireManagerMock }));

type TableConfig = { select?: { data: unknown; error?: unknown }; update?: { data: unknown; error?: unknown } };

function makeClient(tables: Record<string, TableConfig>) {
  const updateCalls: { table: string; payload: Record<string, unknown> }[] = [];

  const client = {
    from(table: string) {
      const config = tables[table] ?? {};
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        update: (payload: Record<string, unknown>) => {
          updateCalls.push({ table, payload });
          return builder;
        },
        single: () => Promise.resolve(config.select ?? { data: null, error: null }),
        maybeSingle: () => Promise.resolve(config.select ?? { data: null, error: null }),
        then: (onFulfilled: (v: unknown) => unknown) =>
          Promise.resolve(config.update ?? { data: null, error: null }).then(onFulfilled),
      };
      return builder;
    },
  };

  return { client, updateCalls };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(currentClient) }));

let currentClient: ReturnType<typeof makeClient>["client"];

const { updateClinicInfo, resetClinicDataAction } = await import("@/app/actions/clinics");

function formData(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.append(key, value));
  return data;
}

const user = { id: "user-1" };

beforeEach(() => {
  vi.clearAllMocks();
  requireOwnerMock.mockReset();
  requireManagerMock.mockReset();
});

describe("updateClinicInfo", () => {
  it("refuses a non-owner without touching the database", async () => {
    requireOwnerMock.mockResolvedValue(null);
    const { client, updateCalls } = makeClient({});
    currentClient = client;

    const result = await updateClinicInfo("clinic-1", undefined, formData({ name: "New Name" }));

    expect(result).toEqual({ error: en.validation.ownerOnlyClinicInfo });
    expect(updateCalls).toHaveLength(0);
  });

  it("rejects a blank clinic name", async () => {
    requireOwnerMock.mockResolvedValue(user);
    const { client, updateCalls } = makeClient({});
    currentClient = client;

    const result = await updateClinicInfo("clinic-1", undefined, formData({ name: "  " }));

    expect(result).toEqual({ error: en.validation.clinicNameRequired });
    expect(updateCalls).toHaveLength(0);
  });

  it("saves the profile fields, working hours, and logs an audit event on success", async () => {
    requireOwnerMock.mockResolvedValue(user);
    const { client, updateCalls } = makeClient({
      clinics: { select: { data: { settings: { notifications: { reminderHoursBefore: 24 } } }, error: null }, update: { data: null, error: null } },
    });
    currentClient = client;

    const result = await updateClinicInfo(
      "clinic-1",
      undefined,
      formData({
        name: "Dentora Clinic",
        phone: "+1 555 0100",
        email: "hello@dentora.ai",
        website: "https://dentora.ai",
        address: "1 Main St",
        city: "Casablanca",
        country: "MA",
        timezone: "Africa/Casablanca",
        "workingHours.mon.open": "08:00",
        "workingHours.mon.close": "17:00",
      }),
    );

    expect(result).toEqual({ success: true });
    expect(updateCalls).toHaveLength(1);
    const payload = updateCalls[0].payload;
    expect(payload.name).toBe("Dentora Clinic");
    expect(payload.phone).toBe("+1 555 0100");
    // Existing settings (e.g. notifications) survive the merge -- only workingHours is added.
    expect(payload.settings).toMatchObject({ notifications: { reminderHoursBefore: 24 } });
    expect((payload.settings as { workingHours: unknown[] }).workingHours).toHaveLength(7);
    expect(logAuditEventMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ clinicId: "clinic-1", actorId: "user-1", action: "clinic_info_updated" }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/clinic/clinic-1", "layout");
  });
});

describe("resetClinicDataAction", () => {
  it("refuses a non-owner without wiping any data", async () => {
    requireOwnerMock.mockResolvedValue(null);
    const { client } = makeClient({});
    currentClient = client;

    const result = await resetClinicDataAction("clinic-1", undefined, formData({ confirmName: "Anything" }));

    expect(result).toEqual({ error: en.validation.ownerOnlyDangerZone });
    expect(resetClinicDataMock).not.toHaveBeenCalled();
  });

  it("refuses to run against the shared demo clinic", async () => {
    requireOwnerMock.mockResolvedValue(user);
    const { client } = makeClient({
      clinics: { select: { data: { name: "Demo Clinic", is_demo: true }, error: null } },
    });
    currentClient = client;

    const result = await resetClinicDataAction("clinic-1", undefined, formData({ confirmName: "Demo Clinic" }));

    expect(result).toEqual({ error: en.settings.dangerZone.resetError });
    expect(resetClinicDataMock).not.toHaveBeenCalled();
  });

  it("rejects a confirmation name that doesn't match the clinic's real name", async () => {
    requireOwnerMock.mockResolvedValue(user);
    const { client } = makeClient({
      clinics: { select: { data: { name: "Dentora Clinic", is_demo: false }, error: null } },
    });
    currentClient = client;

    const result = await resetClinicDataAction("clinic-1", undefined, formData({ confirmName: "Wrong Name" }));

    expect(result).toEqual({ error: en.settings.dangerZone.confirmNameMismatch });
    expect(resetClinicDataMock).not.toHaveBeenCalled();
  });

  it("wipes clinic data, logs an audit event, and tracks the reset when the name matches", async () => {
    requireOwnerMock.mockResolvedValue(user);
    resetClinicDataMock.mockResolvedValue(undefined);
    const { client } = makeClient({
      clinics: { select: { data: { name: "Dentora Clinic", is_demo: false }, error: null } },
    });
    currentClient = client;

    const result = await resetClinicDataAction("clinic-1", undefined, formData({ confirmName: "Dentora Clinic" }));

    expect(result).toEqual({ success: true });
    expect(resetClinicDataMock).toHaveBeenCalledWith("clinic-1");
    expect(logAuditEventMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ clinicId: "clinic-1", actorId: "user-1", action: "clinic_data_reset" }),
    );
    expect(trackMock).toHaveBeenCalledWith({ name: "Clinic Data Reset", userId: "user-1", clinicId: "clinic-1" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/clinic/clinic-1", "layout");
  });
});
