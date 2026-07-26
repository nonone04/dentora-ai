import { assertActionAllowed } from "@/lib/ai/permissions";
import type { AITool, AIToolContext } from "@/lib/ai/tools/types";
import { serviceName } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

async function execute(_args: Record<string, unknown>, context: AIToolContext) {
  await assertActionAllowed(context.clinicId, "answer_faq");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("services")
    .select("id, name_translations, default_duration_minutes, price, currency")
    .eq("clinic_id", context.clinicId)
    .eq("is_active", true)
    .order("created_at");

  return (data ?? []).map((service) => ({
    id: service.id,
    name: serviceName(service.name_translations),
    durationMinutes: service.default_duration_minutes,
    price: service.price,
    currency: service.currency,
  }));
}

export const listServicesTool: AITool = {
  name: "list_services",
  requiredAction: "answer_faq",
  description: "List the clinic's active services with duration and price.",
  inputSchema: { type: "object", properties: {} },
  execute,
};
