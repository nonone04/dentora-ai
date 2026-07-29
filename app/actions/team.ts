"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit/log";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";
import { requireManager, type ClinicRole } from "@/lib/supabase/clinic";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/telemetry";

export type ActionFormState = { error?: string; success?: string } | undefined;

const INVITABLE_ROLES: ClinicRole[] = ["admin", "dentist", "receptionist"];

export async function inviteMember(
  clinicId: string,
  _prevState: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  const user = await requireManager(clinicId);
  const t = await getServerDictionary();
  if (!user) {
    return { error: t.staffManagement.errors.noPermission };
  }

  const email = formData.get("email");
  const role = formData.get("role");

  if (typeof email !== "string" || !email.trim()) {
    return { error: t.staffManagement.invite.emailRequired };
  }
  if (typeof role !== "string" || !INVITABLE_ROLES.includes(role as ClinicRole)) {
    return { error: t.staffManagement.invite.roleInvalid };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const supabase = await createClient();

  const { data: existingProfileId, error: lookupError } = await supabase.rpc(
    "find_profile_id_by_email",
    { lookup_email: normalizedEmail },
  );

  if (lookupError) {
    return { error: lookupError.message };
  }

  let targetUserId = existingProfileId as string | null;

  if (!targetUserId) {
    const admin = createAdminClient();
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      normalizedEmail,
    );

    if (inviteError || !invited.user) {
      return { error: inviteError?.message ?? t.staffManagement.invite.inviteError };
    }

    targetUserId = invited.user.id;
  }

  const { data: existingMembership } = await supabase
    .from("clinic_members")
    .select("id, is_active")
    .eq("clinic_id", clinicId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (existingMembership) {
    return {
      error: existingMembership.is_active
        ? t.staffManagement.invite.alreadyMember
        : t.staffManagement.invite.invitationPending,
    };
  }

  const { data: membership, error: insertError } = await supabase
    .from("clinic_members")
    .insert({
      clinic_id: clinicId,
      user_id: targetUserId,
      role,
      is_active: false,
    })
    .select("id")
    .single();

  if (insertError) {
    return { error: insertError.message };
  }

  await logAuditEvent(supabase, {
    clinicId,
    actorId: user.id,
    action: "member_invited",
    entityType: "clinic_member",
    entityId: membership.id,
    metadata: { role },
  });
  await track({ name: "Staff Invited", userId: user.id, clinicId, properties: { role: role as ClinicRole } });

  revalidatePath(`/clinic/${clinicId}/settings`);
  revalidatePath(`/clinic/${clinicId}/staff`);
  return { success: t.staffManagement.invite.success };
}

export async function acceptInvitation(
  membershipId: string,
  _prevState: { error?: string } | undefined,
  _formData: FormData,
): Promise<{ error?: string } | undefined> {
  const user = await requireUser();
  const supabase = await createClient();
  const t = await getServerDictionary();

  const { data: clinicId, error } = await supabase.rpc("accept_clinic_invitation", {
    membership_id: membershipId,
  });

  if (error || !clinicId) {
    return { error: error?.message ?? t.staffManagement.invite.acceptError };
  }

  await logAuditEvent(supabase, {
    clinicId,
    actorId: user.id,
    action: "member_invitation_accepted",
    entityType: "clinic_member",
    entityId: membershipId,
  });

  redirect(`/clinic/${clinicId}`);
}
