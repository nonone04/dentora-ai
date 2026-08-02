import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
const recordLifecycleEventMock = vi.hoisted(() => vi.fn());
const scheduleAppointmentRemindersMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/audit/log", () => ({ logAuditEvent: logAuditEventMock }));
vi.mock("@/lib/telemetry", () => ({ track: trackMock }));
vi.mock("@/lib/ai/appointments", () => ({ recordLifecycleEvent: recordLifecycleEventMock }));
vi.mock("@/lib/notifications", () => ({ scheduleAppointmentReminders: scheduleAppointmentRemindersMock }));
vi.mock("@/lib/supabase/auth", () => ({ requireUser: requireUserMock }));

type TableResult = { data: unknown; error: unknown };

function makeClient(tableResults: Record<string, TableResult>) {
  return {
    from(table: string) {
      const result = tableResults[table] ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "insert", "update", "eq"]) builder[method] = () => builder;
      builder.single = () => Promise.resolve(result);
      builder.maybeSingle = () => Promise.resolve(result);
      builder.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(client) }));

let client: ReturnType<typeof makeClient>;

const { approveDraft, rejectDraft } = await import("@/app/actions/appointment-drafts");

beforeEach(() => {
  vi.clearAllMocks();
  requireUserMock.mockResolvedValue({ id: "user-1" });
});

describe("approveDraft", () => {
  it("fires AI Suggestion Accepted and Appointment Created with source: ai_assistant", async () => {
    client = makeClient({
      appointment_drafts: {
        data: {
          id: "draft-1",
          patient_id: "patient-1",
          patient_name: "Jane Doe",
          patient_phone: "+15551234",
          dentist_id: "dentist-1",
          service_id: "service-1",
          proposed_start_at: "2026-08-01T10:00:00.000Z",
          proposed_end_at: "2026-08-01T10:30:00.000Z",
          notes: null,
          status: "proposed",
        },
        error: null,
      },
      appointments: { data: { id: "appt-1" }, error: null },
    });

    const result = await approveDraft("clinic-1", "draft-1", undefined, new FormData());

    expect(result).toBeUndefined();
    expect(scheduleAppointmentRemindersMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ clinicId: "clinic-1", appointmentId: "appt-1", patientId: "patient-1" }),
    );
    expect(trackMock).toHaveBeenCalledWith(expect.objectContaining({ name: "AI Suggestion Accepted", userId: "user-1", clinicId: "clinic-1" }));
    expect(trackMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Appointment Created", userId: "user-1", clinicId: "clinic-1", properties: { source: "ai_assistant" } }),
    );
  });

  it("does not track anything when the draft is already reviewed", async () => {
    client = makeClient({
      appointment_drafts: { data: { id: "draft-1", status: "confirmed" }, error: null },
    });

    await approveDraft("clinic-1", "draft-1", undefined, new FormData());

    expect(trackMock).not.toHaveBeenCalled();
  });
});

describe("rejectDraft", () => {
  it("fires AI Suggestion Dismissed on success", async () => {
    client = makeClient({
      appointment_drafts: { data: { id: "draft-1" }, error: null },
    });

    const result = await rejectDraft("clinic-1", "draft-1", undefined, new FormData());

    expect(result).toBeUndefined();
    expect(trackMock).toHaveBeenCalledWith(expect.objectContaining({ name: "AI Suggestion Dismissed", userId: "user-1", clinicId: "clinic-1" }));
  });

  it("does not track anything when there is nothing to reject", async () => {
    client = makeClient({
      appointment_drafts: { data: null, error: null },
    });

    await rejectDraft("clinic-1", "draft-1", undefined, new FormData());

    expect(trackMock).not.toHaveBeenCalled();
  });
});
