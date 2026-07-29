export const KNOWLEDGE_CATEGORIES = [
  "services",
  "pricing",
  "hours",
  "insurance",
  "payment_methods",
  "parking",
  "cancellation_policy",
  "faq",
  "emergency",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

/** The current version of one knowledge record -- see lib/ai/knowledge/store.ts for how it's created/updated/versioned. */
export type KnowledgeRecord = {
  id: string;
  clinicId: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  keywords: string[];
  isActive: boolean;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** One immutable snapshot from clinic_knowledge_record_versions -- the full content as it existed at that version. */
export type KnowledgeRecordVersion = {
  recordId: string;
  clinicId: string;
  version: number;
  category: KnowledgeCategory;
  title: string;
  content: string;
  keywords: string[];
  isActive: boolean;
  changedBy: string | null;
  changeReason: string | null;
  createdAt: string;
};

/** One scored candidate from lib/ai/knowledge/match.ts's deterministic search. */
export type KnowledgeMatch = {
  record: KnowledgeRecord;
  score: number;
};

/** The full result of a retrieval attempt -- `hit: false` is a first-class outcome, not an error, and is exactly what lib/ai/knowledge/prompt.ts's fallback grounding is built from. */
export type KnowledgeSearchResult = {
  query: string;
  category: KnowledgeCategory | null;
  matches: KnowledgeMatch[];
  hit: boolean;
};
