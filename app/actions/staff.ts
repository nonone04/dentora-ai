"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit/log";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership, requireManager, type ClinicRole } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffActionResult = { ok: true } | { ok: false; message: string };

/** "owner" is deliberately excluded -- it's only ever reached via transferOwnershipAction, never a plain role change. */
const CHANGEABLE_ROLES: ClinicRole[] = ["admin", "dentist", "receptionist"];

type MembershipRow = { id: string; user_id: string; role: ClinicRole; is_active: boolean; suspended_at: string | null };

async function getMembershipRow(supabase: SupabaseClient, clinicId: string, membershipId: string): Promise<MembershipRow | null> {
  const { data } = await supabase
    .from("clinic_members")
    .select("id, user_id, role, is_active, suspended_at")
    .eq("id", membershipId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  return data as MembershipRow | null;
}

/**
 * Changes a member's role among admin/dentist/receptionist. Reuses the
 * existing clinic_members_update RLS policy as-is (owner/admin may
 * update any non-owner role); the guards below are app-layer product
 * rules on top of that -- RLS is the real security backstop, this is
 * just clearer error messages and defense in depth.
 */
export async function changeMemberRoleAction(clinicId: string, membershipId: string, newRole: ClinicRole): Promise<StaffActionResult> {
  const user = await requireManager(clinicId);
  const t = await getServerDictionary();
  if (!user) return { ok: false, message: t.staffManagement.errors.noPermission };

  if (!CHANGEABLE_ROLES.includes(newRole)) {
    return { ok: false, message: t.staffManagement.errors.invalidRole };
  }

  const supabase = await createClient();
  const target = await getMembershipRow(supabase, clinicId, membershipId);
  if (!target) return { ok: false, message: t.staffManagement.errors.memberNotFound };
  if (target.role === "owner") return { ok: false, message: t.staffManagement.errors.cannotChangeOwnerRole };
  if (target.user_id === user.id) return { ok: false, message: t.staffManagement.errors.cannotActOnSelf };

  const { error } = await supabase.from("clinic_members").update({ role: newRole }).eq("id", membershipId).eq("clinic_id", clinicId);
  if (error) return { ok: false, message: error.message };

  await logAuditEvent(supabase, {
    clinicId,
    actorId: user.id,
    action: "member_role_changed",
    entityType: "clinic_member",
    entityId: membershipId,
    metadata: { from: target.role, to: newRole },
  });
  revalidatePath(`/clinic/${clinicId}/staff`);
  return { ok: true };
}

/** Suspending sets is_active = false, which immediately revokes clinic access via auth_user_clinic_ids/auth_user_has_role -- same mechanism a pending invitation already uses, distinguished in the UI by suspended_at being set. */
export async function suspendMemberAction(clinicId: string, membershipId: string): Promise<StaffActionResult> {
  const user = await requireManager(clinicId);
  const t = await getServerDictionary();
  if (!user) return { ok: false, message: t.staffManagement.errors.noPermission };

  const supabase = await createClient();
  const target = await getMembershipRow(supabase, clinicId, membershipId);
  if (!target) return { ok: false, message: t.staffManagement.errors.memberNotFound };
  if (target.role === "owner") return { ok: false, message: t.staffManagement.errors.cannotActOnOwner };
  if (target.user_id === user.id) return { ok: false, message: t.staffManagement.errors.cannotActOnSelf };
  if (!target.is_active) return { ok: false, message: t.staffManagement.errors.alreadyInactive };

  const { error } = await supabase
    .from("clinic_members")
    .update({ is_active: false, suspended_at: new Date().toISOString() })
    .eq("id", membershipId)
    .eq("clinic_id", clinicId);
  if (error) return { ok: false, message: error.message };

  await logAuditEvent(supabase, { clinicId, actorId: user.id, action: "member_suspended", entityType: "clinic_member", entityId: membershipId });
  revalidatePath(`/clinic/${clinicId}/staff`);
  return { ok: true };
}

export async function reactivateMemberAction(clinicId: string, membershipId: string): Promise<StaffActionResult> {
  const user = await requireManager(clinicId);
  const t = await getServerDictionary();
  if (!user) return { ok: false, message: t.staffManagement.errors.noPermission };

  const supabase = await createClient();
  const target = await getMembershipRow(supabase, clinicId, membershipId);
  if (!target) return { ok: false, message: t.staffManagement.errors.memberNotFound };
  if (target.is_active) return { ok: false, message: t.staffManagement.errors.alreadyActive };
  if (!target.suspended_at) return { ok: false, message: t.staffManagement.errors.notSuspended };

  const { error } = await supabase
    .from("clinic_members")
    .update({ is_active: true, suspended_at: null })
    .eq("id", membershipId)
    .eq("clinic_id", clinicId);
  if (error) return { ok: false, message: error.message };

  await logAuditEvent(supabase, { clinicId, actorId: user.id, action: "member_reactivated", entityType: "clinic_member", entityId: membershipId });
  revalidatePath(`/clinic/${clinicId}/staff`);
  return { ok: true };
}

export async function removeMemberAction(clinicId: string, membershipId: string): Promise<StaffActionResult> {
  const user = await requireManager(clinicId);
  const t = await getServerDictionary();
  if (!user) return { ok: false, message: t.staffManagement.errors.noPermission };

  const supabase = await createClient();
  const target = await getMembershipRow(supabase, clinicId, membershipId);
  if (!target) return { ok: false, message: t.staffManagement.errors.memberNotFound };
  if (target.role === "owner") return { ok: false, message: t.staffManagement.errors.cannotActOnOwner };
  if (target.user_id === user.id) return { ok: false, message: t.staffManagement.errors.cannotActOnSelf };

  const { error } = await supabase.from("clinic_members").delete().eq("id", membershipId).eq("clinic_id", clinicId);
  if (error) return { ok: false, message: error.message };

  await logAuditEvent(supabase, {
    clinicId,
    actorId: user.id,
    action: "member_removed",
    entityType: "clinic_member",
    entityId: membershipId,
    metadata: { role: target.role },
  });
  revalidatePath(`/clinic/${clinicId}/staff`);
  return { ok: true };
}

/**
 * Reuses transfer_clinic_ownership (supabase/migrations/20260729010000),
 * a SECURITY DEFINER function that atomically promotes the target and
 * demotes the caller in one transaction -- the RLS policy alone would
 * permit the same two updates run separately, but only the function
 * guarantees the clinic is never left mid-transfer.
 */
export async function transferOwnershipAction(clinicId: string, membershipId: string): Promise<StaffActionResult> {
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);
  const t = await getServerDictionary();

  if (membership.role !== "owner") {
    return { ok: false, message: t.staffManagement.errors.onlyOwnerCanTransfer };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_clinic_ownership", {
    target_clinic_id: clinicId,
    new_owner_member_id: membershipId,
  });
  if (error) return { ok: false, message: error.message };

  await logAuditEvent(supabase, { clinicId, actorId: user.id, action: "ownership_transferred", entityType: "clinic_member", entityId: membershipId });
  revalidatePath(`/clinic/${clinicId}/staff`);
  revalidatePath(`/clinic/${clinicId}`);
  return { ok: true };
}
