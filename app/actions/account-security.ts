"use server";

import { getServerDictionary } from "@/lib/i18n/server";
import { logSecurityEvent } from "@/lib/auth/security-events";
import { validatePassword } from "@/lib/auth/password";
import { listMySessions, revokeAllOtherSessions, revokeSession } from "@/lib/auth/sessions";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordState = { error?: string; success?: boolean } | undefined;

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const t = await getServerDictionary();
  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string" ||
    !currentPassword ||
    !newPassword ||
    !confirmPassword
  ) {
    return { error: t.validation.emailAndPasswordRequired };
  }

  if (newPassword !== confirmPassword) {
    return { error: t.validation.passwordsDontMatch };
  }

  const user = await requireUser();

  const validation = validatePassword(newPassword, user.email);
  if (!validation.ok) {
    const messages: Record<typeof validation.code, string> = {
      too_short: t.validation.passwordTooShort,
      too_weak: t.validation.passwordTooWeak,
      common_password: t.validation.passwordCommon,
      matches_email: t.validation.passwordMatchesEmail,
    };
    return { error: messages[validation.code] };
  }

  const supabase = await createClient();

  // No dedicated "verify current password" SDK call exists -- re-auth via
  // signInWithPassword is the only way to confirm it. This refreshes the
  // caller's own session (harmless, same tab/user) but must not be logged
  // as a login_succeeded event -- it isn't a new-device sign-in.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });
  if (reauthError) {
    return { error: t.validation.currentPasswordIncorrect };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { error: error.code === "same_password" ? t.validation.newPasswordSameAsOld : error.message };
  }

  await revokeAllOtherSessions(supabase);
  await logSecurityEvent(supabase, { userId: user.id, eventType: "password_changed" });

  return { success: true };
}

export async function listMySessionsAction() {
  const supabase = await createClient();
  await requireUser();
  return listMySessions(supabase);
}

export async function revokeSessionAction(sessionId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const revoked = await revokeSession(supabase, sessionId);
  if (revoked) {
    await logSecurityEvent(supabase, { userId: user.id, eventType: "session_revoked", metadata: { sessionId } });
  }
  return revoked;
}

export async function revokeAllOtherSessionsAction() {
  const user = await requireUser();
  const supabase = await createClient();
  await revokeAllOtherSessions(supabase);
  await logSecurityEvent(supabase, { userId: user.id, eventType: "all_other_sessions_revoked" });
  return { ok: true };
}
