import type { AIActionName } from "@/lib/ai/actions";

export type ClinicAISettings = {
  enabled?: boolean;
  allowedActions?: AIActionName[];
};

export function getClinicAISettings(
  clinicSettings: Record<string, unknown> | null | undefined,
): ClinicAISettings {
  const ai = clinicSettings?.ai;
  if (ai && typeof ai === "object") {
    return ai as ClinicAISettings;
  }
  return {};
}
