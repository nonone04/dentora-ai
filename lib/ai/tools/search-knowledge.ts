import { KNOWLEDGE_CATEGORIES, retrieveClinicKnowledge, type KnowledgeCategory } from "@/lib/ai/knowledge";
import { assertActionAllowed } from "@/lib/ai/permissions";
import type { AITool, AIToolContext } from "@/lib/ai/tools/types";
import { createAdminClient } from "@/lib/supabase/admin";

async function execute(args: Record<string, unknown>, context: AIToolContext) {
  await assertActionAllowed(context.clinicId, "answer_faq");

  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) throw new Error("query is required.");

  const category =
    typeof args.category === "string" && (KNOWLEDGE_CATEGORIES as readonly string[]).includes(args.category)
      ? (args.category as KnowledgeCategory)
      : null;

  const supabase = createAdminClient();

  const result = await retrieveClinicKnowledge(supabase, {
    clinicId: context.clinicId,
    query,
    category,
    conversationId: context.conversationId ?? null,
  });

  return {
    hit: result.hit,
    matches: result.matches.map((match) => ({
      category: match.record.category,
      title: match.record.title,
      content: match.record.content,
      score: match.score,
    })),
  };
}

export const searchKnowledgeTool: AITool = {
  name: "search_knowledge",
  requiredAction: "answer_faq",
  description:
    "Search the clinic's structured knowledge base (services, pricing, hours, insurance, payment methods, parking, cancellation policy, FAQs, emergency guidance) for records relevant to a specific question. Returns only matching records, or hit: false when nothing is documented -- never guess when this returns no matches.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The patient's question, in their own words." },
      category: {
        type: "string",
        enum: [...KNOWLEDGE_CATEGORIES],
        description: "Optional -- narrow the search to one knowledge category if it's clear from context.",
      },
    },
    required: ["query"],
  },
  execute,
};
