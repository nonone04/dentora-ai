import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSafeNextPath } from "@/lib/auth/safe-redirect";
import { logSecurityEvent } from "@/lib/auth/security-events";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/telemetry";

/**
 * @supabase/ssr defaults to the PKCE flow, whose email links only work in
 * the browser that requested them (the code_verifier lives in a cookie
 * there) -- broken for the very common case of opening a reset/verify link
 * from a different device (e.g. a phone's mail app). This route instead
 * verifies via token_hash/OTP, which works from any device.
 *
 * The link pointing here is built entirely by our own code now, not
 * Supabase's: app/api/auth/send-email-hook/route.ts (Supabase's "Send
 * Email" hook) renders our own branded template and constructs this
 * exact `?token_hash=...&type=...&next=...` URL itself, once that hook is
 * enabled in Supabase Dashboard > Authentication > Hooks > Send Email --
 * no Supabase-side email template edit needed.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = getSafeNextPath(searchParams.get("next")) ?? "/";

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
