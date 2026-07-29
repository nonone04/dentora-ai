"use client";

import { useState, useTransition } from "react";
import { revokeAllOtherSessionsAction, revokeSessionAction } from "@/app/actions/account-security";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { useLocale, useTranslations } from "@/lib/i18n";
import type { AccountSession } from "@/lib/auth/sessions";

export function ActiveSessions({
  initialSessions,
  currentSessionId,
}: {
  initialSessions: AccountSession[];
  currentSessionId: string | null;
}) {
  const t = useTranslations();
  const { locale } = useLocale();
  const [sessions, setSessions] = useState(initialSessions);
  const [pending, startTransition] = useTransition();
  const [confirmTarget, setConfirmTarget] = useState<"all" | string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    if (!confirmTarget) return;
    setError(null);
    startTransition(async () => {
      if (confirmTarget === "all") {
        await revokeAllOtherSessionsAction();
        setSessions((current) => current.filter((session) => session.id === currentSessionId));
      } else {
        const revoked = await revokeSessionAction(confirmTarget);
        if (revoked) {
          setSessions((current) => current.filter((session) => session.id !== confirmTarget));
        } else {
          setError(t.accountSecurity.sessions.revokeError);
        }
      }
      setConfirmTarget(null);
    });
  }

  const otherSessions = sessions.filter((session) => session.id !== currentSessionId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t.accountSecurity.sessions.description}</p>
        {otherSessions.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirmTarget("all")}>
            {t.accountSecurity.sessions.revokeAll}
          </Button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.accountSecurity.sessions.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.accountSecurity.sessions.title}</TableHead>
              <TableHead>{t.accountSecurity.sessions.lastActive}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => {
              const isCurrent = session.id === currentSessionId;
              return (
                <TableRow key={session.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>
                        {session.browser === "Unknown" && session.os === "Unknown"
                          ? t.accountSecurity.sessions.unknownDevice
                          : `${session.browser} · ${session.os}`}
                      </span>
                      {isCurrent && (
                        <Badge variant="secondary">{t.accountSecurity.sessions.currentBadge}</Badge>
                      )}
                    </div>
                    {session.ip && <div className="text-xs text-muted-foreground">{session.ip}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(session.updatedAt ?? session.createdAt, locale)}
                  </TableCell>
                  <TableCell className="text-end">
                    {!isCurrent && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmTarget(session.id)}>
                        {t.accountSecurity.sessions.revoke}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={
          confirmTarget === "all"
            ? t.accountSecurity.sessions.revokeAllConfirmTitle
            : t.accountSecurity.sessions.revokeConfirmTitle
        }
        description={
          confirmTarget === "all"
            ? t.accountSecurity.sessions.revokeAllConfirmDescription
            : t.accountSecurity.sessions.revokeConfirmDescription
        }
        confirmLabel={t.accountSecurity.sessions.revoke}
        pendingLabel={t.common.saving}
        cancelLabel={t.common.cancel}
        onConfirm={handleConfirm}
        pending={pending}
        error={error}
      />
    </div>
  );
}
