"use client";

import { useMemo, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import type { AuditAction } from "@/lib/audit/log";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { pluralize, type Dictionary, type Locale } from "@/lib/i18n";

export type AuditLogRow = {
  id: string;
  action: AuditAction;
  entityType: string;
  actorName: string | null;
  createdAt: string;
};

/** Client-side search + filter over a bounded, server-fetched window of audit_logs -- same posture as the AI Inspector's conversation list. */
export function AuditLogSection({
  logs,
  error,
  onRetry,
  t,
  locale,
}: {
  logs: AuditLogRow[] | null;
  error: boolean;
  onRetry: () => void;
  t: Dictionary;
  locale: Locale;
}) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction[]>([]);

  const availableActions = useMemo(() => {
    if (!logs) return [];
    return Array.from(new Set(logs.map((log) => log.action))).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    if (!logs) return [];
    return logs.filter((log) => {
      if (actionFilter.length > 0 && !actionFilter.includes(log.action)) return false;
      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        const label = t.settings.activityLog.actions[log.action] ?? log.action;
        const haystack = `${label} ${log.entityType} ${log.actorName ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [logs, search, actionFilter, t]);

  function toggleAction(action: AuditAction) {
    setActionFilter((current) => (current.includes(action) ? current.filter((a) => a !== action) : [...current, action]));
  }

  if (error) {
    return (
      <ErrorState
        title={t.staffManagement.auditLog.loadError}
        action={
          <Button size="sm" variant="outline" onClick={onRetry}>
            {t.staffManagement.auditLog.retry}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.staffManagement.auditLog.searchPlaceholder}
            className="ps-8"
            aria-label={t.staffManagement.auditLog.searchPlaceholder}
            disabled={!logs}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" disabled={!logs || availableActions.length === 0} />}>
            <Filter className="size-4" aria-hidden="true" />
            {t.staffManagement.auditLog.filterByAction}
            {actionFilter.length > 0 && (
              <Badge variant="secondary" className="ms-0.5 h-4 min-w-4 px-1 text-[10px]">
                {actionFilter.length}
              </Badge>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t.staffManagement.auditLog.filterByAction}</DropdownMenuLabel>
              {availableActions.map((action) => (
                <DropdownMenuCheckboxItem key={action} checked={actionFilter.includes(action)} onCheckedChange={() => toggleAction(action)}>
                  {t.settings.activityLog.actions[action] ?? action}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            {actionFilter.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <button
                  type="button"
                  onClick={() => setActionFilter([])}
                  className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground"
                >
                  <X className="size-3.5" aria-hidden="true" />
                  {t.staffManagement.auditLog.clearFilters}
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {logs && (
          <span className="text-xs text-muted-foreground">
            {pluralize(filtered.length, t.staffManagement.auditLog.resultCountOne, t.staffManagement.auditLog.resultCountOther)}
          </span>
        )}
      </div>

      {!logs ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState title={t.staffManagement.auditLog.empty} description={t.staffManagement.auditLog.emptyDescription} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t.staffManagement.auditLog.noResults} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.staffManagement.auditLog.event}</TableHead>
              <TableHead>{t.staffManagement.auditLog.entity}</TableHead>
              <TableHead>{t.staffManagement.auditLog.actor}</TableHead>
              <TableHead>{t.staffManagement.auditLog.when}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{t.settings.activityLog.actions[log.action] ?? log.action}</TableCell>
                <TableCell className="capitalize">{log.entityType.replace(/_/g, " ")}</TableCell>
                <TableCell>{log.actorName ?? t.staffManagement.auditLog.system}</TableCell>
                <TableCell>{formatDateTime(log.createdAt, locale)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
