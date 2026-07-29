import { KNOWLEDGE_CATEGORIES, type KnowledgeCategory, type KnowledgeRecord, type KnowledgeRecordVersion } from "@/lib/ai/knowledge/types";

export function isKnowledgeCategory(value: unknown): value is KnowledgeCategory {
  return typeof value === "string" && (KNOWLEDGE_CATEGORIES as readonly string[]).includes(value);
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Shape of a clinic_knowledge_records row as returned by supabase-js. */
export type KnowledgeRecordRow = {
  id: unknown;
  clinic_id: unknown;
  category: unknown;
  title: unknown;
  content: unknown;
  keywords: unknown;
  is_active: unknown;
  version: unknown;
  created_by: unknown;
  updated_by: unknown;
  created_at: unknown;
  updated_at: unknown;
};

/**
 * Validates + coerces an untrusted DB row into a typed KnowledgeRecord --
 * same defensive posture as every other *.validate.ts in lib/ai: a
 * malformed or partially-corrupt row degrades to safe per-field
 * defaults rather than throwing.
 */
export function parseKnowledgeRecordRow(row: KnowledgeRecordRow): KnowledgeRecord {
  return {
    id: typeof row.id === "string" ? row.id : "",
    clinicId: typeof row.clinic_id === "string" ? row.clinic_id : "",
    category: isKnowledgeCategory(row.category) ? row.category : "faq",
    title: typeof row.title === "string" ? row.title : "",
    content: typeof row.content === "string" ? row.content : "",
    keywords: toStringArray(row.keywords),
    isActive: typeof row.is_active === "boolean" ? row.is_active : true,
    version: typeof row.version === "number" ? row.version : 0,
    createdBy: typeof row.created_by === "string" ? row.created_by : null,
    updatedBy: typeof row.updated_by === "string" ? row.updated_by : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date(0).toISOString(),
  };
}

/** Shape of a clinic_knowledge_record_versions row. */
export type KnowledgeRecordVersionRow = {
  record_id: unknown;
  clinic_id: unknown;
  version: unknown;
  category: unknown;
  title: unknown;
  content: unknown;
  keywords: unknown;
  is_active: unknown;
  changed_by: unknown;
  change_reason: unknown;
  created_at: unknown;
};

export function parseKnowledgeRecordVersionRow(row: KnowledgeRecordVersionRow): KnowledgeRecordVersion {
  return {
    recordId: typeof row.record_id === "string" ? row.record_id : "",
    clinicId: typeof row.clinic_id === "string" ? row.clinic_id : "",
    version: typeof row.version === "number" ? row.version : 0,
    category: isKnowledgeCategory(row.category) ? row.category : "faq",
    title: typeof row.title === "string" ? row.title : "",
    content: typeof row.content === "string" ? row.content : "",
    keywords: toStringArray(row.keywords),
    isActive: typeof row.is_active === "boolean" ? row.is_active : true,
    changedBy: typeof row.changed_by === "string" ? row.changed_by : null,
    changeReason: typeof row.change_reason === "string" ? row.change_reason : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
  };
}
