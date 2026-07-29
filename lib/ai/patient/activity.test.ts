import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordPatientActivity } from "@/lib/ai/patient/activity";

function makeFakeSupabase(insertResult: { error: unknown }) {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      from(table: string) {
        return {
          insert: (payload: Record<string, unknown>) => {
            calls.push({ table, payload });
            return Promise.resolve(insertResult);
          },
        };
      },
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("recordPatientActivity", () => {
  it("inserts a fully-shaped row into patient_activity_events", async () => {
    const fake = makeFakeSupabase({ error: null });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordPatientActivity(fake.client as any, {
      clinicId: "clinic-1",
      patientId: "patient-1",
      type: "appointment_completed",
      appointmentId: "appt-1",
      conversationId: "conv-1",
      metadata: { note: "first visit" },
    });

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toEqual({
      table: "patient_activity_events",
      payload: {
        clinic_id: "clinic-1",
        patient_id: "patient-1",
        type: "appointment_completed",
        appointment_id: "appt-1",
        conversation_id: "conv-1",
        metadata: { note: "first visit" },
      },
    });
  });

  it("defaults optional fields to null/empty", async () => {
    const fake = makeFakeSupabase({ error: null });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordPatientActivity(fake.client as any, {
      clinicId: "clinic-1",
      patientId: "patient-1",
      type: "conversation_started",
    });

    expect(fake.calls[0]).toMatchObject({
      payload: { appointment_id: null, conversation_id: null, metadata: {} },
    });
  });

  it("logs but does not throw when the insert fails", async () => {
    const fake = makeFakeSupabase({ error: { message: "boom" } });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      recordPatientActivity(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fake.client as any,
        { clinicId: "clinic-1", patientId: "patient-1", type: "conversation_started" },
      ),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("failed to record patient activity"), "boom");
  });
});
