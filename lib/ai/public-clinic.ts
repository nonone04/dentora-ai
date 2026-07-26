import { getClinicAISettings } from "@/lib/ai/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublicClinicSummary = {
  id: string;
  name: string;
  slug: string;
};

/**
 * The only clinic fields the public chat surface (page + API route) is
 * allowed to see. clinics_select RLS is scoped to auth_user_clinic_ids(),
 * so an anonymous patient session has no read path there at all -- this
 * is a narrow, admin-client escape hatch (same justification as the AI
 * tools in lib/ai/tools/), not a way around that policy for staff-facing
 * code.
 */
export async function getPublicClinicForChat(slug: string): Promise<PublicClinicSummary | null> {
  if (!slug) return null;

  const supabase = createAdminClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, slug, is_active, settings")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!clinic) return null;

  const aiSettings = getClinicAISettings(clinic.settings as Record<string, unknown> | null);
  if (!aiSettings.enabled) return null;

  return { id: clinic.id, name: clinic.name, slug: clinic.slug };
}
