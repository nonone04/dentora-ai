"use server";

import { revalidatePath } from "next/cache";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

export type ActionFormState = { error?: string; success?: boolean } | undefined;

function buildNameTranslations(formData: FormData) {
  const fr = formData.get("nameFr");
  const ar = formData.get("nameAr");
  const en = formData.get("nameEn");
  const translations: Record<string, string> = {};
  if (typeof fr === "string" && fr.trim()) translations.fr = fr.trim();
  if (typeof ar === "string" && ar.trim()) translations.ar = ar.trim();
  if (typeof en === "string" && en.trim()) translations.en = en.trim();
  return translations;
}

type ParsedService =
  | { error: string }
  | { translations: Record<string, string>; duration: number; price: number | null; currency: string };

async function parseServiceForm(formData: FormData): Promise<ParsedService> {
  const t = await getServerDictionary();

  const translations = buildNameTranslations(formData);
  if (Object.keys(translations).length === 0) {
    return { error: t.validation.serviceNameRequired };
  }

  const duration = Number(formData.get("defaultDurationMinutes"));
  if (!Number.isFinite(duration) || duration <= 0) {
    return { error: t.validation.durationPositive };
  }

  const priceRaw = formData.get("price");
  const price = typeof priceRaw === "string" && priceRaw.trim() ? Number(priceRaw) : null;
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    return { error: t.validation.servicePriceInvalid };
  }

  const currencyRaw = formData.get("currency");
  const currency =
    typeof currencyRaw === "string" && currencyRaw.trim() ? currencyRaw.trim().toUpperCase() : "MAD";

  return { translations, duration, price, currency };
}

export async function createService(
  clinicId: string,
  _prevState: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  const user = await requireManager(clinicId);
  if (!user) {
    const t = await getServerDictionary();
    return { error: t.validation.managersOnlyServices };
  }

  const parsed = await parseServiceForm(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("services").insert({
    clinic_id: clinicId,
    name_translations: parsed.translations,
    default_duration_minutes: parsed.duration,
    price: parsed.price,
    currency: parsed.currency,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clinic/${clinicId}/services`);
  return { success: true };
}

export async function updateService(
  clinicId: string,
  serviceId: string,
  _prevState: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  const user = await requireManager(clinicId);
  if (!user) {
    const t = await getServerDictionary();
    return { error: t.validation.managersOnlyServices };
  }

  const parsed = await parseServiceForm(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const isActive = formData.get("isActive") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({
      name_translations: parsed.translations,
      default_duration_minutes: parsed.duration,
      price: parsed.price,
      currency: parsed.currency,
      is_active: isActive,
    })
    .eq("id", serviceId)
    .eq("clinic_id", clinicId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clinic/${clinicId}/services`);
  return { success: true };
}
