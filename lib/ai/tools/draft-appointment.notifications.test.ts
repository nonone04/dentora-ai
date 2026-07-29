import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const notifyAppointmentBookedMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/lib/notifications", () => ({ notifyAppointmentBooked: notifyAppointmentBookedMock }));
vi.mock("@/lib/ai/permissions", () => ({ assertActionAllowed: vi.fn(() => Promise.resolve()) }));

let fakeSupabase: { from: (table: string) => unknown };
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeSupabase }));

const { draftAppointmentTool } = await import("@/lib/ai/tools/draft-appointment");

function makeStaticBuilder(result: { data: unknown; error?: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "lt", "gt", "insert"]) b[m] = () => b;
  b.maybeSingle = () => Promise.resolve({ data: result.data, error: result.error ?? null });
  b.single = () => Promise.resolve({ data: result.data, error: result.error ?? null });
  b.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ data: result.data ?? [], error: null }).then(onFulfilled);
  return b;
}

function setUp() {
  const draft: Row = { id: "draft-1", proposed_start_at: "2026-08-10T09:00:00Z", proposed_end_at: "2026-08-10T09:30:00Z", status: "proposed" };
  fakeSupabase = {
    from: (table: string) => {
      if (table === "dentists") return makeStaticBuilder({ data: { id: "dentist-1" } });
      if (table === "appointments") return makeStaticBuilder({ data: [] });
      if (table === "appointment_drafts") return makeStaticBuilder({ data: draft });
      if (table === "appointment_lifecycle_events") return makeStaticBuilder({ data: null });
      return makeStaticBuilder({ data: null });
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  notifyAppointmentBookedMock.mockClear();
  notifyAppointmentBookedMock.mockResolvedValue(undefined);
});

describe("draftAppointmentTool: staff booking notification", () => {
  it("notifies staff that the AI created a new draft", async () => {
    setUp();

    const result = await draftAppointmentTool.execute(
      { dentistId: "dentist-1", startAt: "2026-08-10T09:00:00Z", patientName: "Amina" },
      { clinicId: "clinic-1", conversationId: "conv-1" },
    );

    expect(result).toMatchObject({ id: "draft-1" });
    expect(notifyAppointmentBookedMock).toHaveBeenCalledWith(fakeSupabase, {
      clinicId: "clinic-1",
      appointmentDraftId: "draft-1",
      conversationId: "conv-1",
    });
  });

  it("still returns the draft even when the notification hook fails", async () => {
    setUp();
    notifyAppointmentBookedMock.mockRejectedValue(new Error("boom"));

    const result = await draftAppointmentTool.execute(
      { dentistId: "dentist-1", startAt: "2026-08-10T09:00:00Z" },
      { clinicId: "clinic-1" },
    );

    expect(result).toMatchObject({ id: "draft-1" });
  });
});
