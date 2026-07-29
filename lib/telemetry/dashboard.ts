import type { SupabaseClient } from "@supabase/supabase-js";
import type { DateRange } from "@/lib/analytics/types";
import { ONBOARDING_FUNNEL_STEPS, FEATURE_NAMES, type AnalyticsEventName, type FeatureName } from "@/lib/telemetry/events";
import { fetchTelemetryRawData, type ClinicRow, type TelemetryEventRow } from "@/lib/telemetry/query";

const DEFAULT_RANGE_DAYS = 30;
const ACTIVATION_WINDOW_DAYS = 14;
const ACTIVATION_EVENTS: ReadonlySet<AnalyticsEventName> = new Set(["Appointment Created", "AI Conversation Started"]);
const DAY_MS = 24 * 60 * 60 * 1000;

export function defaultDateRange(now: Date = new Date()): DateRange {
  const from = new Date(now.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
  return { from: from.toISOString(), to: now.toISOString() };
}

export type ActiveUsers = { daily: number; weekly: number; monthly: number };

export type ActivationSummary = {
  totalClinics: number;
  activatedClinics: number;
  /** Share of clinics with an activation event within ACTIVATION_WINDOW_DAYS of creation (0-1). */
  rate: number;
};

export type FeatureAdoptionEntry = { feature: FeatureName; clinics: number; shareOfClinics: number };

export type FunnelStepSummary = { step: AnalyticsEventName; clinics: number; conversionFromPrevious: number | null };

export type TrialConversion =
  | { status: "insufficient_data" }
  | { status: "computed"; trialsStarted: number; subscriptionsActivated: number; rate: number };

export type TelemetryDashboardSummary = {
  range: DateRange;
  activeUsers: ActiveUsers;
  activation: ActivationSummary;
  featureAdoption: FeatureAdoptionEntry[];
  mostUsedFeatures: { feature: FeatureName; count: number }[];
  onboardingFunnel: FunnelStepSummary[];
  demoUsage: { started: number; reset: number };
  trialConversion: TrialConversion;
  generatedAt: string;
};

function distinctBy<T>(rows: T[], key: (row: T) => string | null): number {
  const set = new Set<string>();
  for (const row of rows) {
    const value = key(row);
    if (value) set.add(value);
  }
  return set.size;
}

function withinTrailingDays(occurredAt: string, to: Date, days: number): boolean {
  const occurred = new Date(occurredAt).getTime();
  return occurred <= to.getTime() && occurred > to.getTime() - days * DAY_MS;
}

function computeActiveUsers(events: TelemetryEventRow[], to: Date): ActiveUsers {
  const daily = events.filter((e) => withinTrailingDays(e.occurred_at, to, 1));
  const weekly = events.filter((e) => withinTrailingDays(e.occurred_at, to, 7));
  const monthly = events.filter((e) => withinTrailingDays(e.occurred_at, to, 30));
  return {
    daily: distinctBy(daily, (e) => e.user_id),
    weekly: distinctBy(weekly, (e) => e.user_id),
    monthly: distinctBy(monthly, (e) => e.user_id),
  };
}

function firstOccurrenceByClinic(events: TelemetryEventRow[], eventName: string): Map<string, number> {
  const firstSeen = new Map<string, number>();
  for (const event of events) {
    if (event.event_name !== eventName || !event.clinic_id) continue;
    const occurred = new Date(event.occurred_at).getTime();
    const existing = firstSeen.get(event.clinic_id);
    if (existing === undefined || occurred < existing) {
      firstSeen.set(event.clinic_id, occurred);
    }
  }
  return firstSeen;
}

function computeActivation(events: TelemetryEventRow[], clinics: ClinicRow[]): ActivationSummary {
  const activationTimestamps = new Map<string, number>();
  for (const event of events) {
    if (!event.clinic_id || !ACTIVATION_EVENTS.has(event.event_name as AnalyticsEventName)) continue;
    const occurred = new Date(event.occurred_at).getTime();
    const existing = activationTimestamps.get(event.clinic_id);
    if (existing === undefined || occurred < existing) {
      activationTimestamps.set(event.clinic_id, occurred);
    }
  }

  let activatedClinics = 0;
  for (const clinic of clinics) {
    const activatedAt = activationTimestamps.get(clinic.id);
    if (activatedAt === undefined) continue;
    const createdAt = new Date(clinic.created_at).getTime();
    if (activatedAt - createdAt <= ACTIVATION_WINDOW_DAYS * DAY_MS) {
      activatedClinics++;
    }
  }

  const totalClinics = clinics.length;
  return {
    totalClinics,
    activatedClinics,
    rate: totalClinics === 0 ? 0 : activatedClinics / totalClinics,
  };
}

function computeFeatureAdoption(events: TelemetryEventRow[], totalClinics: number): FeatureAdoptionEntry[] {
  return FEATURE_NAMES.map((feature) => {
    const clinicsUsingFeature = new Set<string>();
    for (const event of events) {
      if (event.event_name !== "Feature Used" || event.properties?.feature !== feature || !event.clinic_id) continue;
      clinicsUsingFeature.add(event.clinic_id);
    }
    return {
      feature,
      clinics: clinicsUsingFeature.size,
      shareOfClinics: totalClinics === 0 ? 0 : clinicsUsingFeature.size / totalClinics,
    };
  });
}

function computeMostUsedFeatures(events: TelemetryEventRow[]): { feature: FeatureName; count: number }[] {
  const counts = new Map<FeatureName, number>();
  for (const event of events) {
    if (event.event_name !== "Feature Used") continue;
    const feature = event.properties?.feature as FeatureName | undefined;
    if (!feature) continue;
    counts.set(feature, (counts.get(feature) ?? 0) + 1);
  }
  return [...counts.entries()].map(([feature, count]) => ({ feature, count })).sort((a, b) => b.count - a.count);
}

function computeOnboardingFunnel(events: TelemetryEventRow[]): FunnelStepSummary[] {
  let previousClinics: number | null = null;
  return ONBOARDING_FUNNEL_STEPS.map((step) => {
    const clinics = firstOccurrenceByClinic(events, step).size;
    const conversionFromPrevious = previousClinics === null || previousClinics === 0 ? null : clinics / previousClinics;
    previousClinics = clinics;
    return { step, clinics, conversionFromPrevious };
  });
}

function computeDemoUsage(events: TelemetryEventRow[]) {
  return {
    started: events.filter((e) => e.event_name === "Demo Started").length,
    reset: events.filter((e) => e.event_name === "Demo Reset").length,
  };
}

/**
 * "Trial Started"/"Subscription Activated" are defined in the event
 * union (lib/telemetry/events.ts) but have no wired trigger -- there is
 * no trial/subscription system in the product yet. This always returns
 * insufficient_data today; once billing exists and starts firing those
 * events, it will start computing a real rate without any dashboard changes.
 */
function computeTrialConversion(events: TelemetryEventRow[]): TrialConversion {
  const trialsStarted = events.filter((e) => e.event_name === "Trial Started").length;
  const subscriptionsActivated = events.filter((e) => e.event_name === "Subscription Activated").length;
  if (trialsStarted === 0) {
    return { status: "insufficient_data" };
  }
  return { status: "computed", trialsStarted, subscriptionsActivated, rate: subscriptionsActivated / trialsStarted };
}

/** Pure aggregation over already-fetched rows -- see lib/telemetry/dashboard.test.ts. */
export function computeTelemetryDashboardSummary(
  raw: { events: TelemetryEventRow[]; clinics: ClinicRow[] },
  range: DateRange,
): TelemetryDashboardSummary {
  const activation = computeActivation(raw.events, raw.clinics);
  return {
    range,
    activeUsers: computeActiveUsers(raw.events, new Date(range.to)),
    activation,
    featureAdoption: computeFeatureAdoption(raw.events, activation.totalClinics),
    mostUsedFeatures: computeMostUsedFeatures(raw.events),
    onboardingFunnel: computeOnboardingFunnel(raw.events),
    demoUsage: computeDemoUsage(raw.events),
    trialConversion: computeTrialConversion(raw.events),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Top-level, dashboard-facing entry point: fetches the raw datasets
 * (lib/telemetry/query.ts, resilient to partial failures on its own)
 * and runs the aggregation over them. Mirrors lib/analytics/dashboard.ts's
 * getDashboardSummary.
 */
export async function getTelemetryDashboardSummary(
  supabase: SupabaseClient,
  params: { range?: DateRange } = {},
): Promise<TelemetryDashboardSummary> {
  const range = params.range ?? defaultDateRange();
  const raw = await fetchTelemetryRawData(supabase, { range });
  return computeTelemetryDashboardSummary(raw, range);
}
