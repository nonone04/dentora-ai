import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";

const requireUserMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
const scheduleAppointmentReminderMock = vi.hoisted(() => vi.fn());
const sendAppointmentConfirmationMock = vi.hoisted(() => vi.fn());
const skipPendingRemindersMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/i18n/server", () => ({ getServerDictionary: () => Promise.resolve(en) }));
vi.mock("@/lib/audit/log", () => ({ logAuditEvent: logAuditEventMock }));
vi.mock("@/lib/telemetry", () => ({ track: trackMock }));
vi.mock("@/lib/notifications/schedule", () => ({
  scheduleAppointmentReminder: scheduleAppointmentReminderMock,
  sendAppointmentConfirmation: sendAppointmentConfirmationMock,
  skipPendingReminders: skipPendingRemindersMock,
}));
vi.mock("@/lib/notifications/settings", () => ({
  DEFAULT_REMINDER_HOURS_BEFORE: 24,
  getClinicNotificationSettings: () => ({ reminderHoursBefore: 24, sendConfirmations: true }),
}));
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
});

describe("createAppointment", () => {
  it("fires Appointment Created with source: staff on success", async () => {
    client = makeClient({
      appointments: { data: { id: "appt-1" }, error: null },
      patients: { data: { reminder_opt_in: true, preferred_contact_channel: "email" }, error: null },
      clinics: { data: { settings: {} }, error: null },
    });

    const result = await createAppointment(
      "clinic-1",
      undefined,
      formData({ patientId: "patient-1", dentistId: "dentist-1", startAt: "2026-08-01T10:00:00.000Z", durationMinutes: "30" }),
    );

    expect(result).toEqual({ success: true });
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
  });
});

describe("updateAppointmentStatus", () => {
  it("fires Appointment Updated, and Appointment Cancelled only when cancelling", async () => {
    client = makeClient({
      appointments: {
        data: { id: "appt-1", patient_id: "patient-1", start_at: "2026-08-01T10:00:00.000Z", patients: null },
        error: null,
      },
    });

    await updateAppointmentStatus("clinic-1", "appt-1", undefined, formData({ status: "cancelled" }));

    expect(trackMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Appointment Updated", properties: { status: "cancelled" } }),
    );
    expect(trackMock).toHaveBeenCalledWith(expect.objectContaining({ name: "Appointment Cancelled" }));
  });

  it("does not fire Appointment Cancelled for a non-cancelling status change", async () => {
    client = makeClient({
      appointments: {
        data: { id: "appt-1", patient_id: "patient-1", start_at: "2026-08-01T10:00:00.000Z", patients: null },
        error: null,
      },
    });

    await updateAppointmentStatus("clinic-1", "appt-1", undefined, formData({ status: "scheduled" }));

    expect(trackMock).toHaveBeenCalledWith(expect.objectContaining({ name: "Appointment Updated" }));
    expect(trackMock).not.toHaveBeenCalledWith(expect.objectContaining({ name: "Appointment Cancelled" }));
  });
});
