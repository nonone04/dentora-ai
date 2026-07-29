import { assertActionAllowed } from "@/lib/ai/permissions";
import type { AITool, AIToolContext } from "@/lib/ai/tools/types";
import { notifyEscalation } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The actual side effect of escalating a conversation -- marking it
 * escalated and notifying the clinic. Shared by this tool's execute()
 * (the LLM decides to escalate mid-conversation) and the Decision
 * Engine's deterministic escalate_to_staff/emergency_workflow verdicts
 * (lib/ai/orchestrator.ts), which reach this same effect without ever
 * going through the LLM tool loop. Callers are responsible for their own
 * assertActionAllowed check first -- this function assumes the caller is
 * already permitted.
 */
export async function performEscalation(context: AIToolContext, reason: string): Promise<void> {
  const supabase = createAdminClient();

  // The orchestrator's tool-call loop already logs an ai_messages
  // bookkeeping row (input/result) for every tool call, escalate_to_staff
  // included -- setting the conversation status is the one effect that's
  // actually specific to this tool.
  if (context.conversationId) {
    await supabase
      .from("ai_conversations")
      .update({ status: "escalated" })
      .eq("id", context.conversationId)
      .eq("clinic_id", context.clinicId);
  }

  // Best-effort only -- the conversation status change above is the
  // source of truth. Routed through the Notification & Communication
  // Platform (lib/notifications) rather than sending a message directly,
  // so this staff alert gets the same delivery tracking/retry as every
  // other notification. A clinic without an email on file, or a
  // delivery failure, should never surface as an error to the patient.
  await notifyEscalation(supabase, { clinicId: context.clinicId, conversationId: context.conversationId ?? null, reason }).catch(
    () => undefined,
  );
}

async function execute(args: Record<string, unknown>, context: AIToolContext) {
  await assertActionAllowed(context.clinicId, "escalate_to_staff");

  const reason = typeof args.reason === "string" && args.reason.trim() ? args.reason.trim() : "No reason given.";

  await performEscalation(context, reason);

  return { escalated: true };
}

export const escalateToStaffTool: AITool = {
  name: "escalate_to_staff",
  requiredAction: "escalate_to_staff",
  description:
    "Hand the conversation off to clinic staff when you can't help -- clinical questions, an upset patient, a request for a human, or a tool that keeps failing. Does not send any reply to the patient itself.",
  inputSchema: {
    type: "object",
    properties: {
      reason: { type: "string", description: "Brief explanation of why this needs a human." },
    },
    required: ["reason"],
  },
  execute,
};
