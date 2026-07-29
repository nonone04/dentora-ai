import { describe, expect, it } from "vitest";
import { computeTelemetryDashboardSummary } from "@/lib/telemetry/dashboard";
import type { ClinicRow, TelemetryEventRow } from "@/lib/telemetry/query";

const TO = new Date("2026-07-29T12:00:00.000Z");
const RANGE = { from: new Date(TO.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), to: TO.toISOString() };
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDaysBefore = (days: number) => new Date(TO.getTime() - days * DAY_MS).toISOString();

function event(overrides: Partial<TelemetryEventRow>): TelemetryEventRow {
  return { event_name: "Login", clinic_id: null, user_id: null, occurred_at: TO.toISOString(), properties: {}, ...overrides };
}

const clinics: ClinicRow[] = [
  { id: "clinic-1", created_at: isoDaysBefore(20) },
  { id: "clinic-2", created_at: isoDaysBefore(20) },
];

const events: TelemetryEventRow[] = [
  // active users
  event({ event_name: "Login", user_id: "user-1", occurred_at: isoDaysBefore(0) }),
  event({ event_name: "Login", user_id: "user-2", occurred_at: isoDaysBefore(5) }),
  event({ event_name: "Login", user_id: "user-3", occurred_at: isoDaysBefore(20) }),
  event({ event_name: "Login", user_id: "user-4", occurred_at: isoDaysBefore(40) }), // outside every window

  // activation: clinic-1 activates 2 days after creation (within the 14-day window), clinic-2 never does
  event({ event_name: "Appointment Created", clinic_id: "clinic-1", occurred_at: isoDaysBefore(18) }),

  // onboarding funnel
  event({ event_name: "User Registered", clinic_id: "clinic-1" }),
  event({ event_name: "User Registered", clinic_id: "clinic-2" }),
  event({ event_name: "Email Verified", clinic_id: "clinic-1" }),

  // feature adoption / most used features
  event({ event_name: "Feature Used", clinic_id: "clinic-1", properties: { feature: "calendar" } }),
  event({ event_name: "Feature Used", clinic_id: "clinic-1", properties: { feature: "calendar" } }),
  event({ event_name: "Feature Used", clinic_id: "clinic-2", properties: { feature: "calendar" } }),
  event({ event_name: "Feature Used", clinic_id: "clinic-1", properties: { feature: "settings" } }),

  // demo usage
  event({ event_name: "Demo Started" }),
  event({ event_name: "Demo Started" }),
  event({ event_name: "Demo Reset" }),
];

describe("computeTelemetryDashboardSummary", () => {
  const summary = computeTelemetryDashboardSummary({ events, clinics }, RANGE);

  it("computes DAU/WAU/MAU as distinct users within trailing windows ending at range.to", () => {
    expect(summary.activeUsers.daily).toBe(1); // user-1 only
    expect(summary.activeUsers.weekly).toBe(2); // user-1, user-2
    expect(summary.activeUsers.monthly).toBe(3); // user-1, user-2, user-3 -- user-4 is 40 days back
  });

  it("computes activation rate from clinics reaching an activation event within 14 days of creation", () => {
    expect(summary.activation).toEqual({ totalClinics: 2, activatedClinics: 1, rate: 0.5 });
  });

  it("computes feature adoption as distinct clinics per feature, out of all clinics", () => {
    const calendar = summary.featureAdoption.find((f) => f.feature === "calendar");
    const settings = summary.featureAdoption.find((f) => f.feature === "settings");
    const security = summary.featureAdoption.find((f) => f.feature === "security");
    expect(calendar).toEqual({ feature: "calendar", clinics: 2, shareOfClinics: 1 });
    expect(settings).toEqual({ feature: "settings", clinics: 1, shareOfClinics: 0.5 });
    expect(security).toEqual({ feature: "security", clinics: 0, shareOfClinics: 0 });
  });

  it("computes most-used features as raw event counts, distinct from adoption's per-clinic counts", () => {
    expect(summary.mostUsedFeatures[0]).toEqual({ feature: "calendar", count: 3 });
    expect(summary.mostUsedFeatures[1]).toEqual({ feature: "settings", count: 1 });
  });

  it("computes onboarding funnel step counts and step-to-step conversion", () => {
    const userRegistered = summary.onboardingFunnel.find((s) => s.step === "User Registered")!;
    const emailVerified = summary.onboardingFunnel.find((s) => s.step === "Email Verified")!;
    const clinicCreated = summary.onboardingFunnel.find((s) => s.step === "Clinic Created")!;

    expect(userRegistered).toEqual({ step: "User Registered", clinics: 2, conversionFromPrevious: null });
    expect(emailVerified).toEqual({ step: "Email Verified", clinics: 1, conversionFromPrevious: 0.5 });
    expect(clinicCreated.clinics).toBe(0);
  });

  it("counts demo usage", () => {
    expect(summary.demoUsage).toEqual({ started: 2, reset: 1 });
  });

  it("reports insufficient_data for trial conversion when no trial events exist", () => {
    expect(summary.trialConversion).toEqual({ status: "insufficient_data" });
  });

  it("computes a real trial conversion rate once trial events exist", () => {
    const withTrials = computeTelemetryDashboardSummary(
      {
        events: [
          ...events,
          event({ event_name: "Trial Started" }),
          event({ event_name: "Trial Started" }),
          event({ event_name: "Subscription Activated" }),
        ],
        clinics,
      },
      RANGE,
    );
    expect(withTrials.trialConversion).toEqual({ status: "computed", trialsStarted: 2, subscriptionsActivated: 1, rate: 0.5 });
  });
});
