import { resolveResponseLanguage, type ResponseLanguage } from "@/lib/ai/nlu/language";
import type { NLULanguage } from "@/lib/ai/nlu/types";

type ReplyOptions = { language?: NLULanguage; clinicDefaultLanguage?: string | null };

const GREETING_REPLIES: Record<ResponseLanguage, string> = {
  en: "Hello! How can I help you today?",
  fr: "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
  ar: "مرحبا! كيف يمكنني مساعدتك اليوم؟",
};

const ESCALATION_REPLIES: Record<ResponseLanguage, string> = {
  en: "Of course -- I'm connecting you with our team now, they'll follow up with you shortly.",
  fr: "Bien sûr -- je vous mets en relation avec notre équipe, elle vous recontactera très vite.",
  ar: "بالتأكيد -- سأقوم بتوصيلك بفريقنا الآن، وسيتواصلون معك قريبًا.",
};

const EMERGENCY_REPLIES: Record<ResponseLanguage, string> = {
  en: "This sounds like it could be a dental emergency. I'm connecting you with our clinic staff right away. If you're in immediate danger, please call emergency services or go to the nearest emergency room.",
  fr: "Cela ressemble à une urgence dentaire. Je vous mets en relation avec notre équipe immédiatement. En cas de danger immédiat, appelez les urgences ou rendez-vous à l'hôpital le plus proche.",
  ar: "يبدو أن هذه حالة طارئة في الأسنان. سأقوم بتوصيلك بفريق العيادة على الفور. إذا كنت في خطر مباشر، يرجى الاتصال بخدمات الطوارئ أو التوجه إلى أقرب غرفة طوارئ.",
};

function resolve(options: ReplyOptions): ResponseLanguage {
  return resolveResponseLanguage(options.language ?? "other", options.clinicDefaultLanguage);
}

export function buildGreetingReply(options: ReplyOptions = {}): string {
  return GREETING_REPLIES[resolve(options)];
}

export function buildEscalationReply(options: ReplyOptions = {}): string {
  return ESCALATION_REPLIES[resolve(options)];
}

export function buildEmergencyReply(options: ReplyOptions = {}): string {
  return EMERGENCY_REPLIES[resolve(options)];
}
