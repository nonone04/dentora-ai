"use server";

import { revalidatePath } from "next/cache";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

export type ActionFormState = { error?: string; success?: boolean } | undefined;

type ParsedEntry = { error: string } | { category: string | null; question: string; answer: string };

async function parseKnowledgeBaseForm(formData: FormData): Promise<ParsedEntry> {
  const t = await getServerDictionary();

  const question = formData.get("question");
  if (typeof question !== "string" || !question.trim()) {
    return { error: t.validation.questionRequired };
  }

  const answer = formData.get("answer");
  if (typeof answer !== "string" || !answer.trim()) {
    return { error: t.validation.answerRequired };
  }

  const categoryRaw = formData.get("category");
  const category = typeof categoryRaw === "string" && categoryRaw.trim() ? categoryRaw.trim() : null;

  return { category, question: question.trim(), answer: answer.trim() };
}

export async function createKnowledgeBaseEntry(
  clinicId: string,
  _prevState: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  const user = await requireManager(clinicId);
  if (!user) {
    const t = await getServerDictionary();
    return { error: t.validation.managersOnlyKnowledgeBase };
  }

  const parsed = await parseKnowledgeBaseForm(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("knowledge_base_entries").insert({
    clinic_id: clinicId,
    category: parsed.category,
    question: parsed.question,
    answer: parsed.answer,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clinic/${clinicId}/knowledge-base`);
  return { success: true };
}

export async function updateKnowledgeBaseEntry(
  clinicId: string,
  entryId: string,
  _prevState: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  const user = await requireManager(clinicId);
  if (!user) {
    const t = await getServerDictionary();
    return { error: t.validation.managersOnlyKnowledgeBase };
  }

  const parsed = await parseKnowledgeBaseForm(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const isActive = formData.get("isActive") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("knowledge_base_entries")
    .update({
      category: parsed.category,
      question: parsed.question,
      answer: parsed.answer,
      is_active: isActive,
    })
    .eq("id", entryId)
    .eq("clinic_id", clinicId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clinic/${clinicId}/knowledge-base`);
  return { success: true };
}
