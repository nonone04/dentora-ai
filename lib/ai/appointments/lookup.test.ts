import { describe, expect, it } from "vitest";
import { findUpcomingAppointmentForPatient } from "@/lib/ai/appointments/lookup";

type Row = Record<string, unknown>;

/** Real in-memory filterable fake, same shape used across lib/ai/availability's I/O tests. */
function makeFilterableSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          rows = rows.filter((row) => row[column] === value);
          return builder;
        },
        in(column: string, values: unknown[]) {
          rows = rows.filter((row) => values.includes(row[column]));
          return builder;
        },
        gt(column: string, value: unknown) {
          rows = rows.filter((row) => (row[column] as string) > (value as string));
          return builder;
        },
        order() {
          rows = [...rows].sort((a, b) => ((a.start_at as string) < (b.start_at as string) ? -1 : 1));
          return builder;
        },
        limit(n: number) {
          rows = rows.slice(0, n);
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
      };
      return builder;
    },
  };
}

const NOW = new Date("2026-08-01T00:00:00Z");

describe("findUpcomingAppointmentForPatient", () => {
  it("returns the soonest upcoming, active appointment", async () => {
    const tables = {
      appointments: [
        { id: "appt-later", clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "d1", service_id: null, status: "scheduled", start_at: "2026-08-10T09:00:00Z", end_at: "2026-08-10T09:30:00Z" },
        { id: "appt-soon", clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "d1", service_id: null, status: "confirmed", start_at: "2026-08-05T09:00:00Z", end_at: "2026-08-05T09:30:00Z" },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findUpcomingAppointmentForPatient(makeFilterableSupabase(tables) as any, {
      clinicId: "clinic-1",
      patientId: "patient-1",
      now: NOW,
    });

    expect(result?.id).toBe("appt-soon");
  });

  it("ignores completed, cancelled, and no-show appointments", async () => {
    const tables = {
      appointments: [
        { id: "appt-cancelled", clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "d1", service_id: null, status: "cancelled", start_at: "2026-08-02T09:00:00Z", end_at: "2026-08-02T09:30:00Z" },
        { id: "appt-completed", clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "d1", service_id: null, status: "completed", start_at: "2026-08-03T09:00:00Z", end_at: "2026-08-03T09:30:00Z" },
        { id: "appt-valid", clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "d1", service_id: null, status: "scheduled", start_at: "2026-08-10T09:00:00Z", end_at: "2026-08-10T09:30:00Z" },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findUpcomingAppointmentForPatient(makeFilterableSupabase(tables) as any, {
      clinicId: "clinic-1",
      patientId: "patient-1",
      now: NOW,
    });

    expect(result?.id).toBe("appt-valid");
  });

  it("ignores appointments that have already passed", async () => {
    const tables = {
      appointments: [
        { id: "appt-past", clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "d1", service_id: null, status: "scheduled", start_at: "2026-07-01T09:00:00Z", end_at: "2026-07-01T09:30:00Z" },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findUpcomingAppointmentForPatient(makeFilterableSupabase(tables) as any, {
      clinicId: "clinic-1",
      patientId: "patient-1",
      now: NOW,
    });

    expect(result).toBeNull();
  });

  it("ignores another patient's or another clinic's appointments", async () => {
    const tables = {
      appointments: [
        { id: "other-patient", clinic_id: "clinic-1", patient_id: "patient-2", dentist_id: "d1", service_id: null, status: "scheduled", start_at: "2026-08-10T09:00:00Z", end_at: "2026-08-10T09:30:00Z" },
        { id: "other-clinic", clinic_id: "clinic-2", patient_id: "patient-1", dentist_id: "d1", service_id: null, status: "scheduled", start_at: "2026-08-10T09:00:00Z", end_at: "2026-08-10T09:30:00Z" },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findUpcomingAppointmentForPatient(makeFilterableSupabase(tables) as any, {
      clinicId: "clinic-1",
      patientId: "patient-1",
      now: NOW,
    });

    expect(result).toBeNull();
  });

  it("returns null when the patient has no appointments at all", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findUpcomingAppointmentForPatient(makeFilterableSupabase({ appointments: [] }) as any, {
      clinicId: "clinic-1",
      patientId: "patient-1",
      now: NOW,
    });

    expect(result).toBeNull();
  });
});
