import { AI_ACTIONS, type AIActionName } from "@/lib/ai/actions";
import { getClinicAISettings } from "@/lib/ai/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export class AIPermissionError extends Error {}

/**
 * Hard gate every tool must pass before doing anything else. Always
 * re-reads the clinic's settings fresh (no caching) so a clinic that
 * just disabled AI, or removed an action from its allowlist, takes
 * effect immediately -- there's no RLS backstop here (see
 * lib/ai/tools/), so this check is the actual enforcement.
 */
export async function assertActionAllowed(clinicId: string, action: AIActionName): Promise<void> {
  if (!AI_ACTIONS.some((definition) => definition.name === action)) {
    throw new AIPermissionError(`Unknown AI action: ${action}`);
  }

  const supabase = createAdminClient();
  const { data: clinic, error } = await supabase
    .from("clinics")
    .select("id, settings")
    .eq("id", clinicId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !clinic) {
    throw new AIPermissionError("Clinic not found or inactive.");
  }

  const settings = getClinicAISettings(clinic.settings as Record<string, unknown> | null);

  if (!settings.enabled) {
    throw new AIPermissionError("AI assistant is not enabled for this clinic.");
  }

  if (!settings.allowedActions?.includes(action)) {
    throw new AIPermissionError(`Action "${action}" is not allowed for this clinic.`);
  }
}
