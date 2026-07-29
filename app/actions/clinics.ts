"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AI_ACTIONS, type AIActionName } from "@/lib/ai/actions";
import { getServerDictionary } from "@/lib/i18n/server";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { requireUser } from "@/lib/supabase/auth";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";
import { identify, track } from "@/lib/telemetry";

export type CreateClinicFormState = { error?: string } | undefined;

const DIACRITICS = /[\u0300-\u036f]/g;

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${base || "clinic"}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createClinic(
  _prevState: CreateClinicFormState,
  formData: FormData,
): Promise<CreateClinicFormState> {
  const user = await requireUser();

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    const t = await getServerDictionary();
    return { error: t.validation.clinicNameRequired };
  }

  const supabase = await createClient();
  const { data: clinicId, error } = await supabase.rpc("create_clinic_with_owner", {
    clinic_name: name.trim(),
    clinic_slug: slugify(name),
  });

  if (error) {
    return { error: error.message };
  }

  const locale = await getServerLocale();
  await track({ name: "Clinic Created", userId: user.id, clinicId });
  await identify(user.id, { role: "owner", language: locale });

  redirect(`/clinic/${clinicId}`);
}

export type UpdateNotificationSettingsFormState = { error?: string; success?: boolean } | undefined;

export async function updateNotificationSettings(
  clinicId: string,
  _prevState: UpdateNotificationSettingsFormState,
  formData: FormData,
): Promise<UpdateNotificationSettingsFormState> {
  const user = await requireManager(clinicId);
  if (!user) {
    const t = await getServerDictionary();
    return { error: t.validation.managersOnlyNotifications };
  }

  const reminderHoursBefore = Number(formData.get("reminderHoursBefore"));
  if (!Number.isFinite(reminderHoursBefore) || reminderHoursBefore < 0) {
    const t = await getServerDictionary();
    return { error: t.validation.reminderHoursInvalid };
  }

  const sendConfirmations = formData.get("sendConfirmations") === "on";
  const channels = {
    email: formData.get("channelEmail") === "on",
    inApp: formData.get("channelInApp") === "on",
  };
  const categories = {
    appointmentReminders: formData.get("categoryAppointmentReminders") === "on",
    securityAlerts: formData.get("categorySecurityAlerts") === "on",
    aiSummaries: formData.get("categoryAiSummaries") === "on",
    teamActivity: formData.get("categoryTeamActivity") === "on",
  };

  const supabase = await createClient();
  const { data: clinic } = await supabase.from("clinics").select("settings").eq("id", clinicId).single();
  const settings = (clinic?.settings ?? {}) as Record<string, unknown>;

  const { error } = await supabase
    .from("clinics")
    .update({
      settings: {
        ...settings,
        notifications: { reminderHoursBefore, sendConfirmations, channels, categories },
      },
    })
    .eq("id", clinicId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clinic/${clinicId}/settings`);
  return { success: true };
}

export type UpdateAISettingsFormState = { error?: string; success?: boolean } | undefined;

export async function updateAISettings(
  clinicId: string,
  _prevState: UpdateAISettingsFormState,
  formData: FormData,
): Promise<UpdateAISettingsFormState> {
  const user = await requireManager(clinicId);
  if (!user) {
    const t = await getServerDictionary();
    return { error: t.validation.managersOnlyAI };
  }

  const enabled = formData.get("enabled") === "on";
  const validNames = new Set(AI_ACTIONS.map((action) => action.name));
  const allowedActions = formData
    .getAll("allowedActions")
    .filter((value): value is string => typeof value === "string" && validNames.has(value as AIActionName));

  const supabase = await createClient();
  const { data: clinic } = await supabase.from("clinics").select("settings").eq("id", clinicId).single();
  const settings = (clinic?.settings ?? {}) as Record<string, unknown>;

  const { error } = await supabase
    .from("clinics")
    .update({
      settings: {
        ...settings,
        ai: { enabled, allowedActions },
      },
    })
    .eq("id", clinicId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clinic/${clinicId}/settings`);
  return { success: true };
}
