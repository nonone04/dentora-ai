import type { LLMMessage } from "@/lib/ai/llm/client";
import type { NLUClient } from "@/lib/ai/nlu/client";
import { BASE_REQUIRED_FIELDS, type NLUEntities, type NLUExtraction, type NLUIntent, type NLULanguage, type NLUUrgency } from "@/lib/ai/nlu/types";
import { clampConfidence, computeMissingFields } from "@/lib/ai/nlu/validate";

/**
 * Deterministic, no-network NLU extractor. Default when ANTHROPIC_API_KEY
 * isn't configured (true of this environment right now) -- same rationale
 * as MockLLMClient (lib/ai/llm/mock-client.ts): the rest of the system
 * (missing-field short-circuit, follow-up questions, logging) needs to be
 * exercisable and testable without a real model. Bilingual (en/fr) keyword
 * and pattern matching, with basic Arabic detection -- see clinics.
 * default_language / patients.preferred_language, which are constrained
 * to exactly ('ar', 'fr', 'en'). Not a substitute for the real model on
 * genuinely open-ended phrasing -- see AnthropicNLUClient for that.
 */
export class RuleBasedNLUClient implements NLUClient {
  async extract({ messages }: { messages: LLMMessage[]; clinicName: string }): Promise<NLUExtraction> {
    const rawMessage = lastUserMessage(messages);
    return extractWithRules(rawMessage);
  }
}

function lastUserMessage(messages: LLMMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

export function extractWithRules(message: string, now: Date = new Date()): NLUExtraction {
  const { intent, matchedByKeyword } = detectIntent(message);
  const entities = extractEntities(message, now);
  const urgency = detectUrgency(message);
  const language = detectLanguage(message);
  const confidence = computeConfidence(intent, entities, matchedByKeyword);

  return {
    intent,
    entities,
    urgency,
    language,
    confidence,
    missingFields: computeMissingFields(intent, entities),
    rawMessage: message,
  };
}

// ---------------------------------------------------------------------------
// Intent
// ---------------------------------------------------------------------------

type IntentRule = { intent: NLUIntent; keywords: string[] };

// Order matters: first match wins, so more specific intents (cancel,
// reschedule) are checked before the generic "book_appointment"/
// "rendez-vous" keywords they'd otherwise also match.
const INTENT_RULES: IntentRule[] = [
  {
    intent: "escalate_to_staff",
    keywords: [
      "speak to a human",
      "talk to a human",
      "real person",
      "human agent",
      "speak to someone",
      "speak with a person",
      "representative",
      "manager",
      "parler à quelqu'un",
      "un humain",
      "un agent",
    ],
  },
  { intent: "cancel_appointment", keywords: ["cancel", "annuler", "annulation"] },
  {
    intent: "reschedule_appointment",
    keywords: [
      "resched",
      "move my appointment",
      "change my appointment",
      "déplacer mon rendez-vous",
      "reporter mon rendez-vous",
      "changer mon rendez-vous",
    ],
  },
  {
    intent: "book_appointment",
    keywords: [
      "book",
      "make an appointment",
      "schedule an appointment",
      "prendre rendez-vous",
      "réserver",
      "rendez-vous",
    ],
  },
  {
    intent: "check_availability",
    keywords: ["available", "availability", "slot", "when can", "any openings", "disponib"],
  },
  {
    intent: "get_clinic_info",
    keywords: ["hours", "hour", "open", "address", "phone number", "contact", "location", "horaire", "adresse"],
  },
  {
    intent: "ask_faq",
    keywords: ["price", "cost", "how much", "combien", "prix", "service", "offer", "treatment options"],
  },
  { intent: "greeting", keywords: ["hi", "hello", "hey", "bonjour", "salut", "salam"] },
];

function detectIntent(text: string): { intent: NLUIntent; matchedByKeyword: boolean } {
  const lower = text.toLowerCase();

  for (const rule of INTENT_RULES) {
    const matched = rule.keywords.some((keyword) => lower.includes(keyword));
    if (!matched) continue;

    // A bare greeting keyword inside a longer message ("hi, I need to
    // cancel") isn't really a greeting -- but cancel/reschedule/etc.
    // are checked earlier in the list, so by the time we reach
    // "greeting" the message is either short or genuinely just a hello.
    if (rule.intent === "greeting" && lower.trim().split(/\s+/).length > 4) continue;

    return { intent: rule.intent, matchedByKeyword: true };
  }

  return { intent: "other", matchedByKeyword: false };
}

function computeConfidence(intent: NLUIntent, entities: NLUEntities, matchedByKeyword: boolean): number {
  let score = matchedByKeyword ? 0.5 : 0.25;

  const required = BASE_REQUIRED_FIELDS[intent];
  if (required.length > 0) {
    const filled = required.filter((field) => entities[field]).length;
    score += 0.4 * (filled / required.length);
  } else if (intent !== "other") {
    score += 0.2;
  }

  return clampConfidence(score);
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

const WEEKDAYS_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAYS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS_EN = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const SERVICE_KEYWORDS = [
  "cleaning",
  "nettoyage",
  "whitening",
  "blanchiment",
  "filling",
  "plombage",
  "root canal",
  "dévitalisation",
  "extraction",
  "checkup",
  "check-up",
  "check up",
  "consultation",
  "braces",
  "orthodontics",
  "orthodontie",
  "crown",
  "couronne",
  "implant",
  "x-ray",
  "radio",
  "scaling",
  "veneer",
  "facette",
];

function extractEntities(text: string, now: Date): NLUEntities {
  const dateMatch = extractDate(text, now);
  const textWithoutDate = stripMatch(text, dateMatch.matchedText);

  return {
    date: dateMatch.value,
    time: extractTime(text),
    service: extractService(text),
    dentist: extractDentist(text),
    patientName: extractPatientName(text),
    phone: extractPhone(textWithoutDate),
  };
}

function stripMatch(text: string, matchedText: string | null): string {
  if (!matchedText) return text;
  const escaped = matchedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "i"), " ");
}

