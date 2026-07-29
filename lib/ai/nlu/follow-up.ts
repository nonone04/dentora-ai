import { resolveResponseLanguage, type ResponseLanguage } from "@/lib/ai/nlu/language";
import type { NLUEntityField, NLULanguage } from "@/lib/ai/nlu/types";

const FIELD_PHRASES: Record<ResponseLanguage, Record<NLUEntityField, string>> = {
  en: {
    date: "what date works for you",
    time: "what time you'd prefer",
    service: "what treatment this is for",
    dentist: "which dentist you'd like to see",
    patientName: "your full name",
    phone: "the best phone number to reach you",
  },
  fr: {
    date: "quelle date vous convient",
    time: "quelle heure vous préférez",
    service: "pour quel soin",
    dentist: "quel dentiste vous préférez",
    patientName: "votre nom complet",
    phone: "le meilleur numéro pour vous joindre",
  },
  ar: {
    date: "التاريخ الذي يناسبك",
    time: "الوقت الذي تفضله",
    service: "نوع العلاج المطلوب",
    dentist: "الطبيب الذي تفضله",
    patientName: "اسمك الكامل",
    phone: "رقم الهاتف للتواصل معك",
  },
};

const INTROS: Record<ResponseLanguage, string> = {
  en: "Happy to help with that! Could you tell me",
  fr: "Avec plaisir ! Pouvez-vous me dire",
  ar: "يسعدني مساعدتك! هل يمكنك إخباري",
};

const CONNECTORS: Record<ResponseLanguage, string> = { en: " and ", fr: " et ", ar: " و " };

/**
 * Builds a single follow-up question covering every missing field at
 * once, so the assistant never interrogates a patient field-by-field.
 * Throws on an empty list -- callers (the orchestrator) only reach this
 * after already checking missingFields.length > 0.
 */
export function buildFollowUpQuestion(
  missingFields: NLUEntityField[],
  options: { language?: NLULanguage; clinicDefaultLanguage?: string | null } = {},
): string {
  if (missingFields.length === 0) {
    throw new Error("buildFollowUpQuestion requires at least one missing field.");
  }

  const lang = resolveResponseLanguage(options.language ?? "other", options.clinicDefaultLanguage);
  const phrases = missingFields.map((field) => FIELD_PHRASES[lang][field]);

  const joined =
    phrases.length === 1
      ? phrases[0]
      : `${phrases.slice(0, -1).join(", ")}${CONNECTORS[lang]}${phrases[phrases.length - 1]}`;

  return `${INTROS[lang]} ${joined}?`;
}
