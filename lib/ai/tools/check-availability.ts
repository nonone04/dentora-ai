import { queryDentistAvailability } from "@/lib/ai/availability";
import { assertActionAllowed } from "@/lib/ai/permissions";
import type { AITool, AIToolContext } from "@/lib/ai/tools/types";
import { createAdminClient } from "@/lib/supabase/admin";

async function execute(args: Record<string, unknown>, context: AIToolContext) {
  await assertActionAllowed(context.clinicId, "check_availability");

  const date = typeof args.date === "string" ? args.date : null;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("A valid date (YYYY-MM-DD) is required.");
  }

  const supabase = createAdminClient();

  // Delegates to the shared Availability Engine (lib/ai/availability) --
  // the same slot-generation core the orchestrator's proactive
  // pre-tool-loop query uses, so this on-demand tool call and that
  // grounding data can never disagree about what's actually bookable.
  return queryDentistAvailability(supabase, {
    clinicId: context.clinicId,
    date,
    serviceId: typeof args.serviceId === "string" ? args.serviceId : null,
    dentistId: typeof args.dentistId === "string" ? args.dentistId : null,
  });
}

export const checkAvailabilityTool: AITool = {
  name: "check_availability",
  requiredAction: "check_availability",
  description:
    "Check available appointment slots for a given date, optionally filtered by dentist or service.",
  inputSchema: {
    type: "object",
    properties: {
      date: { type: "string", description: "Date in YYYY-MM-DD format." },
      dentistId: { type: "string", description: "Optional dentist id to check a specific dentist." },
      serviceId: { type: "string", description: "Optional service id, used to determine slot duration." },
    },
    required: ["date"],
  },
  execute,
};
