"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AI_ACTIONS, type AIActionName } from "@/lib/ai/actions";
import { sendTemplatedEmail } from "@/lib/email/send";
import type { WelcomeProps } from "@/lib/email/templates/welcome";
import { getServerDictionary } from "@/lib/i18n/server";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { requireUser } from "@/lib/supabase/auth";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";
import { identify, track } from "@/lib/telemetry";
import { DEFAULT_CURRENCY, isCurrencyCode } from "@/lib/currency";
import { isLocale } from "@/lib/i18n";

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

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

const LOGO_MAX_BYTES = 3 * 1024 * 1024;
const LOGO_MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function stringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createClinic(
  _prevState: CreateClinicFormState,
  formData: FormData,
): Promise<CreateClinicFormState> {
  const user = await requireUser();
  const t = await getServerDictionary();

  const name = stringField(formData, "name");
  if (!name) {
    return { error: t.validation.clinicNameRequired };
  }

  const logo = formData.get("logo");
  const hasLogo = logo instanceof File && logo.size > 0;
  if (hasLogo) {
    const file = logo as File;
    if (file.size > LOGO_MAX_BYTES) {
      return { error: t.validation.clinicLogoTooLarge };
    }
    if (!(file.type in LOGO_MIME_EXTENSIONS)) {
      return { error: t.validation.clinicLogoInvalidType };
    }
  }

  const supabase = await createClient();
  const { data: clinicId, error } = await supabase.rpc("create_clinic_with_owner", {
    clinic_name: name,
    clinic_slug: slugify(name),
  });

  if (error) {
    return { error: error.message };
  }

  let logoUrl: string | undefined;
  if (hasLogo) {
    const file = logo as File;
    const extension = LOGO_MIME_EXTENSIONS[file.type];
    const path = `${user.id}/logo-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("clinic-logos")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (!uploadError) {
      logoUrl = supabase.storage.from("clinic-logos").getPublicUrl(path).data.publicUrl;
    }
  }

  const currencyField = stringField(formData, "currency");

  const profileUpdate = {
    clinic_type: stringField(formData, "clinicType") || null,
    address: stringField(formData, "address") || null,
    phone: stringField(formData, "phone") || null,
    email: stringField(formData, "email") || null,
    website: stringField(formData, "website") || null,
    timezone: stringField(formData, "timezone") || undefined,
    country: stringField(formData, "country") || null,
    currency: isCurrencyCode(currencyField) ? currencyField : DEFAULT_CURRENCY,
    date_format: stringField(formData, "dateFormat") || undefined,
    description: stringField(formData, "description") || null,
    logo_url: logoUrl,
  };

  const { error: updateError } = await supabase
    .from("clinics")
    .update(profileUpdate)
    .eq("id", clinicId);

  if (updateError) {
    return { error: updateError.message };
  }

  const locale = await getServerLocale();
  await track({ name: "Clinic Created", userId: user.id, clinicId });
  await identify(user.id, { role: "owner", language: locale });

  if (user.email) {
    const origin = await getOrigin();
    const recipientName =
      (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
      user.email.split("@")[0];
    const props: WelcomeProps = { recipientName, clinicName: name, dashboardUrl: `${origin}/clinic/${clinicId}` };
    // Best-effort -- must never block onboarding from completing.
    const result = await sendTemplatedEmail("welcome", user.email, props, locale);
    if (!result.success) {
      console.error(`[clinics] failed to send welcome email to ${user.email}: ${result.error}`);
    }
  }

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

  let secondaryReminderHoursBefore: number | null = null;
  if (formData.get("secondaryReminderEnabled") === "on") {
    secondaryReminderHoursBefore = Number(formData.get("secondaryReminderHoursBefore"));
    if (!Number.isFinite(secondaryReminderHoursBefore) || secondaryReminderHoursBefore < 0) {
      const t = await getServerDictionary();
      return { error: t.validation.reminderHoursInvalid };
    }
  }

  const googleReviewUrlRaw = formData.get("googleReviewUrl");
  const googleReviewUrl = typeof googleReviewUrlRaw === "string" && googleReviewUrlRaw.trim() ? googleReviewUrlRaw.trim() : null;

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
        notifications: { reminderHoursBefore, secondaryReminderHoursBefore, sendConfirmations, channels, categories, googleReviewUrl },
      },
    })
    .eq("id", clinicId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clinic/${clinicId}/settings`);
  return { success: true };
}

export type UpdateRegionalSettingsFormState = { error?: string; success?: boolean } | undefined;

export async function updateRegionalSettings(
  clinicId: string,
  _prevState: UpdateRegionalSettingsFormState,
  formData: FormData,
): Promise<UpdateRegionalSettingsFormState> {
  const user = await requireManager(clinicId);
  if (!user) {
    const t = await getServerDictionary();
    return { error: t.validation.managersOnlyRegional };
  }

  const currencyField = stringField(formData, "currency");
  const languageField = stringField(formData, "language");

  const update = {
    country: stringField(formData, "country") || null,
    currency: isCurrencyCode(currencyField) ? currencyField : DEFAULT_CURRENCY,
    default_language: isLocale(languageField) ? languageField : undefined,
    timezone: stringField(formData, "timezone") || undefined,
    date_format: stringField(formData, "dateFormat") || undefined,
    number_format: stringField(formData, "numberFormat") || undefined,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("clinics").update(update).eq("id", clinicId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clinic/${clinicId}/settings`);
  revalidatePath(`/clinic/${clinicId}/settings/regional`);
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
