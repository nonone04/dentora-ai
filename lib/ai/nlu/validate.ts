import {
  BASE_REQUIRED_FIELDS,
  EMPTY_ENTITIES,
  NLU_ENTITY_FIELDS,
  NLU_INTENTS,
  NLU_URGENCIES,
  PATIENT_IDENTIFYING_INTENTS,
  SUPPORTED_LANGUAGES,
  type NLUEntities,
  type NLUEntityField,
  type NLUExtraction,
  type NLUIntent,
  type NLULanguage,
  type NLUUrgency,
} from "@/lib/ai/nlu/types";

export function isNLUIntent(value: unknown): value is NLUIntent {
  return typeof value === "string" && (NLU_INTENTS as readonly string[]).includes(value);
}

export function isNLUUrgency(value: unknown): value is NLUUrgency {
  return typeof value === "string" && (NLU_URGENCIES as readonly string[]).includes(value);
}

export function isNLULanguage(value: unknown): value is NLULanguage {
  return value === "other" || (typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value));
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Clamp to [0, 1] and fall back to 0 for anything that isn't a finite number -- an untrusted LLM/tool-call payload. */
export function clampConfidence(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(1, Math.max(0, num));
}

/** Coerces an untrusted raw entities payload into the typed shape -- unknown/wrong-typed fields become null rather than throwing. */
export function normalizeEntities(raw: unknown): NLUEntities {
  if (!raw || typeof raw !== "object") return { ...EMPTY_ENTITIES };
  const source = raw as Record<string, unknown>;
  return {
    date: toNullableString(source.date),
    time: toNullableString(source.time),
    service: toNullableString(source.service),
    dentist: toNullableString(source.dentist),
    patientName: toNullableString(source.patientName),
    phone: toNullableString(source.phone),
  };
}

/**
 * Which required-for-this-intent fields are still unresolved. Pure
 * function of intent + entities (+ whether the patient is already known
 * from conversation context) -- always recomputed rather than trusted
 * from an upstream payload, so it can't drift from BASE_REQUIRED_FIELDS.
 */
export function computeMissingFields(
  intent: NLUIntent,
  entities: NLUEntities,
  options: { patientKnown?: boolean } = {},
): NLUEntityField[] {
  const required = new Set<NLUEntityField>(BASE_REQUIRED_FIELDS[intent]);

  if (
    PATIENT_IDENTIFYING_INTENTS.includes(intent) &&
    !options.patientKnown &&
    !entities.patientName &&
    !entities.phone
  ) {
    required.add("patientName");
  }

  return NLU_ENTITY_FIELDS.filter((field) => required.has(field) && !entities[field]);
}

/**
 * Validates + coerces an untrusted raw payload (an LLM tool-call input,
 * or a rule-based extractor's output) into a typed NLUExtraction.
 * missingFields is always recomputed here rather than trusted from the
 * input -- see computeMissingFields.
 */
export function parseNLUExtraction(raw: unknown, rawMessage: string): NLUExtraction {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const intent = isNLUIntent(source.intent) ? source.intent : "other";
  const entities = normalizeEntities(source.entities);
  const urgency = isNLUUrgency(source.urgency) ? source.urgency : "low";
  const language = isNLULanguage(source.language) ? source.language : "other";
  const confidence = clampConfidence(source.confidence);

  return {
    intent,
    entities,
    urgency,
    language,
    confidence,
    missingFields: computeMissingFields(intent, entities),
    rawMessage,
  };
}
