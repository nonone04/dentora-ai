"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isResponseLanguage, type ResponseLanguage } from "@/lib/ai/nlu/language";
import { logAuditEvent } from "@/lib/audit/log";
import { sendTemplatedEmail } from "@/lib/email/send";
import type { InvitationAcceptedProps } from "@/lib/email/templates/invitation-accepted";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";
import { requireManager, type ClinicRole } from "@/lib/supabase/clinic";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/telemetry";

export type ActionFormState = { error?: string; success?: string } | undefined;

const INVITABLE_ROLES: ClinicRole[] = ["admin", "dentist", "receptionist"];

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

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
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name, default_language")
      .eq("id", clinicId)
      .single();

    const inviterName =
      (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
      user.email?.split("@")[0] ||
      "A Dentora teammate";

    const origin = await getOrigin();
    const admin = createAdminClient();
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        data: {
          inviter_name: inviterName,
          clinic_name: clinic?.name ?? "your clinic",
          invited_role: role,
          locale: clinic?.default_language ?? null,
        },
        redirectTo: `${origin}/reset-password`,
      },
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
      invited_by: user.id,
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

  const { data, error } = await supabase.rpc("accept_clinic_invitation", {
    membership_id: membershipId,
  });
  const [result] = data ?? [];
  const clinicId = result?.clinic_id;

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

  await notifyInviterOfAcceptance(clinicId, result?.invited_by ?? null, user);

  redirect(`/clinic/${clinicId}`);
}

/** Best-effort -- an inviter notification email must never block the invitee from joining. Skipped entirely for invites that predate the invited_by column. */
async function notifyInviterOfAcceptance(
  clinicId: string,
  inviterId: string | null,
  newMember: Awaited<ReturnType<typeof requireUser>>,
) {
  if (!inviterId) return;

  const admin = createAdminClient();
  const [{ data: clinic }, { data: inviterProfile }] = await Promise.all([
    admin.from("clinics").select("name, default_language").eq("id", clinicId).single(),
    admin.from("profiles").select("full_name, email").eq("id", inviterId).single(),
  ]);
  const { data: membership } = await admin
    .from("clinic_members")
    .select("role")
    .eq("clinic_id", clinicId)
    .eq("user_id", newMember.id)
    .single();

  if (!inviterProfile?.email || !clinic || !membership) return;

  const locale = clinic.default_language;
  const language: ResponseLanguage = isResponseLanguage(locale ?? "") ? (locale as ResponseLanguage) : "en";
  const newMemberName =
    (typeof newMember.user_metadata?.full_name === "string" && newMember.user_metadata.full_name) ||
    newMember.email?.split("@")[0] ||
    "Your teammate";
  const origin = await getOrigin();

  const props: InvitationAcceptedProps = {
    recipientName: inviterProfile.full_name || inviterProfile.email.split("@")[0],
    newMemberName,
    clinicName: clinic.name,
    role: membership.role,
    manageTeamUrl: `${origin}/clinic/${clinicId}/settings`,
  };

  const result = await sendTemplatedEmail("invitation_accepted", inviterProfile.email, props, language);
  if (!result.success) {
    console.error(`[team] failed to send invitation_accepted email to ${inviterProfile.email}: ${result.error}`);
  }
}
