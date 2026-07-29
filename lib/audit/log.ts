import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "appointment_status_changed"
  | "notification_sent"
  | "notification_failed"
  | "member_invited"
  | "member_invitation_accepted"
  | "appointment_draft_approved"
  | "appointment_draft_rejected"
  | "member_role_changed"
  | "member_suspended"
  | "member_reactivated"
  | "member_removed"
  | "ownership_transferred"
  | "api_key_created"
  | "api_key_revoked"
  | "patients_imported"
  | "dentists_imported"
  | "services_imported"
  | "whatsapp_connected"
  | "whatsapp_disconnected";

export type AuditEvent = {
  clinicId: string;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Records an audit log entry. Callers pass their own Supabase client so
 * this works identically whether called from a normal (cookie-scoped,
 * RLS-respecting) server action or from the admin client used by the
 * notification processor for system-generated entries.
 */
export async function logAuditEvent(supabase: SupabaseClient, event: AuditEvent) {
  await supabase.from("audit_logs").insert({
    clinic_id: event.clinicId,
    actor_id: event.actorId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    metadata: event.metadata ?? {},
  });
}
