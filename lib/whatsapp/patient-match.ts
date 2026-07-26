import { createAdminClient } from "@/lib/supabase/admin";

function lastDigits(phone: string, count: number): string {
  return phone.replace(/\D/g, "").slice(-count);
}

/**
 * Best-effort, read-only match of a WhatsApp sender to an existing
 * patient record -- never creates one. Compares the last 9 digits of
 * each stored patients.phone against the incoming wa_id to absorb
 * +country-code/formatting differences without a full phone-parsing
 * library. Same spirit as anonymous web_chat leaving patientId unset:
 * this just gives WhatsApp a real number to try matching against for
 * free, since the platform hands us one; staff still resolve identity
 * during draft review either way.
 */
export async function findPatientIdByPhone(clinicId: string, waPhone: string): Promise<string | undefined> {
  const suffix = lastDigits(waPhone, 9);
  if (suffix.length < 9) return undefined;

  const supabase = createAdminClient();
  const { data: patients } = await supabase
    .from("patients")
    .select("id, phone")
    .eq("clinic_id", clinicId)
    .not("phone", "is", null);

  const match = (patients ?? []).find((patient) => patient.phone && lastDigits(patient.phone, 9) === suffix);
  return match?.id;
}
