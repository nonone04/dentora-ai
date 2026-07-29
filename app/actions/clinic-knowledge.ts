"use server";

import { revalidatePath } from "next/cache";
import {
  archiveKnowledgeRecord,
  createKnowledgeRecord,
  KNOWLEDGE_CATEGORIES,
  updateKnowledgeRecord,
  type KnowledgeCategory,
} from "@/lib/ai/knowledge";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

/**
 * Staff-facing management API for the Clinic Knowledge Engine
 * (lib/ai/knowledge) -- lets owners/admins add, edit, and retire the
 * structured records the AI retrieves from, entirely independent of any
 * prompt template. Same shape/conventions as app/actions/
 * knowledge-base.ts (the older, unstructured knowledge_base_entries
 * system, left untouched) and app/actions/appointment-drafts.ts:
 * requireManager gates the action itself, and the RLS policy on
 * clinic_knowledge_records is the actual backstop -- see
 * lib/ai/knowledge/store.ts's "forbidden" outcome.
 */
export type KnowledgeActionState = { error?: string; success?: boolean } | undefined;

function parseCategory(value: FormDataEntryValue | null): KnowledgeCategory | null {
  return typeof value === "string" && (KNOWLEDGE_CATEGORIES as readonly string[]).includes(value)
    ? (value as KnowledgeCategory)
    : null;
}

function parseKeywords(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

export async function createKnowledgeRecordAction(
  clinicId: string,
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const user = await requireManager(clinicId);
  if (!user) {
    return { error: "Only clinic owners and admins can manage clinic knowledge." };
  }

  const category = parseCategory(formData.get("category"));
  if (!category) return { error: "A valid category is required." };

  const title = formData.get("title");
  if (typeof title !== "string" || !title.trim()) return { error: "Title is required." };

  const content = formData.get("content");
  if (typeof content !== "string" || !content.trim()) return { error: "Content is required." };

  const supabase = await createClient();
  const outcome = await createKnowledgeRecord(supabase, {
    clinicId,
    category,
    title: title.trim(),
    content: content.trim(),
    keywords: parseKeywords(formData.get("keywords")),
    actorId: user.id,
  });

  if (!outcome.ok) {
    return { error: "Could not create this knowledge record." };
  }

  revalidatePath(`/clinic/${clinicId}/knowledge-base`);
  return { success: true };
}

export async function updateKnowledgeRecordAction(
  clinicId: string,
  recordId: string,
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const user = await requireManager(clinicId);
  if (!user) {
    return { error: "Only clinic owners and admins can manage clinic knowledge." };
  }

  const expectedVersion = Number(formData.get("expectedVersion"));
  if (!Number.isFinite(expectedVersion)) {
    return { error: "Missing the record's current version -- reload the page and try again." };
  }

  const category = parseCategory(formData.get("category"));
  const title = formData.get("title");
  const content = formData.get("content");

  const patch: Parameters<typeof updateKnowledgeRecord>[1]["patch"] = {};
  if (category) patch.category = category;
  if (typeof title === "string" && title.trim()) patch.title = title.trim();
  if (typeof content === "string" && content.trim()) patch.content = content.trim();
  if (formData.has("keywords")) patch.keywords = parseKeywords(formData.get("keywords"));

  const supabase = await createClient();
  const outcome = await updateKnowledgeRecord(supabase, {
    clinicId,
    recordId,
    expectedVersion,
    patch,
    actorId: user.id,
    changeReason: "Updated by staff",
  });

  if (!outcome.ok) {
    if (outcome.reason === "not_found") return { error: "This knowledge record no longer exists." };
    if (outcome.reason === "conflict") return { error: "Someone else updated this record -- reload and try again." };
    return { error: "Could not update this knowledge record." };
  }

  revalidatePath(`/clinic/${clinicId}/knowledge-base`);
  return { success: true };
}

export async function archiveKnowledgeRecordAction(
  clinicId: string,
  recordId: string,
  _prevState: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const user = await requireManager(clinicId);
  if (!user) {
    return { error: "Only clinic owners and admins can manage clinic knowledge." };
  }

  const expectedVersion = Number(formData.get("expectedVersion"));
  if (!Number.isFinite(expectedVersion)) {
    return { error: "Missing the record's current version -- reload the page and try again." };
  }

  const supabase = await createClient();
  const outcome = await archiveKnowledgeRecord(supabase, { clinicId, recordId, expectedVersion, actorId: user.id });

  if (!outcome.ok) {
    if (outcome.reason === "not_found") return { error: "This knowledge record no longer exists." };
    if (outcome.reason === "conflict") return { error: "Someone else updated this record -- reload and try again." };
    return { error: "Could not remove this knowledge record." };
  }

  revalidatePath(`/clinic/${clinicId}/knowledge-base`);
  return { success: true };
}
