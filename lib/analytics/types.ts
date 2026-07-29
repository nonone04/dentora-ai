/** Inclusive ISO datetime bounds. Every query/aggregation in lib/analytics is scoped to one of these. */
export type DateRange = { from: string; to: string };

export const APPOINTMENT_STATUS_VALUES = ["scheduled", "confirmed", "cancelled", "completed", "no_show"] as const;
export type AppointmentStatusValue = (typeof APPOINTMENT_STATUS_VALUES)[number];

export const APPOINTMENT_SOURCE_VALUES = ["staff", "ai_assistant"] as const;
export type AppointmentSourceValue = (typeof APPOINTMENT_SOURCE_VALUES)[number];

export type AppointmentMetrics = {
  total: number;
  byStatus: Record<AppointmentStatusValue, number>;
  bySource: Record<AppointmentSourceValue, number>;
  /** Share of ALL appointments booked by the AI assistant (0-1). */
  aiBookedRate: number;
  /** Share of settled appointments (completed/no_show/cancelled) that ended in no_show. */
  noShowRate: number;
  /** Share of all appointments that were cancelled. */
  cancellationRate: number;
  /** Share of settled appointments that completed successfully. */
  completionRate: number;
};

export const AI_TURN_OUTCOME_VALUES = ["reply", "tool_calls_exhausted", "llm_error", "escalated"] as const;
export type AITurnOutcomeValue = (typeof AI_TURN_OUTCOME_VALUES)[number];

export const AI_DECISION_KIND_VALUES = ["ask_follow_up", "execute_tool", "escalate_to_staff", "emergency_workflow", "reply_directly"] as const;
export type AIDecisionKindValue = (typeof AI_DECISION_KIND_VALUES)[number];

export const AI_NLU_INTENT_VALUES = [
  "book_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "check_availability",
  "ask_faq",
  "get_clinic_info",
  "escalate_to_staff",
  "greeting",
  "other",
] as const;
export type AINluIntentValue = (typeof AI_NLU_INTENT_VALUES)[number];

export type AIResolutionMetrics = {
  totalTurns: number;
  byOutcome: Record<AITurnOutcomeValue, number>;
  totalDecisions: number;
  byDecisionKind: Record<AIDecisionKindValue, number>;
  byIntent: Record<AINluIntentValue, number>;
  /** Share of decisions handled without human involvement (execute_tool + reply_directly + ask_follow_up). */
  autoResolvedRate: number;
  /** Share of decisions that escalated to staff (escalate_to_staff + emergency_workflow). */
  escalationRate: number;
  /** Share of turns that ended in llm_error or tool_calls_exhausted. */
  errorRate: number;
  avgConfidence: number;
  avgLatencyMs: number;
};

export const NOTIFICATION_DELIVERY_STATUS_VALUES = ["pending", "sending", "sent", "delivered", "read", "failed"] as const;
export type NotificationDeliveryStatusValue = (typeof NOTIFICATION_DELIVERY_STATUS_VALUES)[number];

export const NOTIFICATION_DELIVERY_CHANNEL_VALUES = ["email", "sms", "whatsapp", "in_app"] as const;
export type NotificationDeliveryChannelValue = (typeof NOTIFICATION_DELIVERY_CHANNEL_VALUES)[number];

export type NotificationMetrics = {
  total: number;
  byStatus: Record<NotificationDeliveryStatusValue, number>;
  byChannel: Record<NotificationDeliveryChannelValue, number>;
  /** Share of deliveries that reached sent/delivered/read (i.e. not pending/sending/failed). */
  deliveryRate: number;
  /** Share of deliveries that ended permanently failed. */
  failureRate: number;
  avgAttempts: number;
};

export const RELIABILITY_LABEL_VALUES = ["excellent", "good", "fair", "poor", "insufficient_data"] as const;
export type ReliabilityLabelValue = (typeof RELIABILITY_LABEL_VALUES)[number];

export const PREFERRED_CHANNEL_VALUES = ["email", "sms", "whatsapp"] as const;
export type PreferredChannelValue = (typeof PREFERRED_CHANNEL_VALUES)[number];

export type PatientBehaviorMetrics = {
  totalPatients: number;
  byReliabilityLabel: Record<ReliabilityLabelValue, number>;
  byPreferredChannel: Partial<Record<PreferredChannelValue, number>>;
  /** Profiles first computed within the range -- a proxy for newly-active patients, since patients has no reliable "first appointment" column of its own. */
  newPatients: number;
  returningPatients: number;
  avgReliabilityScore: number;
};

export type DashboardSummary = {
  clinicId: string;
  range: DateRange;
  appointments: AppointmentMetrics;
  aiResolution: AIResolutionMetrics;
  notifications: NotificationMetrics;
  patientBehavior: PatientBehaviorMetrics;
  generatedAt: string;
};
