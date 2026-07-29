"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit/log";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/telemetry";

export type WhatsAppSettingsResult = { ok: true } | { ok: false; message: string };

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
