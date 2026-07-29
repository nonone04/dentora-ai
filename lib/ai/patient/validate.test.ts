import { describe, expect, it } from "vitest";
import { parsePatientProfileRow, patientProfileToRow, type PatientProfileRow } from "@/lib/ai/patient/validate";
import type { PatientProfile } from "@/lib/ai/patient/types";

function makeRow(overrides: Partial<PatientProfileRow> = {}): PatientProfileRow {
  return {
    clinic_id: "clinic-1",
    patient_id: "patient-1",
    reliability_score: 0.8,
    reliability_label: "good",
    completed_count: 4,
    no_show_count: 1,
    cancelled_count: 0,
    preferred_channel: "whatsapp",
    channel_sample_size: 3,
    preferred_time_of_day: "morning",
    preferred_dentist_id: "dentist-1",
    summary: "Sara has 5 past appointments.",
    summary_source: "llm",
    version: 4,
    last_computed_at: "2026-07-28T12:00:00.000Z",
    ...overrides,
  };
}

describe("parsePatientProfileRow", () => {
  it("parses a well-formed row", () => {
    const profile = parsePatientProfileRow(makeRow());

    expect(profile.clinicId).toBe("clinic-1");
    expect(profile.patientId).toBe("patient-1");
    expect(profile.reliability).toEqual({
      score: 0.8,
      label: "good",
      completedCount: 4,
      noShowCount: 1,
      cancelledCount: 0,
      sampleSize: 5,
    });
    expect(profile.communication).toEqual({ preferredChannel: "whatsapp", sampleSize: 3 });
    expect(profile.scheduling).toEqual({ preferredTimeOfDay: "morning", preferredDentistId: "dentist-1", sampleSize: 4 });
    expect(profile.summary).toBe("Sara has 5 past appointments.");
    expect(profile.summarySource).toBe("llm");
    expect(profile.version).toBe(4);
    expect(profile.lastComputedAt).toBe("2026-07-28T12:00:00.000Z");
  });

  it("derives scheduling sample size from the completed count, not a separate column", () => {
    const profile = parsePatientProfileRow(makeRow({ completed_count: 7 }));
    expect(profile.scheduling.sampleSize).toBe(7);
  });

  it("falls back to safe defaults for every malformed field instead of throwing", () => {
    const profile = parsePatientProfileRow(
      makeRow({
        clinic_id: 123,
        reliability_score: "not a number",
        reliability_label: "bogus",
        completed_count: "four",
        preferred_channel: "carrier_pigeon",
        preferred_time_of_day: "midnight",
        summary_source: "psychic",
        version: "four",
        last_computed_at: 0,
      }),
    );

    expect(profile.clinicId).toBe("");
    expect(profile.reliability.score).toBe(0);
    expect(profile.reliability.label).toBe("insufficient_data");
    expect(profile.reliability.completedCount).toBe(0);
    expect(profile.communication.preferredChannel).toBeNull();
    expect(profile.scheduling.preferredTimeOfDay).toBeNull();
    expect(profile.summarySource).toBe("rule_based");
    expect(profile.version).toBe(0);
    expect(profile.lastComputedAt).toBe(new Date(0).toISOString());
  });

  it("clamps an out-of-range reliability score", () => {
    expect(parsePatientProfileRow(makeRow({ reliability_score: 5 })).reliability.score).toBe(1);
    expect(parsePatientProfileRow(makeRow({ reliability_score: -2 })).reliability.score).toBe(0);
  });
});

describe("patientProfileToRow", () => {
  it("maps every field to its snake_case column, using the version passed in", () => {
    const profile: PatientProfile = {
      clinicId: "clinic-1",
      patientId: "patient-1",
      reliability: { score: 0.8, label: "good", completedCount: 4, noShowCount: 1, cancelledCount: 0, sampleSize: 5 },
      communication: { preferredChannel: "whatsapp", sampleSize: 3 },
      scheduling: { preferredTimeOfDay: "morning", preferredDentistId: "dentist-1", sampleSize: 4 },
      summary: "Sara has 5 past appointments.",
      summarySource: "llm",
      version: 3,
      lastComputedAt: "2026-07-28T12:00:00.000Z",
    };

    const row = patientProfileToRow(profile, 5);

    expect(row).toMatchObject({
      clinic_id: "clinic-1",
      patient_id: "patient-1",
      reliability_score: 0.8,
      reliability_label: "good",
      completed_count: 4,
      no_show_count: 1,
      cancelled_count: 0,
      preferred_channel: "whatsapp",
      channel_sample_size: 3,
      preferred_time_of_day: "morning",
      preferred_dentist_id: "dentist-1",
      summary: "Sara has 5 past appointments.",
      summary_source: "llm",
      version: 5,
    });
    expect(typeof row.last_computed_at).toBe("string");
  });
});
