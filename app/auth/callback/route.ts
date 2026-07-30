import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSecurityEvent } from "@/lib/auth/security-events";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/telemetry";

/**
 * Landing point for @supabase/ssr's OAuth (PKCE) flow -- signInWithGoogle
 * (app/actions/auth.ts) sends the user to Google with redirectTo pointing
 * here. Google/Supabase send either `code` (success, exchanged for a
 * session below) or `error` (user denied consent, provider misconfigured,
 * etc.), never both.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const next = searchParams.get("next") ?? "/";

  if (code && !oauthError) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const admin = createAdminClient();
      await logSecurityEvent(admin, {
        userId: data.user.id,
        eventType: "login_succeeded",
        metadata: { provider: "google" },
      });
      await track({ name: "Login", userId: data.user.id });

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
