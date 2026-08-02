import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";

const requireUserMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
const scheduleAppointmentRemindersMock = vi.hoisted(() => vi.fn());
const transitionAppointmentMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/i18n/server", () => ({ getServerDictionary: () => Promise.resolve(en) }));
vi.mock("@/lib/audit/log", () => ({ logAuditEvent: logAuditEventMock }));
vi.mock("@/lib/telemetry", () => ({ track: trackMock }));
vi.mock("@/lib/notifications", () => ({ scheduleAppointmentReminders: scheduleAppointmentRemindersMock }));
vi.mock("@/lib/ai/appointments", () => ({ transitionAppointment: transitionAppointmentMock }));
vi.mock("@/lib/supabase/auth", () => ({ requireUser: requireUserMock }));

type TableResult = { data: unknown; error: unknown };

function makeClient(tableResults: Record<string, TableResult>) {
  return {
    from(table: string) {
      const result = tableResults[table] ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "insert", "update", "eq"]) builder[method] = () => builder;
      builder.single = () => Promise.resolve(result);
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(client) }));

let client: ReturnType<typeof makeClient>;

const { createAppointment, updateAppointmentStatus } = await import("@/app/actions/appointments");

function formData(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.append(key, value));
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUserMock.mockResolvedValue({ id: "user-1" });
  transitionAppointmentMock.mockResolvedValue({ ok: true, fromStatus: "scheduled", toStatus: "confirmed" });
});

describe("createAppointment", () => {
  it("fires Appointment Created with source: staff on success", async () => {
    client = makeClient({ appointments: { data: { id: "appt-1" }, error: null } });

    const result = await createAppointment(
      "clinic-1",
      undefined,
      formData({ patientId: "patient-1", dentistId: "dentist-1", startAt: "2026-08-01T10:00:00.000Z", durationMinutes: "30" }),
    );

    expect(result).toEqual({ success: true });
    expect(scheduleAppointmentRemindersMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ clinicId: "clinic-1", appointmentId: "appt-1", patientId: "patient-1" }),
    );
    expect(trackMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Appointment Created", userId: "user-1", clinicId: "clinic-1", properties: { source: "staff" } }),
    );
  });

  it("does not track anything when the insert fails", async () => {
    client = makeClient({ appointments: { data: null, error: { code: "23P01", message: "conflict" } } });

    await createAppointment(
      "clinic-1",
      undefined,
      formData({ patientId: "patient-1", dentistId: "dentist-1", startAt: "2026-08-01T10:00:00.000Z", durationMinutes: "30" }),
    );

    expect(trackMock).not.toHaveBeenCalled();
    expect(scheduleAppointmentRemindersMock).not.toHaveBeenCalled();
  });
});

describe("updateAppointmentStatus", () => {
  it("transitions via the Appointment Lifecycle Engine, and fires Appointment Cancelled only when cancelling", async () => {
    transitionAppointmentMock.mockResolvedValue({ ok: true, fromStatus: "confirmed", toStatus: "cancelled" });
    client = makeClient({});

    await updateAppointmentStatus("clinic-1", "appt-1", undefined, formData({ status: "cancelled" }));

    expect(transitionAppointmentMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ clinicId: "clinic-1", appointmentId: "appt-1", event: "cancel", actor: "staff", actorId: "user-1" }),
    );
    expect(trackMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Appointment Updated", properties: { status: "cancelled" } }),
    );
    expect(trackMock).toHaveBeenCalledWith(expect.objectContaining({ name: "Appointment Cancelled" }));
  });

  it("does not fire Appointment Cancelled for a non-cancelling status change", async () => {
    client = makeClient({});

    await updateAppointmentStatus("clinic-1", "appt-1", undefined, formData({ status: "completed" }));

    expect(transitionAppointmentMock).toHaveBeenCalledWith(client, expect.objectContaining({ event: "complete" }));
    expect(trackMock).toHaveBeenCalledWith(expect.objectContaining({ name: "Appointment Updated" }));
    expect(trackMock).not.toHaveBeenCalledWith(expect.objectContaining({ name: "Appointment Cancelled" }));
  });

  it("rejects a status with no corresponding lifecycle event (e.g. reverting to scheduled) without calling the engine", async () => {
    client = makeClient({});

    const result = await updateAppointmentStatus("clinic-1", "appt-1", undefined, formData({ status: "scheduled" }));

    expect(result).toEqual({ error: en.validation.invalidStatus });
    expect(transitionAppointmentMock).not.toHaveBeenCalled();
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("surfaces a not-found error without tracking anything when the appointment no longer exists", async () => {
    transitionAppointmentMock.mockResolvedValue({ ok: false, reason: "not_found" });
    client = makeClient({});

    const result = await updateAppointmentStatus("clinic-1", "appt-1", undefined, formData({ status: "confirmed" }));

    expect(result).toEqual({ error: en.calendar.conflict.notFound });
    expect(trackMock).not.toHaveBeenCalled();
  });
});
