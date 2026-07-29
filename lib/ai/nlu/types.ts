/**
 * Structured Natural Language Understanding layer -- runs on every
 * inbound patient message before tool selection. Mirrors the shape of
 * lib/ai/actions.ts (a declarative vocabulary the rest of the system
 * consumes): purely types + data here, no extraction logic.
 */

export const NLU_INTENTS = [
  "book_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "check_availability",
  "ask_faq",
  "get_clinic_info",
  "escalate_to_staff",
  "greeting",
  "other",
] as const;

export type NLUIntent = (typeof NLU_INTENTS)[number];

export const NLU_URGENCIES = ["low", "medium", "high", "emergency"] as const;

export type NLUUrgency = (typeof NLU_URGENCIES)[number];

/** Matches the clinics.default_language / patients.preferred_language check constraints. */
export const SUPPORTED_LANGUAGES = ["ar", "fr", "en"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Detected but outside the clinic's supported set -- callers fall back to the clinic's default_language. */
export type NLULanguage = SupportedLanguage | "other";

export const NLU_ENTITY_FIELDS = ["date", "time", "service", "dentist", "patientName", "phone"] as const;

export type NLUEntityField = (typeof NLU_ENTITY_FIELDS)[number];

export type NLUEntities = {
  /** Normalized to YYYY-MM-DD when resolvable, otherwise the raw phrase (e.g. "next Tuesday"), otherwise null. */
  date: string | null;
  /** Normalized to 24h HH:MM when resolvable, otherwise the raw phrase, otherwise null. */
  time: string | null;
  /** Raw service/treatment phrase as mentioned by the patient (e.g. "cleaning", "root canal"). */
  service: string | null;
  /** Raw dentist name/reference as mentioned by the patient (e.g. "Dr. Amrani"). */
  dentist: string | null;
  patientName: string | null;
  phone: string | null;
};

export type NLUExtraction = {
  intent: NLUIntent;
  entities: NLUEntities;
  urgency: NLUUrgency;
  language: NLULanguage;
  /** Overall confidence in this extraction, 0..1. */
  confidence: number;
  /** Required fields (for this intent) that are still unresolved. Pure function of intent+entities -- see computeMissingFields. */
  missingFields: NLUEntityField[];
  /** The message this extraction was derived from, verbatim. */
  rawMessage: string;
};

export const EMPTY_ENTITIES: NLUEntities = {
  date: null,
  time: null,
  service: null,
  dentist: null,
  patientName: null,
  phone: null,
};

/**
 * Minimum entities a patient must have supplied in their message(s)
 * before the assistant can meaningfully act on the intent -- deliberately
 * narrower than a tool's own inputSchema (e.g. draft_appointment also
 * requires a dentistId), since the rest (dentist, exact time) is
 * negotiated through check_availability/draft_appointment in the normal
 * tool-selection loop, not demanded up front.
 */
export const BASE_REQUIRED_FIELDS: Record<NLUIntent, NLUEntityField[]> = {
  book_appointment: ["service", "date"],
  reschedule_appointment: ["date"],
  cancel_appointment: ["date"],
  check_availability: ["date"],
  ask_faq: [],
  get_clinic_info: [],
  escalate_to_staff: [],
  greeting: [],
  other: [],
};

/** Intents that need to know who the patient is before they can be actioned. */
export const PATIENT_IDENTIFYING_INTENTS: NLUIntent[] = [
  "book_appointment",
  "reschedule_appointment",
  "cancel_appointment",
];
