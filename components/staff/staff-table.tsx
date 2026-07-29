"use client";

import { useState } from "react";
import { Crown, MoreHorizontal, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import {
  changeMemberRoleAction,
  reactivateMemberAction,
  removeMemberAction,
  suspendMemberAction,
  transferOwnershipAction,
} from "@/app/actions/staff";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { interpolate, type Dictionary } from "@/lib/i18n";
import type { ClinicRole } from "@/lib/supabase/clinic";

export type StaffMember = {
  id: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  role: ClinicRole;
  isActive: boolean;
  suspendedAt: string | null;
};

type MemberStatus = "active" | "pending" | "suspended";

function statusOf(member: StaffMember): MemberStatus {
  if (member.isActive) return "active";
  return member.suspendedAt ? "suspended" : "pending";
}

const STATUS_VARIANT: Record<MemberStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  pending: "secondary",
  suspended: "destructive",
};

const CHANGEABLE_ROLES: ClinicRole[] = ["admin", "dentist", "receptionist"];

const selectClass =
  "h-7 min-w-0 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30";

type PendingConfirm = { type: "suspend" | "remove" | "transfer"; member: StaffMember };

export function StaffTable({
  clinicId,
  members: initialMembers,
  error,
  onRetry,
  currentUserId,
  currentUserRole,
  onNotify,
  t,
}: {
  clinicId: string;
  members: StaffMember[] | null;
  error: boolean;
  onRetry: () => void;
  currentUserId: string;
  currentUserRole: ClinicRole;
  onNotify: (message: string, variant: "success" | "error") => void;
  t: Dictionary;
}) {
  const [members, setMembers] = useState(initialMembers ?? []);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Resync local (optimistically-edited) state whenever the parent
  // supplies a genuinely new members array -- initial load or a
  // successful retry after an error. Adjusted synchronously during
  // render (React's own pattern for "reset state when a prop
  // changes") rather than in an effect.
  const [lastInitialMembers, setLastInitialMembers] = useState(initialMembers);
  if (initialMembers !== lastInitialMembers) {
    setLastInitialMembers(initialMembers);
    setMembers(initialMembers ?? []);
  }

  const list = initialMembers === null ? null : members;

  function applyLocal(id: string, patch: Partial<StaffMember>) {
    setMembers((current) => current.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function removeLocal(id: string) {
    setMembers((current) => current.filter((m) => m.id !== id));
  }

  async function handleRoleChange(member: StaffMember, newRole: ClinicRole) {
    const previousRole = member.role;
    applyLocal(member.id, { role: newRole });
    setPendingId(member.id);
    const result = await changeMemberRoleAction(clinicId, member.id, newRole);
    setPendingId(null);
    if (!result.ok) {
      applyLocal(member.id, { role: previousRole });
      onNotify(result.message, "error");
      return;
    }
    onNotify(t.common.saved, "success");
  }

  async function handleReactivate(member: StaffMember) {
    applyLocal(member.id, { isActive: true, suspendedAt: null });
    setPendingId(member.id);
    const result = await reactivateMemberAction(clinicId, member.id);
    setPendingId(null);
    if (!result.ok) {
      applyLocal(member.id, { isActive: false, suspendedAt: member.suspendedAt });
      onNotify(result.message, "error");
      return;
    }
    onNotify(t.staffManagement.members.reactivate, "success");
  }

  function openConfirm(type: PendingConfirm["type"], member: StaffMember) {
    setConfirmError(null);
    setConfirm({ type, member });
  }

  async function handleConfirm() {
    if (!confirm) return;
    const { type, member } = confirm;
    setConfirmPending(true);
    setConfirmError(null);

    if (type === "suspend") {
      const result = await suspendMemberAction(clinicId, member.id);
      setConfirmPending(false);
      if (!result.ok) {
        setConfirmError(result.message);
        return;
      }
      applyLocal(member.id, { isActive: false, suspendedAt: new Date().toISOString() });
      onNotify(t.staffManagement.members.suspend, "success");
    } else if (type === "remove") {
      const result = await removeMemberAction(clinicId, member.id);
      setConfirmPending(false);
      if (!result.ok) {
        setConfirmError(result.message);
        return;
      }
      removeLocal(member.id);
      onNotify(t.staffManagement.members.remove, "success");
    } else {
      const result = await transferOwnershipAction(clinicId, member.id);
      setConfirmPending(false);
      if (!result.ok) {
        setConfirmError(result.message);
        return;
      }
      setMembers((current) =>
        current.map((m) => {
          if (m.id === member.id) return { ...m, role: "owner" };
          if (m.userId === currentUserId) return { ...m, role: "admin" };
          return m;
        }),
      );
      onNotify(t.staffManagement.members.transferOwnership, "success");
    }
    setConfirm(null);
  }

  if (error) {
    return (
      <ErrorState
        title={t.staffManagement.members.loadError}
        action={
          <Button size="sm" variant="outline" onClick={onRetry}>
            {t.staffManagement.members.retry}
          </Button>
        }
      />
    );
  }

  if (list === null) {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (list.length === 0) {
    return <EmptyState title={t.staffManagement.members.empty} description={t.staffManagement.members.emptyDescription} />;
  }

  const dialogCopy =
    confirm?.type === "suspend"
      ? {
          title: interpolate(t.staffManagement.suspendDialog.title, { name: confirm.member.fullName ?? confirm.member.email ?? "" }),
          description: interpolate(t.staffManagement.suspendDialog.description, { name: confirm.member.fullName ?? confirm.member.email ?? "" }),
          confirmLabel: t.staffManagement.suspendDialog.confirm,
        }
      : confirm?.type === "remove"
        ? {
            title: interpolate(t.staffManagement.removeDialog.title, { name: confirm.member.fullName ?? confirm.member.email ?? "" }),
            description: interpolate(t.staffManagement.removeDialog.description, { name: confirm.member.fullName ?? confirm.member.email ?? "" }),
            confirmLabel: t.staffManagement.removeDialog.confirm,
          }
        : confirm?.type === "transfer"
          ? {
              title: interpolate(t.staffManagement.transferDialog.title, { name: confirm.member.fullName ?? confirm.member.email ?? "" }),
              description: interpolate(t.staffManagement.transferDialog.description, { name: confirm.member.fullName ?? confirm.member.email ?? "" }),
              confirmLabel: t.staffManagement.transferDialog.confirm,
            }
          : null;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.staffManagement.members.name}</TableHead>
            <TableHead>{t.staffManagement.members.email}</TableHead>
            <TableHead>{t.staffManagement.members.role}</TableHead>
            <TableHead>{t.staffManagement.members.status}</TableHead>
            <TableHead className="text-end">{t.staffManagement.members.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((member) => {
            const status = statusOf(member);
            const isSelf = member.userId === currentUserId;
            const isOwnerRow = member.role === "owner";
            const rowPending = pendingId === member.id;

            return (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {member.fullName ?? t.common.dash}
                    {isSelf && (
                      <Badge variant="outline" className="text-[10px]">
                        {t.staffManagement.members.you}
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{member.email ?? t.common.dash}</TableCell>
                <TableCell>
                  {isOwnerRow ? (
                    <Badge variant="outline" className="gap-1">
                      <Crown className="size-3" aria-hidden="true" />
                      {t.roles.owner}
                    </Badge>
                  ) : (
                    <select
                      value={member.role}
                      disabled={isSelf || rowPending}
                      onChange={(event) => handleRoleChange(member, event.target.value as ClinicRole)}
                      className={selectClass}
                      aria-label={t.staffManagement.members.role}
                    >
                      {CHANGEABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t.roles[role]}
                        </option>
                      ))}
                    </select>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[status]}>
                    {status === "active"
                      ? t.staffManagement.members.statusActive
                      : status === "pending"
                        ? t.staffManagement.members.statusPending
                        : t.staffManagement.members.statusSuspended}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  {!isOwnerRow && !isSelf && (
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" disabled={rowPending} aria-label={t.staffManagement.members.actions} />}>
                        <MoreHorizontal className="size-4" aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {status === "suspended" ? (
                          <DropdownMenuItem onClick={() => handleReactivate(member)}>
                            <ShieldCheck className="size-4" aria-hidden="true" />
                            {t.staffManagement.members.reactivate}
                          </DropdownMenuItem>
                        ) : status === "active" ? (
                          <DropdownMenuItem onClick={() => openConfirm("suspend", member)}>
                            <ShieldOff className="size-4" aria-hidden="true" />
                            {t.staffManagement.members.suspend}
                          </DropdownMenuItem>
                        ) : null}
                        {currentUserRole === "owner" && status === "active" && (
                          <DropdownMenuItem onClick={() => openConfirm("transfer", member)}>
                            <Crown className="size-4" aria-hidden="true" />
                            {t.staffManagement.members.transferOwnership}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem variant="destructive" onClick={() => openConfirm("remove", member)}>
                          <Trash2 className="size-4" aria-hidden="true" />
                          {t.staffManagement.members.remove}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {confirm && dialogCopy && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setConfirm(null);
              setConfirmError(null);
            }
          }}
          title={dialogCopy.title}
          description={dialogCopy.description}
          confirmLabel={dialogCopy.confirmLabel}
          cancelLabel={t.common.cancel}
          onConfirm={handleConfirm}
          pending={confirmPending}
          error={confirmError}
        />
      )}
    </>
  );
}
