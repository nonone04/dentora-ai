import type { AIActionName } from "@/lib/ai/actions";
import type { AvailabilityResult } from "@/lib/ai/availability/types";
import type { KnowledgeSearchResult } from "@/lib/ai/knowledge/types";
import type { PatientProfile } from "@/lib/ai/patient/types";
import type { ConversationState } from "@/lib/ai/state/types";

export type AIToolContext = {
  clinicId: string;
  conversationId?: string;
  /** This conversation's accumulated Conversation State Engine state (lib/ai/state), for tools that want it. Optional -- not every caller (e.g. direct debug/test invocations) has one to pass. */
  conversationState?: ConversationState;
  /** The Availability Engine's ranked result for this turn (lib/ai/availability), when the turn was appointment-related and a date was known. Optional -- null/absent whenever the engine didn't run. */
  availability?: AvailabilityResult | null;
  /** The Patient Intelligence Engine's profile (lib/ai/patient) for this turn's patient, when known. Optional -- null/absent for an unidentified patient or when the engine didn't run. */
  patientProfile?: PatientProfile | null;
  /** The Clinic Knowledge Engine's retrieval result for this turn (lib/ai/knowledge), when the intent was knowledge-relevant. Optional -- null/absent whenever the engine didn't run. */
  knowledge?: KnowledgeSearchResult | null;
};

export type AITool = {
  /** What the LLM calls this tool by. */
  name: string;
  /** Which Phase 11 AI_ACTIONS permission gates this tool -- checked fresh on every call. */
  requiredAction: AIActionName;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context: AIToolContext) => Promise<unknown>;
};
