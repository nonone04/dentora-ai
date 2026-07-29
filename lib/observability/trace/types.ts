export const TRACE_STEP_TYPES = [
  "message",
  "tool_call",
  "nlu_extraction",
  "decision",
  "availability_query",
  "knowledge_search",
  "lifecycle_event",
  "notification_event",
  "turn",
] as const;

export type TraceStepType = (typeof TRACE_STEP_TYPES)[number];

/** One reconstructed moment in a conversation's history, from any of the engines that logged something during it. */
export type TraceStep = {
  type: TraceStepType;
  timestamp: string;
  summary: string;
  data: Record<string, unknown>;
};

export type ConversationTrace = {
  conversationId: string;
  clinicId: string;
  channel: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  steps: TraceStep[];
};
