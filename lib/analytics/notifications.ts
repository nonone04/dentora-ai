import {
  NOTIFICATION_DELIVERY_CHANNEL_VALUES,
  NOTIFICATION_DELIVERY_STATUS_VALUES,
  type NotificationDeliveryChannelValue,
  type NotificationDeliveryStatusValue,
  type NotificationMetrics,
} from "@/lib/analytics/types";

export type DeliveryInput = { status: string; channel: string; attempts: number };

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function isStatus(value: string): value is NotificationDeliveryStatusValue {
  return (NOTIFICATION_DELIVERY_STATUS_VALUES as readonly string[]).includes(value);
}

function isChannel(value: string): value is NotificationDeliveryChannelValue {
  return (NOTIFICATION_DELIVERY_CHANNEL_VALUES as readonly string[]).includes(value);
}

const DELIVERED_STATUSES = new Set<NotificationDeliveryStatusValue>(["sent", "delivered", "read"]);

/**
 * Deterministic aggregation over notification_deliveries rows -- how
 * reliably patient/staff communications actually go out, broken down by
 * channel. Pure: no I/O, no knowledge of Supabase or of
 * lib/notifications' retry machinery beyond the final status column.
 */
export function computeNotificationMetrics(rows: DeliveryInput[]): NotificationMetrics {
  const byStatus = zeroRecord(NOTIFICATION_DELIVERY_STATUS_VALUES);
  const byChannel = zeroRecord(NOTIFICATION_DELIVERY_CHANNEL_VALUES);
  let attemptsSum = 0;

  for (const row of rows) {
    if (isStatus(row.status)) byStatus[row.status] += 1;
    if (isChannel(row.channel)) byChannel[row.channel] += 1;
    attemptsSum += row.attempts;
  }

  const total = rows.length;
  let delivered = 0;
  for (const status of NOTIFICATION_DELIVERY_STATUS_VALUES) {
    if (DELIVERED_STATUSES.has(status)) delivered += byStatus[status];
  }

  return {
    total,
    byStatus,
    byChannel,
    deliveryRate: total === 0 ? 0 : delivered / total,
    failureRate: total === 0 ? 0 : byStatus.failed / total,
    avgAttempts: total === 0 ? 0 : attemptsSum / total,
  };
}
