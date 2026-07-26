import { assertActionAllowed } from "@/lib/ai/permissions";
import type { AITool, AIToolContext } from "@/lib/ai/tools/types";
import { getNotificationProvider } from "@/lib/notifications/provider";
import { createAdminClient } from "@/lib/supabase/admin";

async function execute(args: Record<string, unknown>, context: AIToolContext) {
  await assertActionAllowed(context.clinicId, "escalate_to_staff");

  const reason = typeof args.reason === "string" && args.reason.trim() ? args.reason.trim() : "No reason given.";

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
  // source of truth. A clinic without an email on file, or a delivery
  // failure, should never surface as an error to the patient.
  const { data: clinic } = await supabase.from("clinics").select("name, email").eq("id", context.clinicId).maybeSingle();
  if (clinic?.email) {
    await getNotificationProvider("email")
      .send({
        to: clinic.email,
        subject: `${clinic.name}: AI assistant needs staff attention`,
        body: `The AI assistant escalated a conversation and needs staff review.\n\nReason: ${reason}`,
      })
      .catch(() => undefined);
  }

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
