"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

export type ActionFormState = { error?: string; success?: boolean } | undefined;

type ParsedEntry = { error: string } | { category: string | null; question: string; answer: string };

function parseKnowledgeBaseForm(formData: FormData): ParsedEntry {
  const question = formData.get("question");
  if (typeof question !== "string" || !question.trim()) {
    return { error: "Question is required." };
  }

  const answer = formData.get("answer");
  if (typeof answer !== "string" || !answer.trim()) {
    return { error: "Answer is required." };
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
    return { error: "Only clinic owners and admins can manage the knowledge base." };
  }

  const parsed = parseKnowledgeBaseForm(formData);
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
    return { error: "Only clinic owners and admins can manage the knowledge base." };
  }

  const parsed = parseKnowledgeBaseForm(formData);
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
