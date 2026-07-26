import { getClinicAISettings } from "@/lib/ai/settings";
import { checkAvailabilityTool } from "@/lib/ai/tools/check-availability";
import { draftAppointmentTool } from "@/lib/ai/tools/draft-appointment";
import { escalateToStaffTool } from "@/lib/ai/tools/escalate-to-staff";
import { getClinicInfoTool } from "@/lib/ai/tools/get-clinic-info";
import { listServicesTool } from "@/lib/ai/tools/list-services";
import type { AITool, AIToolContext } from "@/lib/ai/tools/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const ALL_TOOLS: AITool[] = [
  getClinicInfoTool,
  listServicesTool,
  checkAvailabilityTool,
  draftAppointmentTool,
  escalateToStaffTool,
];

/** Only the tools this clinic has actually enabled and allowlisted. */
export async function getToolsForClinic(clinicId: string): Promise<AITool[]> {
  const supabase = createAdminClient();
  const { data: clinic } = await supabase.from("clinics").select("settings").eq("id", clinicId).maybeSingle();
  const settings = getClinicAISettings(clinic?.settings as Record<string, unknown> | null);

  if (!settings.enabled) return [];

  return ALL_TOOLS.filter((tool) => settings.allowedActions?.includes(tool.requiredAction));
}

export async function executeTool(name: string, args: Record<string, unknown>, context: AIToolContext) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.execute(args, context);
}

export type { AITool, AIToolContext } from "@/lib/ai/tools/types";
