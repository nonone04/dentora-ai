import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/auth";

/**
 * Gate for the internal analytics dashboard (app/admin/analytics). This is
 * a Dentora-team allowlist, not the per-clinic `owner` clinic_role -- the
 * dashboard answers cross-clinic questions (which clinics are active,
 * platform-wide DAU/WAU/MAU) that no single clinic's owner should see.
 * Additive-only: does not touch lib/supabase/clinic.ts or the
 * clinic_role enum.
 */
function getAllowlistedEmails(): Set<string> {
  const raw = process.env.ANALYTICS_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requirePlatformAdmin() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const allowlist = getAllowlistedEmails();
  const email = user.email?.toLowerCase();

  if (!email || !allowlist.has(email)) {
    notFound();
  }

  return user;
}
