"use client";

import { useState } from "react";
import { Ban, Check, Copy, KeyRound, Plus, TriangleAlert } from "lucide-react";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/actions/api-keys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { interpolate, type Dictionary, type Locale } from "@/lib/i18n";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function ApiKeysSection({
  clinicId,
  keys: initialKeys,
  error,
  onRetry,
  onNotify,
  t,
  locale,
}: {
  clinicId: string;
  keys: ApiKeyRow[] | null;
  error: boolean;
  onRetry: () => void;
  onNotify: (message: string, variant: "success" | "error") => void;
  t: Dictionary;
  locale: Locale;
}) {
  const [keys, setKeys] = useState(initialKeys ?? []);
  const [lastInitialKeys, setLastInitialKeys] = useState(initialKeys);
  if (initialKeys !== lastInitialKeys) {
    setLastInitialKeys(initialKeys);
    setKeys(initialKeys ?? []);
  }

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [reveal, setReveal] = useState<{ secret: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [revokePending, setRevokePending] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function handleCreate() {
    setCreatePending(true);
    setCreateError(null);
    const result = await createApiKeyAction(clinicId, name);
    setCreatePending(false);
    if (!result.ok) {
      setCreateError(result.message);
      return;
    }
    setKeys((current) => [
      { id: result.id, name: name.trim(), prefix: result.prefix, createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null },
      ...current,
    ]);
    setName("");
    setCreateOpen(false);
    setCopied(false);
    setReveal({ secret: result.secret });
    onNotify(t.staffManagement.apiKeys.generate, "success");
  }

  async function handleCopy() {
    if (!reveal) return;
    try {
      await navigator.clipboard.writeText(reveal.secret);
      setCopied(true);
    } catch {
      // Clipboard access can be denied by the browser -- the secret is still selectable text in the dialog either way.
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevokePending(true);
    setRevokeError(null);
    const result = await revokeApiKeyAction(clinicId, revokeTarget.id);
    setRevokePending(false);
    if (!result.ok) {
      setRevokeError(result.message);
      return;
    }
    setKeys((current) => current.map((k) => (k.id === revokeTarget.id ? { ...k, revokedAt: new Date().toISOString() } : k)));
    setRevokeTarget(null);
    onNotify(t.staffManagement.apiKeys.revoke, "success");
  }

  if (error) {
    return (
      <ErrorState
        title={t.staffManagement.apiKeys.loadError}
        action={
          <Button size="sm" variant="outline" onClick={onRetry}>
            {t.staffManagement.auditLog.retry}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setName("");
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t.staffManagement.apiKeys.generate}
          </Button>
        </div>

        {keys === null ? (
          <div className="flex flex-col gap-2" aria-hidden="true">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <EmptyState icon={KeyRound} title={t.staffManagement.apiKeys.empty} description={t.staffManagement.apiKeys.emptyDescription} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.staffManagement.apiKeys.name}</TableHead>
                <TableHead>{t.staffManagement.apiKeys.prefix}</TableHead>
                <TableHead>{t.staffManagement.apiKeys.created}</TableHead>
                <TableHead>{t.staffManagement.apiKeys.lastUsed}</TableHead>
                <TableHead>{t.staffManagement.apiKeys.status}</TableHead>
                <TableHead className="text-end">{t.staffManagement.apiKeys.revoke}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground" dir="ltr">
                      {key.prefix}…
                    </code>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(key.createdAt, locale)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.lastUsedAt ? formatDateTime(key.lastUsedAt, locale) : t.staffManagement.apiKeys.neverUsed}
                  </TableCell>
                  <TableCell>
                    <Badge variant={key.revokedAt ? "destructive" : "default"}>
                      {key.revokedAt ? t.staffManagement.apiKeys.statusRevoked : t.staffManagement.apiKeys.statusActive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    {!key.revokedAt && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t.staffManagement.apiKeys.revoke}
                        onClick={() => {
                          setRevokeError(null);
                          setRevokeTarget(key);
                        }}
                      >
                        <Ban className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.staffManagement.apiKeys.createDialog.title}</DialogTitle>
            <DialogDescription>{t.staffManagement.apiKeys.createDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="api-key-name" className="text-sm font-medium">
                {t.staffManagement.apiKeys.createDialog.nameLabel}
              </label>
              <Input id="api-key-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
            </div>
            {createError && (
              <p role="alert" className="text-sm text-destructive">
                {createError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" disabled={createPending || !name.trim()} onClick={handleCreate}>
              {createPending ? t.staffManagement.apiKeys.createDialog.generating : t.staffManagement.apiKeys.createDialog.generate}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reveal !== null}
        onOpenChange={(open) => {
          if (!open) setReveal(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.staffManagement.apiKeys.revealDialog.title}</DialogTitle>
            <DialogDescription>{t.staffManagement.apiKeys.revealDialog.description}</DialogDescription>
          </DialogHeader>
          {reveal && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5">
              <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
              <code dir="ltr" className="min-w-0 flex-1 overflow-x-auto text-sm">
                {reveal.secret}
              </code>
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handleCopy}>
                {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                {copied ? t.staffManagement.apiKeys.revealDialog.copied : t.staffManagement.apiKeys.revealDialog.copy}
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setReveal(null)}>
              {t.staffManagement.apiKeys.revealDialog.done}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {revokeTarget && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setRevokeTarget(null);
              setRevokeError(null);
            }
          }}
          title={interpolate(t.staffManagement.apiKeys.revokeDialog.title, { name: revokeTarget.name })}
          description={t.staffManagement.apiKeys.revokeDialog.description}
          confirmLabel={t.staffManagement.apiKeys.revokeDialog.confirm}
          cancelLabel={t.common.cancel}
          onConfirm={handleRevoke}
          pending={revokePending}
          error={revokeError}
        />
      )}
    </>
  );
}