type DateMatch = { value: string | null; matchedText: string | null };

function extractDate(text: string, now: Date): DateMatch {
  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return { value: isoMatch[1], matchedText: isoMatch[1] };

  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashMatch) {
    const [full, mm, dd, yyyy] = slashMatch;
    const candidate = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    if (!Number.isNaN(candidate.getTime())) return { value: toISODate(candidate), matchedText: full };
  }

  const lower = text.toLowerCase();

  if (/\bday after tomorrow\b|\baprès-demain\b/.test(lower)) {
    return { value: toISODate(addDaysUTC(now, 2)), matchedText: null };
  }
  if (/\btomorrow\b|\bdemain\b/.test(lower)) {
    return { value: toISODate(addDaysUTC(now, 1)), matchedText: null };
  }
  if (/\btoday\b|\baujourd'?hui\b/.test(lower)) {
    return { value: toISODate(now), matchedText: null };
  }

  for (let i = 0; i < 7; i += 1) {
    if (new RegExp(`\\b${WEEKDAYS_EN[i]}\\b`).test(lower) || new RegExp(`\\b${WEEKDAYS_FR[i]}\\b`).test(lower)) {
      return { value: toISODate(nextWeekday(now, i)), matchedText: null };
    }
  }

  const monthDayEn = lower.match(new RegExp(`\\b(${MONTHS_EN.join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (monthDayEn) {
    return {
      value: buildDateFromMonthDay(now, MONTHS_EN.indexOf(monthDayEn[1]), Number(monthDayEn[2])),
      matchedText: monthDayEn[0],
    };
  }

  const dayMonthEn = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS_EN.join("|")})\\b`));
  if (dayMonthEn) {
    return {
      value: buildDateFromMonthDay(now, MONTHS_EN.indexOf(dayMonthEn[2]), Number(dayMonthEn[1])),
      matchedText: dayMonthEn[0],
    };
  }

  const dayMonthFr = lower.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS_FR.join("|")})\\b`));
  if (dayMonthFr) {
    return {
      value: buildDateFromMonthDay(now, MONTHS_FR.indexOf(dayMonthFr[2]), Number(dayMonthFr[1])),
      matchedText: dayMonthFr[0],
    };
  }

  return { value: null, matchedText: null };
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function nextWeekday(now: Date, targetDayOfWeek: number): Date {
  const currentDayOfWeek = now.getUTCDay();
  let diff = (targetDayOfWeek - currentDayOfWeek + 7) % 7;
  if (diff === 0) diff = 7; // "next Tuesday" means the upcoming one, not today
  return addDaysUTC(now, diff);
}

function buildDateFromMonthDay(now: Date, monthIndex: number, day: number): string | null {
  if (monthIndex < 0 || day < 1 || day > 31) return null;

  const year = now.getUTCFullYear();
  let candidate = new Date(Date.UTC(year, monthIndex, day));
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (candidate.getTime() < startOfToday) {
    candidate = new Date(Date.UTC(year + 1, monthIndex, day));
  }
  return toISODate(candidate);
}

function extractTime(text: string): string | null {
  const lower = text.toLowerCase();

  const match12 = lower.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s?(am|pm)\b/);
  if (match12) {
    let hour = Number(match12[1]) % 12;
    if (match12[3] === "pm") hour += 12;
    const minute = match12[2] ?? "00";
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  const match24 = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (match24) {
    return `${match24[1].padStart(2, "0")}:${match24[2]}`;
  }

  if (/\bnoon\b|\bmidi\b/.test(lower)) return "12:00";
  if (/\bmorning\b|\bmatin\b/.test(lower)) return "morning";
  if (/\bafternoon\b|\baprès-midi\b/.test(lower)) return "afternoon";
  if (/\bevening\b|\bsoir\b/.test(lower)) return "evening";

  return null;
}

function extractPhone(text: string): string | null {
  const match = text.match(/(\+?\d[\d\s().-]{6,}\d)/);
  if (!match) return null;
  const digits = match[1].replace(/[^\d+]/g, "");
  return digits.replace(/[^\d]/g, "").length >= 7 ? digits : null;
}

function extractService(text: string): string | null {
  const lower = text.toLowerCase();
  return SERVICE_KEYWORDS.find((keyword) => lower.includes(keyword)) ?? null;
}

function extractDentist(text: string): string | null {
  const match = text.match(/\b(?:dr\.?|docteur)\s+([a-zà-ÿ]+(?:\s+[a-zà-ÿ]+)?)/i);
  if (!match) return null;
  return `Dr. ${toTitleCase(match[1])}`;
}

function extractPatientName(text: string): string | null {
  const patterns = [
    /\bmy name is\s+([a-zà-ÿ]+(?:\s+[a-zà-ÿ]+){0,2})/i,
    /\bthis is\s+([a-zà-ÿ]+(?:\s+[a-zà-ÿ]+){0,2})\s+speaking/i,
    /\bje m'appelle\s+([a-zà-ÿ]+(?:\s+[a-zà-ÿ]+){0,2})/i,
    /\bje suis\s+([a-zà-ÿ]+(?:\s+[a-zà-ÿ]+){0,2})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return toTitleCase(match[1]);
  }

  return null;
}

function toTitleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// ---------------------------------------------------------------------------
// Urgency + language
// ---------------------------------------------------------------------------

const EMERGENCY_KEYWORDS = [
  "emergency",
  "urgence",
  "can't stop bleeding",
  "cannot stop bleeding",
  "ne s'arrête pas de saigner",
  "knocked out",
  "swollen face",
  "visage enflé",
  "severe pain",
  "unbearable",
  "douleur insupportable",
];

const HIGH_URGENCY_KEYWORDS = ["urgent", "asap", "as soon as possible", "a lot of pain", "beaucoup de douleur", "throbbing"];

function detectUrgency(text: string): NLUUrgency {
  const lower = text.toLowerCase();
  if (EMERGENCY_KEYWORDS.some((keyword) => lower.includes(keyword))) return "emergency";
  if (HIGH_URGENCY_KEYWORDS.some((keyword) => lower.includes(keyword))) return "high";
  if (/\bpain\b|\bdouleur\b|\bhurts?\b|\bache\b|\bmal aux dents\b/.test(lower)) return "medium";
  return "low";
}

const ARABIC_RANGE = /[\u0600-\u06FF]/;
const FRENCH_MARKERS = [
  "bonjour",
  "merci",
  "rendez-vous",
  "s'il vous plaît",
  "svp",
  "aujourd'hui",
  "demain",
  "je voudrais",
  "je suis",
];

/**
 * Best-effort only, and deliberately limited to the clinic's actual
 * supported set (ar/fr/en -- see clinics.default_language). Never
 * returns "other": that's reserved for genuinely unparseable payloads
 * (see parseNLUExtraction), and for a rule-based fallback isn't a useful
 * signal since the same heuristic is doing the detecting either way.
 */
function detectLanguage(text: string): NLULanguage {
  if (ARABIC_RANGE.test(text)) return "ar";
  const lower = text.toLowerCase();
  if (FRENCH_MARKERS.some((marker) => lower.includes(marker))) return "fr";
  return "en";
}
