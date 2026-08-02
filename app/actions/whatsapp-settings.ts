"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit/log";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/telemetry";
import { getPhoneNumberProfile } from "@/lib/whatsapp/client";
import { sendCustomMessage } from "@/lib/whatsapp/send";
import type { WhatsAppPhoneNumberProfile } from "@/lib/whatsapp/types";

export type WhatsAppSettingsResult = { ok: true } | { ok: false; message: string };

export type WhatsAppConnectionTestResult = { ok: true; profile: WhatsAppPhoneNumberProfile } | { ok: false; message: string };

/** Postgres unique_violation -- another clinic already registered this phone_number_id. */
const UNIQUE_VIOLATION = "23505";

export async function connectWhatsAppAction(
  clinicId: string,
  displayNumber: string,
  phoneNumberId: string,
): Promise<WhatsAppSettingsResult> {
  const user = await requireManager(clinicId);
  const t = await getServerDictionary();
  if (!user) {
    return { ok: false, message: t.settings.whatsappWizard.errors.notAuthorized };
  }

  const trimmedId = phoneNumberId.trim();
  if (!trimmedId) {
    return { ok: false, message: t.settings.whatsappWizard.errors.phoneNumberIdRequired };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinics")
    .update({
      whatsapp_number: displayNumber.trim() || null,
      whatsapp_phone_number_id: trimmedId,
    })
    .eq("id", clinicId);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, message: t.settings.whatsappWizard.errors.duplicatePhoneNumberId };
    }
    return { ok: false, message: error.message };
  }

  await logAuditEvent(supabase, {
    clinicId,
    actorId: user.id,
    action: "whatsapp_connected",
    entityType: "clinic",
    entityId: clinicId,
  });
  await track({ name: "WhatsApp Connected", userId: user.id, clinicId });

  revalidatePath(`/clinic/${clinicId}/settings`);
  return { ok: true };
}

export async function disconnectWhatsAppAction(clinicId: string): Promise<WhatsAppSettingsResult> {
  const user = await requireManager(clinicId);
  const t = await getServerDictionary();
  if (!user) {
    return { ok: false, message: t.settings.whatsappWizard.errors.notAuthorized };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinics")
    .update({ whatsapp_phone_number_id: null })
    .eq("id", clinicId);

  if (error) {
    return { ok: false, message: error.message };
  }

  await logAuditEvent(supabase, {
    clinicId,
    actorId: user.id,
    action: "whatsapp_disconnected",
    entityType: "clinic",
    entityId: clinicId,
  });

  revalidatePath(`/clinic/${clinicId}/settings`);
  return { ok: true };
}

/**
 * "API status" check for the Settings page's Test Connection button --
 * a live Graph API call using the deployment's WHATSAPP_ACCESS_TOKEN/
 * WHATSAPP_PHONE_NUMBER_ID (single-WABA-for-the-whole-deployment, same
 * env vars lib/notifications/provider.ts's factory reads), confirming
 * both are still valid and returning the connected number's business
 * name for display. Distinct from connectWhatsAppAction above, which
 * only ever writes clinics.whatsapp_phone_number_id (inbound routing) --
 * this never touches the database.
 */
export async function testWhatsAppConnectionAction(clinicId: string): Promise<WhatsAppConnectionTestResult> {
  const user = await requireManager(clinicId);
  const t = await getServerDictionary();
  if (!user) {
    return { ok: false, message: t.settings.whatsappWizard.errors.notAuthorized };
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return { ok: false, message: t.settings.whatsappWizard.apiStatus.apiNotConfigured };
  }

  const result = await getPhoneNumberProfile({ accessToken, phoneNumberId });
  if (!result.success) {
    return { ok: false, message: result.error };
  }
  return { ok: true, profile: result.profile };
}

/** Send Test Message button -- a one-off free-text send with no notification_event/delivery bookkeeping (there's no patient/appointment behind it), just lib/whatsapp/send.ts's raw sendCustomMessage. */
export async function sendWhatsAppTestMessageAction(clinicId: string, phone: string): Promise<WhatsAppSettingsResult> {
  const user = await requireManager(clinicId);
  const t = await getServerDictionary();
  if (!user) {
    return { ok: false, message: t.settings.whatsappWizard.errors.notAuthorized };
  }

  if (!phone.trim()) {
    return { ok: false, message: t.settings.whatsappWizard.errors.phoneRequired };
  }

  const result = await sendCustomMessage(phone.trim(), t.settings.whatsappWizard.testMessageBody);
  if (!result.success) {
    return { ok: false, message: result.error };
  }

  await track({ name: "WhatsApp Test Message Sent", userId: user.id, clinicId });
  return { ok: true };
}
