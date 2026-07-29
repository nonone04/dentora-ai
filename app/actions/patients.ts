"use server";

import { redirect } from "next/navigation";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/telemetry";

export type CreatePatientFormState = { error?: string } | undefined;

function optionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function createPatient(
  clinicId: string,
  _prevState: CreatePatientFormState,
  formData: FormData,
): Promise<CreatePatientFormState> {
  const user = await requireUser();

  const t = await getServerDictionary();

  const fullName = formData.get("fullName");
  if (typeof fullName !== "string" || !fullName.trim()) {
    return { error: t.validation.fullNameRequired };
  }

  const preferredLanguage = formData.get("preferredLanguage");
  const language =
    typeof preferredLanguage === "string" && ["ar", "fr", "en"].includes(preferredLanguage)
      ? preferredLanguage
      : "fr";

  const preferredContactChannel = formData.get("preferredContactChannel");
  const contactChannel =
    typeof preferredContactChannel === "string" &&
    ["email", "sms", "whatsapp"].includes(preferredContactChannel)
      ? preferredContactChannel
      : "email";

  const reminderOptIn = formData.get("reminderOptIn") === "on";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: clinicId,
      full_name: fullName.trim(),
      phone: optionalString(formData.get("phone")),
      email: optionalString(formData.get("email")),
      date_of_birth: optionalString(formData.get("dateOfBirth")),
      gender: optionalString(formData.get("gender")),
      preferred_language: language,
      notes: optionalString(formData.get("notes")),
      preferred_contact_channel: contactChannel,
      reminder_opt_in: reminderOptIn,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: t.validation.phoneAlreadyExists };
    }
    return { error: error.message };
  }

  await track({ name: "Patient Created", userId: user.id, clinicId });

  redirect(`/clinic/${clinicId}/patients/${data.id}`);
}
