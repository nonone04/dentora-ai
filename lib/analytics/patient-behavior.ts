import { PREFERRED_CHANNEL_VALUES, RELIABILITY_LABEL_VALUES, type PatientBehaviorMetrics, type PreferredChannelValue, type ReliabilityLabelValue } from "@/lib/analytics/types";

export type PatientProfileInput = {
  reliability_label: string;
  reliability_score: number;
  preferred_channel: string | null;
  created_at: string;
};

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function isReliabilityLabel(value: string): value is ReliabilityLabelValue {
  return (RELIABILITY_LABEL_VALUES as readonly string[]).includes(value);
}

function isPreferredChannel(value: string): value is PreferredChannelValue {
  return (PREFERRED_CHANNEL_VALUES as readonly string[]).includes(value);
}

/**
 * Deterministic aggregation over patient_profiles rows -- reliability
 * distribution, learned channel preference, and a new-vs-returning
 * split (a profile first computed within the range is treated as a
 * newly-active patient; patient_profiles has no better proxy for "new"
 * since patients.created_at isn't necessarily when they became active).
 * Pure: no I/O, no knowledge of Supabase.
 */
export function computePatientBehaviorMetrics(rows: PatientProfileInput[], params: { rangeFrom: string }): PatientBehaviorMetrics {
  const byReliabilityLabel = zeroRecord(RELIABILITY_LABEL_VALUES);
  const byPreferredChannel: Partial<Record<PreferredChannelValue, number>> = {};
  let scoreSum = 0;
  let newPatients = 0;

  for (const row of rows) {
    if (isReliabilityLabel(row.reliability_label)) byReliabilityLabel[row.reliability_label] += 1;
    if (row.preferred_channel && isPreferredChannel(row.preferred_channel)) {
      byPreferredChannel[row.preferred_channel] = (byPreferredChannel[row.preferred_channel] ?? 0) + 1;
    }
    scoreSum += row.reliability_score;
    if (row.created_at >= params.rangeFrom) newPatients += 1;
  }

  const totalPatients = rows.length;

  return {
    totalPatients,
    byReliabilityLabel,
    byPreferredChannel,
    newPatients,
    returningPatients: totalPatients - newPatients,
    avgReliabilityScore: totalPatients === 0 ? 0 : scoreSum / totalPatients,
  };
}
