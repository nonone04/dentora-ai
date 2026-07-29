"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiKeysSection, type ApiKeyRow } from "@/components/staff/api-keys-section";
import { AuditLogSection, type AuditLogRow } from "@/components/staff/audit-log-section";
import { StaffTable, type StaffMember } from "@/components/staff/staff-table";
import { InviteMemberDialog } from "@/components/team/invite-member-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { ClinicRole } from "@/lib/supabase/clinic";
import { cn } from "@/lib/utils";

type ToastItem = { id: number; message: string; variant: "success" | "error" };

/**
 * All three sections' data is fetched server-side in page.tsx
 * (Promise.all over independent queries, each degrading to its own
 * error flag rather than failing the whole page) -- "retry" here is
 * just router.refresh(), which re-runs the Server Component and
 * re-fetches everything, matching how every other server-rendered
 * page in this app already recovers from a failed load.
 */
export function StaffManagementClient({
  clinicId,
  currentUserId,
  currentUserRole,
  members,
  membersError,
  auditLogs,
  auditLogsError,
  apiKeys,
  apiKeysError,
  t,
  locale,
}: {
  clinicId: string;
  currentUserId: string;
  currentUserRole: ClinicRole;
  members: StaffMember[] | null;
  membersError: boolean;
  auditLogs: AuditLogRow[] | null;
  auditLogsError: boolean;
  apiKeys: ApiKeyRow[] | null;
  apiKeysError: boolean;
  t: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastCounter = useRef(0);

  function pushToast(message: string, variant: ToastItem["variant"]) {
    const id = ++toastCounter.current;
    setToasts((current) => [...current, { id, message, variant }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }

  function retry() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{t.staffManagement.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.staffManagement.description}</p>
        </div>
        <InviteMemberDialog clinicId={clinicId} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.staffManagement.members.title}</CardTitle>
          <CardDescription>{t.staffManagement.members.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <StaffTable
            clinicId={clinicId}
            members={members}
            error={membersError}
            onRetry={retry}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onNotify={pushToast}
            t={t}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.staffManagement.apiKeys.title}</CardTitle>
          <CardDescription>{t.staffManagement.apiKeys.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeysSection clinicId={clinicId} keys={apiKeys} error={apiKeysError} onRetry={retry} onNotify={pushToast} t={t} locale={locale} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.staffManagement.auditLog.title}</CardTitle>
          <CardDescription>{t.staffManagement.auditLog.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogSection logs={auditLogs} error={auditLogsError} onRetry={retry} t={t} locale={locale} />
        </CardContent>
      </Card>

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto rounded-lg px-3 py-2 text-sm shadow-lg",
              toast.variant === "error" ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background",
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
