import { findDentistMatch, findServiceMatch } from "@/lib/ai/availability/match";
import type { createAdminClient } from "@/lib/supabase/admin";

/** Resolves a patient's stated service (raw NLU text) to a real services.id for this clinic -- null (not thrown) when nothing matches, so callers can fall back to the default duration. */
export async function resolveServiceId(
  supabase: ReturnType<typeof createAdminClient>,
  clinicId: string,
  serviceText: string | null | undefined,
): Promise<string | null> {
  if (!serviceText) return null;

  const { data } = await supabase
    .from("services")
    .select("id, name_translations")
    .eq("clinic_id", clinicId)
    .eq("is_active", true);

  const candidates = (data ?? []).map((service) => ({
    id: service.id as string,
    nameTranslations: service.name_translations as Record<string, string> | null,
  }));

  return findServiceMatch(candidates, serviceText);
}

/** Resolves a patient's stated dentist (raw NLU text, e.g. "Dr. Amrani") to a real dentists.id for this clinic -- null when nothing matches, so callers can fall back to searching every active dentist. */
export async function resolveDentistId(
  supabase: ReturnType<typeof createAdminClient>,
  clinicId: string,
  dentistText: string | null | undefined,
): Promise<string | null> {
  if (!dentistText) return null;

  const { data } = await supabase.from("dentists").select("id, full_name").eq("clinic_id", clinicId).eq("is_active", true);

  return findDentistMatch((data ?? []).map((d) => ({ id: d.id, fullName: d.full_name })), dentistText);
}
