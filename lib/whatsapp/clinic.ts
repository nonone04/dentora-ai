import { createAdminClient } from "@/lib/supabase/admin";

export type WhatsAppClinicSummary = {
  id: string;
  name: string;
};

/**
 * Resolves which clinic a Meta Cloud API webhook message belongs to.
 * phone_number_id is a stable Graph API identifier (not the
 * human-readable display number), so this is a safe exact-match --
 * same narrow, admin-client escape hatch already used by
 * lib/ai/public-clinic.ts for resolving a clinic from an untrusted
 * external identifier (there, a slug; here, a phone_number_id).
 */
export async function getClinicForPhoneNumberId(phoneNumberId: string): Promise<WhatsAppClinicSummary | null> {
  if (!phoneNumberId) return null;

  const supabase = createAdminClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name")
    .eq("whatsapp_phone_number_id", phoneNumberId)
    .eq("is_active", true)
    .maybeSingle();

  return clinic ?? null;
}
