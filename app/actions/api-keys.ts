"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit/log";
import { generateApiKey } from "@/lib/staff/api-keys";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

export type CreateApiKeyResult = { ok: true; id: string; secret: string; prefix: string } | { ok: false; message: string };
export type RevokeApiKeyResult = { ok: true } | { ok: false; message: string };

/**
 * Issues a new clinic API key. The plaintext secret is generated here,
 * returned once in the result, and never persisted -- only its SHA-256
 * hash (lib/staff/api-keys.ts) is written to clinic_api_keys. There is
 * no consuming API yet (this module is UI/issuance only, "for future
 * integrations" per the task); revoking simply stops a key from ever
 * being valid once one exists.
 */
export async function createApiKeyAction(clinicId: string, name: string): Promise<CreateApiKeyResult> {
  const user = await requireManager(clinicId);
  const t = await getServerDictionary();
  if (!user) return { ok: false, message: t.staffManagement.errors.noPermission };

  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, message: t.staffManagement.apiKeys.nameRequired };

  const { secret, prefix, hash } = generateApiKey();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_api_keys")
    .insert({ clinic_id: clinicId, name: trimmedName, key_prefix: prefix, key_hash: hash, created_by: user.id })
    .select("id")
    .single();

  if (error || !data) return { ok: false, message: error?.message ?? t.staffManagement.apiKeys.createError };

  await logAuditEvent(supabase, {
    clinicId,
    actorId: user.id,
    action: "api_key_created",
    entityType: "clinic_api_key",
    entityId: data.id,
    metadata: { name: trimmedName },
  });
  revalidatePath(`/clinic/${clinicId}/staff`);
  return { ok: true, id: data.id, secret, prefix };
}

export async function revokeApiKeyAction(clinicId: string, keyId: string): Promise<RevokeApiKeyResult> {
  const user = await requireManager(clinicId);
  const t = await getServerDictionary();
  if (!user) return { ok: false, message: t.staffManagement.errors.noPermission };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("clinic_api_keys")
    .select("id, revoked_at, name")
    .eq("id", keyId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!existing) return { ok: false, message: t.staffManagement.apiKeys.notFound };
  if (existing.revoked_at) return { ok: false, message: t.staffManagement.apiKeys.alreadyRevoked };

  const { error } = await supabase.from("clinic_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", keyId).eq("clinic_id", clinicId);
  if (error) return { ok: false, message: error.message };

  await logAuditEvent(supabase, {
    clinicId,
    actorId: user.id,
    action: "api_key_revoked",
    entityType: "clinic_api_key",
    entityId: keyId,
    metadata: { name: existing.name },
  });
  revalidatePath(`/clinic/${clinicId}/staff`);
  return { ok: true };
}
