import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountSecurityEventType =
  | "login_succeeded"
  | "login_failed"
  | "account_locked"
  | "password_reset_requested"
  | "password_reset_completed"
  | "password_changed"
  | "email_verification_sent"
  | "email_verified"
  | "session_revoked"
  | "all_other_sessions_revoked";

export type AccountSecurityEvent = {
  userId: string | null;
  eventType: AccountSecurityEventType;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Records an account-level security event. Some events (failed login,
 * lockout) have no authenticated session, so callers typically pass the
 * admin client here rather than a request-scoped one -- see
 * lib/supabase/admin.ts. Mirrors lib/audit/log.ts's dual-client shape.
 */
export async function logSecurityEvent(supabase: SupabaseClient, event: AccountSecurityEvent) {
  await supabase.from("account_security_events").insert({
    user_id: event.userId,
    event_type: event.eventType,
    ip: event.ip ?? null,
    user_agent: event.userAgent ?? null,
    metadata: event.metadata ?? {},
  });
}
