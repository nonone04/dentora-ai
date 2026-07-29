import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSecurityEvent } from "@/lib/auth/security-events";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/telemetry";

/**
 * @supabase/ssr defaults to the PKCE flow, whose email links only work in
 * the browser that requested them (the code_verifier lives in a cookie
 * there) -- broken for the very common case of opening a reset/verify link
 * from a different device (e.g. a phone's mail app). This route instead
 * verifies via token_hash/OTP, which works from any device. It requires
 * the Supabase Dashboard's "Confirm signup" and "Reset Password" email
 * templates to link here with `token_hash={{ .TokenHash }}` instead of the
 * default `{{ .ConfirmationURL }}` -- a manual, one-time infra change
 * outside this repo.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (!error) {
      if (type === "signup" && data.user) {
        const admin = createAdminClient();
        await logSecurityEvent(admin, { userId: data.user.id, eventType: "email_verified" });
        await track({ name: "Email Verified", userId: data.user.id });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    const reason = error.code === "otp_expired" ? "expired" : "invalid";
    return NextResponse.redirect(`${origin}/auth/confirm-error?type=${type}&reason=${reason}`);
  }

  return NextResponse.redirect(`${origin}/auth/confirm-error?type=${type ?? ""}&reason=invalid`);
}
