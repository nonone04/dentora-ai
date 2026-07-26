import { createClient } from "@supabase/supabase-js";

// Service-role client. Server-only; never import this from a "use client" file.
// Scope its use narrowly (e.g. the Auth Admin API) -- it bypasses RLS entirely.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
