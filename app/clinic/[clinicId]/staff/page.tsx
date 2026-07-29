import { notFound } from "next/navigation";
import type { ApiKeyRow } from "@/components/staff/api-keys-section";
import type { AuditLogRow } from "@/components/staff/audit-log-section";
import { StaffManagementClient } from "@/components/staff/staff-management-client";
import type { StaffMember } from "@/components/staff/staff-table";
import { FeatureUsageBeacon } from "@/components/telemetry/feature-usage-beacon";
import type { AuditAction } from "@/lib/audit/log";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership, type ClinicRole } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

const AUDIT_LOG_LIMIT = 200;

type MemberQueryRow = {
  id: string;
  user_id: string;
  role: ClinicRole;
  is_active: boolean;
  suspended_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

type AuditLogQueryRow = {
  id: string;
  action: AuditAction;
  entity_type: string;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

type ApiKeyQueryRow = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export default async function StaffManagementPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);

  if (membership.role !== "owner" && membership.role !== "admin") {
    notFound();
  }

  const supabase = await createClient();

  const [membersResult, auditLogsResult, apiKeysResult, t, locale] = await Promise.all([
    supabase
      .from("clinic_members")
      .select("id, user_id, role, is_active, suspended_at, profiles(full_name, email)")
      .eq("clinic_id", clinicId)
      .order("created_at"),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at, profiles(full_name, email)")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(AUDIT_LOG_LIMIT),
    supabase
      .from("clinic_api_keys")
      .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }),
    getServerDictionary(),
    getServerLocale(),
  ]);

  const members: StaffMember[] | null = membersResult.error
    ? null
    : ((membersResult.data ?? []) as unknown as MemberQueryRow[]).map((row) => ({
        id: row.id,
        userId: row.user_id,
        fullName: row.profiles?.full_name ?? null,
        email: row.profiles?.email ?? null,
        role: row.role,
        isActive: row.is_active,
        suspendedAt: row.suspended_at,
      }));

  const auditLogs: AuditLogRow[] | null = auditLogsResult.error
    ? null
    : ((auditLogsResult.data ?? []) as unknown as AuditLogQueryRow[]).map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        actorName: row.profiles?.full_name ?? row.profiles?.email ?? null,
        createdAt: row.created_at,
      }));

  const apiKeys: ApiKeyRow[] | null = apiKeysResult.error
    ? null
    : ((apiKeysResult.data ?? []) as unknown as ApiKeyQueryRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        prefix: row.key_prefix,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        revokedAt: row.revoked_at,
      }));

  return (
    <>
      <FeatureUsageBeacon feature="staff_management" clinicId={clinicId} />
      <StaffManagementClient
        clinicId={clinicId}
        currentUserId={user.id}
        currentUserRole={membership.role}
        members={members}
        membersError={membersResult.error !== null}
        auditLogs={auditLogs}
        auditLogsError={auditLogsResult.error !== null}
        apiKeys={apiKeys}
        apiKeysError={apiKeysResult.error !== null}
        t={t}
        locale={locale}
      />
    </>
  );
}
