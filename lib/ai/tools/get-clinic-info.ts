import { assertActionAllowed } from "@/lib/ai/permissions";
import type { AITool, AIToolContext } from "@/lib/ai/tools/types";
import { createAdminClient } from "@/lib/supabase/admin";

async function execute(_args: Record<string, unknown>, context: AIToolContext) {
  await assertActionAllowed(context.clinicId, "answer_faq");

  const supabase = createAdminClient();

  const [{ data: clinic }, { data: entries }] = await Promise.all([
    supabase
      .from("clinics")
      .select("name, phone, whatsapp_number, email, address, city, timezone, default_language")
      .eq("id", context.clinicId)
      .single(),
    supabase
      .from("knowledge_base_entries")
      .select("category, question, answer")
      .eq("clinic_id", context.clinicId)
      .eq("is_active", true),
  ]);

  return { clinic, faq: entries ?? [] };
}

export const getClinicInfoTool: AITool = {
  name: "get_clinic_info",
  requiredAction: "answer_faq",
  description:
    "Get the clinic's contact details, address, and its knowledge base of frequently asked questions.",
  inputSchema: { type: "object", properties: {} },
  execute,
};
