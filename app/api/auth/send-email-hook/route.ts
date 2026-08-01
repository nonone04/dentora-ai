import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { isResponseLanguage, type ResponseLanguage } from "@/lib/ai/nlu/language";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { getSafeNextPath } from "@/lib/auth/safe-redirect";
import { sendTemplatedEmail } from "@/lib/email/send";
import type { PasswordResetProps } from "@/lib/email/templates/password-reset";
import type { StaffInvitationProps } from "@/lib/email/templates/staff-invitation";
import type { VerifyEmailProps } from "@/lib/email/templates/verify-email";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 1000;

// Must track Supabase Dashboard > Authentication > Emails > "OTP expiry"
// (supabase/config.toml's [auth.email] otp_expiry = 3600 locally, i.e. 1
// hour) -- this is copy only, it doesn't control the actual link validity,
// which Supabase enforces server-side regardless of what we say here.
const LINK_EXPIRY_HOURS = 1;
// Invite links aren't governed by otp_expiry the same way; this is
// informational copy only.
const INVITE_EXPIRY_DAYS = 7;

type HookUser = {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
};

type HookEmailData = {
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
};

type HookPayload = {
  user: HookUser;
  email_data: HookEmailData;
};

function appBaseUrl(siteUrl: string): string {
  return (process.env.NEXT_PUBLIC_APP_URL || siteUrl || "https://dentora.ai").replace(/\/$/, "");
}

/**
 * Builds the real /auth/confirm link (token_hash-based OTP verification,
 * works from any device -- see that route's own docs) from the hook's
 * token_hash + the plain post-verification path the app originally asked
 * for via emailRedirectTo/redirectTo (now carried end-to-end as
 * email_data.redirect_to).
 */
function buildConfirmUrl(siteUrl: string, tokenHash: string, type: string, redirectTo: string): string {
  let nextPath = "/";
  try {
    const url = new URL(redirectTo);
    nextPath = getSafeNextPath(url.pathname + url.search) ?? "/";
  } catch {
    nextPath = "/";
  }

  const params = new URLSearchParams({ token_hash: tokenHash, type, next: nextPath });
  return `${appBaseUrl(siteUrl)}/auth/confirm?${params.toString()}`;
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value ? value : undefined;
}

function resolveLanguage(metadata: Record<string, unknown> | undefined): ResponseLanguage {
  const locale = metadataString(metadata, "locale");
  return locale && isResponseLanguage(locale) ? locale : "en";
}

/**
 * Supabase Auth's "Send Email" hook (Authentication > Hooks > Send Email in
 * the Dashboard) -- once enabled there, Supabase calls this endpoint
 * instead of sending its own built-in email for every auth email type,
 * handing us the verification token/link data so we render and send our
 * own branded template through the existing Resend pipeline
 * (lib/email/send.ts -> lib/notifications/provider.ts). This is what
 * actually stops Supabase-branded emails from reaching users (see
 * docs/customer-communications.md).
 *
 * Only the 3 action types this app can actually trigger today are
 * handled (signup, recovery, invite -- no email-change UI, MFA disabled
 * in supabase/config.toml, so email_change/reauthentication/etc. never
 * fire in practice). Anything else is logged and acknowledged with 200
 * rather than treated as an error: a hook failure can block the
 * underlying Supabase auth operation itself (e.g. block signup), which
 * must never happen just because a branded template doesn't exist yet.
 */
export async function POST(request: Request) {
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  const rawBody = await request.text();

  if (!hookSecret) {
    console.error("[auth:send-email-hook] SUPABASE_AUTH_HOOK_SECRET is not set");
    return new Response("Not configured", { status: 500 });
  }

  let payload: HookPayload;
  try {
    const wh = new Webhook(hookSecret.replace("v1,whsec_", ""));
    payload = wh.verify(rawBody, Object.fromEntries(request.headers)) as HookPayload;
  } catch (err) {
    console.error("[auth:send-email-hook] signature verification failed", err instanceof Error ? err.message : err);
    return new Response("Invalid signature", { status: 401 });
  }

  const { user, email_data: emailData } = payload;

  if (!checkRateLimit(`auth-email-hook:${user.email}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    console.warn(`[auth:send-email-hook] rate limited recipient=${user.email}`);
    return NextResponse.json({});
  }

  const language = resolveLanguage(user.user_metadata);
  const recipientName = metadataString(user.user_metadata, "full_name") ?? user.email.split("@")[0];

  let result: { success: boolean; error?: string } | null = null;

  switch (emailData.email_action_type) {
    case "signup": {
      const verifyUrl = buildConfirmUrl(emailData.site_url, emailData.token_hash, "signup", emailData.redirect_to);
      const props: VerifyEmailProps = { recipientName, verifyUrl, expiresInHours: LINK_EXPIRY_HOURS };
      result = await sendTemplatedEmail("verify_email", user.email, props, language);
      break;
    }
    case "recovery": {
      const resetUrl = buildConfirmUrl(emailData.site_url, emailData.token_hash, "recovery", emailData.redirect_to);
      const props: PasswordResetProps = { recipientName, resetUrl, expiresInMinutes: LINK_EXPIRY_HOURS * 60 };
      result = await sendTemplatedEmail("password_reset", user.email, props, language);
      break;
    }
    case "invite": {
      const acceptUrl = buildConfirmUrl(emailData.site_url, emailData.token_hash, "invite", emailData.redirect_to);
      const props: StaffInvitationProps = {
        inviterName: metadataString(user.user_metadata, "inviter_name") ?? "A Dentora teammate",
        clinicName: metadataString(user.user_metadata, "clinic_name") ?? "your clinic",
        role: metadataString(user.user_metadata, "invited_role") ?? "team member",
        acceptUrl,
        expiresInDays: INVITE_EXPIRY_DAYS,
      };
      result = await sendTemplatedEmail("staff_invitation", user.email, props, language);
      break;
    }
    default:
      console.log(
        `[auth:send-email-hook] no branded template wired for action_type="${emailData.email_action_type}" -- acknowledging without sending`,
      );
      return NextResponse.json({});
  }

  if (!result?.success) {
    console.error(
      `[auth:send-email-hook] failed to send action_type="${emailData.email_action_type}" to ${user.email}: ${result?.error}`,
    );
  }

  return NextResponse.json({});
}
