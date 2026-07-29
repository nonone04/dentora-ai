import type { SupabaseClient } from "@supabase/supabase-js";
import { parseUserAgent } from "@/lib/auth/parse-user-agent";

export type AccountSession = {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  userAgent: string | null;
  ip: string | null;
  notAfter: string | null;
  browser: string;
  os: string;
  deviceType: string;
};

type SessionRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  user_agent: string | null;
  ip: string | null;
  not_after: string | null;
};

export async function listMySessions(supabase: SupabaseClient): Promise<AccountSession[]> {
  const { data, error } = await supabase.rpc("list_my_sessions");
  if (error || !data) return [];

  return (data as SessionRow[]).map((row) => {
    const { browser, os, deviceType } = parseUserAgent(row.user_agent);
    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userAgent: row.user_agent,
      ip: row.ip,
      notAfter: row.not_after,
      browser,
      os,
      deviceType,
    };
  });
}

/** Revokes one specific non-current session. Returns false if it wasn't found or wasn't the caller's own. */
export async function revokeSession(supabase: SupabaseClient, sessionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("revoke_my_session", { target_session_id: sessionId });
  return !error && data === true;
}

/** Signs out every session except the current one. No RPC needed -- fully supported by the SDK. */
export async function revokeAllOtherSessions(supabase: SupabaseClient) {
  return supabase.auth.signOut({ scope: "others" });
}
