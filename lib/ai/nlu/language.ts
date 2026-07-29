import type { NLULanguage } from "@/lib/ai/nlu/types";

/**
 * The subset of NLULanguage we actually have patient-facing copy for --
 * matches clinics.default_language / patients.preferred_language exactly.
 * Shared by every deterministic (non-LLM) reply template: follow-up
 * questions (lib/ai/nlu/follow-up.ts) and Decision Engine replies
 * (lib/ai/decision/replies.ts).
 */
export type ResponseLanguage = "en" | "fr" | "ar";

export function isResponseLanguage(value: string): value is ResponseLanguage {
  return value === "en" || value === "fr" || value === "ar";
}

/** "other" (detected language outside ar/fr/en) or an unrecognized clinic default both fall back to English. */
export function resolveResponseLanguage(language: NLULanguage, clinicDefaultLanguage?: string | null): ResponseLanguage {
  if (isResponseLanguage(language)) return language;
  if (clinicDefaultLanguage && isResponseLanguage(clinicDefaultLanguage)) return clinicDefaultLanguage;
  return "en";
}
