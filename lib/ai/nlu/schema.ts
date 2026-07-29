import { NLU_ENTITY_FIELDS, NLU_INTENTS, NLU_URGENCIES, SUPPORTED_LANGUAGES } from "@/lib/ai/nlu/types";

/** Name of the synthetic tool the real (Anthropic) NLU client forces the model to call. Never exposed to the patient-facing tool loop. */
export const NLU_EXTRACTION_TOOL_NAME = "extract_nlu";

const entityFieldSchema = { type: ["string", "null"] as const };

export const NLU_EXTRACTION_TOOL_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    intent: { type: "string", enum: [...NLU_INTENTS] },
    entities: {
      type: "object",
      properties: Object.fromEntries(NLU_ENTITY_FIELDS.map((field) => [field, entityFieldSchema])),
      required: [...NLU_ENTITY_FIELDS],
    },
    urgency: { type: "string", enum: [...NLU_URGENCIES] },
    language: { type: "string", enum: [...SUPPORTED_LANGUAGES, "other"] },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Your honest confidence in this whole extraction, 0 (guessing) to 1 (certain).",
    },
  },
  required: ["intent", "entities", "urgency", "language", "confidence"],
};
