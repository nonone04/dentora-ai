"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerDictionary } from "@/lib/i18n/server";
import { isAccountLocked, recordLoginFailure } from "@/lib/auth/login-lockout";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { getSafeNextPath } from "@/lib/auth/safe-redirect";
import { logSecurityEvent } from "@/lib/auth/security-events";
import { validatePassword } from "@/lib/auth/password";
import { track } from "@/lib/telemetry";
import { REMEMBER_ME_COOKIE } from "@/lib/supabase/cookie-persistence";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; message?: string } | undefined;

const ACCOUNT_LOCKOUT_LIMIT = 5;
const ACCOUNT_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const IP_RATE_LIMIT = 20;
const IP_RATE_WINDOW_MS = 15 * 60 * 1000;
const RESEND_LIMIT = 3;
const RESEND_WINDOW_MS = 15 * 60 * 1000;

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getClientIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function getUserAgent() {
  const requestHeaders = await headers();
  return requestHeaders.get("user-agent");
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getServerDictionary();
  const email = formData.get("email");
  const password = formData.get("password");
  const rememberMe = formData.get("rememberMe") === "on";
  const next = getSafeNextPath(formData.get("next"));

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: t.validation.emailAndPasswordRequired };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const ip = await getClientIp();
  const userAgent = await getUserAgent();
  const admin = createAdminClient();

  if (!checkRateLimit(`login:ip:${ip}`, IP_RATE_LIMIT, IP_RATE_WINDOW_MS)) {
    return { error: t.login.tooManyAttempts };
  }

  const accountKey = `login:account:${normalizedEmail}`;
  if (isAccountLocked(accountKey, ACCOUNT_LOCKOUT_LIMIT, ACCOUNT_LOCKOUT_WINDOW_MS)) {
    await logSecurityEvent(admin, {
      userId: null,
      eventType: "account_locked",
      ip,
      userAgent,
      metadata: { emailAttempted: normalizedEmail },
    });
    // Same generic message as a wrong password -- an attacker must not be
    // able to distinguish "locked out" from "wrong password" from "no such account".
    return { error: t.login.invalidCredentials };
  }

  const supabase = await createClient({ rememberMe });
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      // Only reachable once credentials have already been verified correct
      // by GoTrue, so surfacing this specific state isn't an information leak.
      const suffix = next ? `&next=${encodeURIComponent(next)}` : "";
      redirect(`/verify-email?email=${encodeURIComponent(normalizedEmail)}${suffix}`);
    }

    recordLoginFailure(accountKey, ACCOUNT_LOCKOUT_WINDOW_MS);
    await logSecurityEvent(admin, {
      userId: null,
      eventType: "login_failed",
      ip,
      userAgent,
      metadata: { emailAttempted: normalizedEmail },
    });
    return { error: t.login.invalidCredentials };
  }

  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_ME_COOKIE, rememberMe ? "1" : "0", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    ...(rememberMe ? { maxAge: 60 * 60 * 24 * 400 } : {}),
  });

  await logSecurityEvent(admin, {
    userId: data.user.id,
    eventType: "login_succeeded",
    ip,
    userAgent,
  });
  await track({ name: "Login", userId: data.user.id });

  redirect(next ?? "/");
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getServerDictionary();
  const fullName = formData.get("fullName");
  const email = formData.get("email");
  const password = formData.get("password");
  const next = getSafeNextPath(formData.get("next"));

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: t.validation.emailAndPasswordRequired };
  }

  const validation = validatePassword(password, email);
  if (!validation.ok) {
    return { error: passwordErrorMessage(t, validation.code) };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const origin = await getOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: typeof fullName === "string" && fullName ? fullName : null,
      },
      emailRedirectTo: `${origin}/auth/confirm?type=signup&next=${encodeURIComponent(next ?? "/")}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await track({ name: "User Registered", userId: data.user.id });
  }

  if (!data.session) {
    if (data.user) {
      const admin = createAdminClient();
      await logSecurityEvent(admin, { userId: data.user.id, eventType: "email_verification_sent" });
    }
    return { message: t.login.checkEmail };
  }

  redirect(next ?? "/");
}

export async function signInWithGoogle(formData: FormData) {
  const next = getSafeNextPath(formData.get("next"));
  const origin = await getOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next ?? "/")}`,
    },
  });

  if (error || !data.url) {
    const suffix = next ? `&next=${encodeURIComponent(next)}` : "";
    redirect(`/login?error=oauth${suffix}`);
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user) {
    await track({ name: "Logout", userId: user.id });
  }
  redirect("/login");
}

export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getServerDictionary();
  const email = formData.get("email");

  if (typeof email !== "string" || !email) {
    return { error: t.validation.emailAndPasswordRequired };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Always the same success message below, whether or not the email exists
  // or the send was rate-limited -- no-leakage applies here too.
  if (checkRateLimit(`pwreset:${normalizedEmail}`, RESEND_LIMIT, RESEND_WINDOW_MS)) {
    const origin = await getOrigin();
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${origin}/auth/confirm?type=recovery&next=/reset-password`,
    });

    const admin = createAdminClient();
    const { data: existing } = await admin.from("profiles").select("id").eq("email", normalizedEmail).maybeSingle();
    if (existing) {
      await logSecurityEvent(admin, { userId: existing.id, eventType: "password_reset_requested" });
      await track({ name: "Password Reset", userId: existing.id, properties: { stage: "requested" } });
    }
  }

  return { message: t.forgotPassword.genericSent };
}

export async function resendVerificationEmail(
  email: string,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const t = await getServerDictionary();
  const normalizedEmail = email.trim().toLowerCase();

  if (!checkRateLimit(`resend:${normalizedEmail}`, RESEND_LIMIT, RESEND_WINDOW_MS)) {
    return { ok: false, message: t.verifyEmail.resendError };
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalizedEmail,
    options: { emailRedirectTo: `${origin}/auth/confirm?type=signup&next=/` },
  });

  if (error) {
    return { ok: false, message: t.verifyEmail.resendError };
  }

  return { ok: true, message: t.verifyEmail.resendSuccess };
}

export async function completePasswordReset(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = await getServerDictionary();
  const newPassword = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof newPassword !== "string" || typeof confirmPassword !== "string" || !newPassword || !confirmPassword) {
    return { error: t.validation.emailAndPasswordRequired };
  }

  if (newPassword !== confirmPassword) {
    return { error: t.validation.passwordsDontMatch };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/confirm-error?type=recovery&reason=invalid");
  }

  const validation = validatePassword(newPassword, user.email);
  if (!validation.ok) {
    return { error: passwordErrorMessage(t, validation.code) };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { error: error.code === "same_password" ? t.validation.newPasswordSameAsOld : error.message };
  }

  await supabase.auth.signOut({ scope: "others" });

  const admin = createAdminClient();
  await logSecurityEvent(admin, { userId: user.id, eventType: "password_reset_completed" });
  await track({ name: "Password Reset", userId: user.id, properties: { stage: "completed" } });

  redirect("/login?resetSuccess=1");
}

function passwordErrorMessage(
  t: Awaited<ReturnType<typeof getServerDictionary>>,
  code: "too_short" | "too_weak" | "common_password" | "matches_email",
): string {
  switch (code) {
    case "too_short":
      return t.validation.passwordTooShort;
    case "common_password":
      return t.validation.passwordCommon;
    case "matches_email":
      return t.validation.passwordMatchesEmail;
    case "too_weak":
    default:
      return t.validation.passwordTooWeak;
  }
}
