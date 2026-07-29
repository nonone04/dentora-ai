export { retrieveClinicKnowledge } from "@/lib/ai/knowledge/engine";
export { recordKnowledgeSearch } from "@/lib/ai/knowledge/log";
export { scoreRecord, searchKnowledge } from "@/lib/ai/knowledge/match";
export { buildKnowledgeSection } from "@/lib/ai/knowledge/prompt";
export { fetchActiveKnowledgeRecords } from "@/lib/ai/knowledge/query";
export {
  archiveKnowledgeRecord,
  createKnowledgeRecord,
  getKnowledgeRecordHistory,
  listKnowledgeRecords,
  updateKnowledgeRecord,
} from "@/lib/ai/knowledge/store";
export type { StoreOutcome } from "@/lib/ai/knowledge/store";
export { KNOWLEDGE_CATEGORIES } from "@/lib/ai/knowledge/types";
export type {
  KnowledgeCategory,
  KnowledgeMatch,
  KnowledgeRecord,
  KnowledgeRecordVersion,
  KnowledgeSearchResult,
} from "@/lib/ai/knowledge/types";
export { isKnowledgeCategory, parseKnowledgeRecordRow, parseKnowledgeRecordVersionRow } from "@/lib/ai/knowledge/validate";
export type { KnowledgeRecordRow, KnowledgeRecordVersionRow } from "@/lib/ai/knowledge/validate";
