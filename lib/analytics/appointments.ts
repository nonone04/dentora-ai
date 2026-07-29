import {
  APPOINTMENT_SOURCE_VALUES,
  APPOINTMENT_STATUS_VALUES,
  type AppointmentMetrics,
  type AppointmentSourceValue,
  type AppointmentStatusValue,
} from "@/lib/analytics/types";

export type AppointmentMetricsInput = { status: string; source: string };

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function isStatus(value: string): value is AppointmentStatusValue {
  return (APPOINTMENT_STATUS_VALUES as readonly string[]).includes(value);
}

function isSource(value: string): value is AppointmentSourceValue {
  return (APPOINTMENT_SOURCE_VALUES as readonly string[]).includes(value);
}

/**
 * Deterministic aggregation over raw appointment rows -- counts by
 * status/source plus the derived rates staff actually care about
 * (no-show, cancellation, completion, AI-booked share). Pure: given the
 * same rows, always the same output, and never touches Supabase.
 */
export function computeAppointmentMetrics(rows: AppointmentMetricsInput[]): AppointmentMetrics {
  const byStatus = zeroRecord(APPOINTMENT_STATUS_VALUES);
  const bySource = zeroRecord(APPOINTMENT_SOURCE_VALUES);

  for (const row of rows) {
    if (isStatus(row.status)) byStatus[row.status] += 1;
    if (isSource(row.source)) bySource[row.source] += 1;
  }

  const total = rows.length;
  const settled = byStatus.completed + byStatus.no_show + byStatus.cancelled;

  return {
    total,
    byStatus,
    bySource,
    aiBookedRate: total === 0 ? 0 : bySource.ai_assistant / total,
    noShowRate: settled === 0 ? 0 : byStatus.no_show / settled,
    cancellationRate: total === 0 ? 0 : byStatus.cancelled / total,
    completionRate: settled === 0 ? 0 : byStatus.completed / settled,
  };
}
