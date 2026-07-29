"use client";

import { useActionState } from "react";
import { approveDraft, rejectDraft, type DraftActionState } from "@/app/actions/appointment-drafts";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

const initialState: DraftActionState = undefined;

export function DraftActions({ clinicId, draftId }: { clinicId: string; draftId: string }) {
  const [approveState, approveAction, approvePending] = useActionState(
    approveDraft.bind(null, clinicId, draftId),
    initialState,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectDraft.bind(null, clinicId, draftId),
    initialState,
  );
  const t = useTranslations();

  const busy = approvePending || rejectPending;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <form action={approveAction}>
          <Button type="submit" size="sm" disabled={busy}>
            {approvePending ? t.aiInbox.approving : t.aiInbox.approve}
          </Button>
        </form>
        <form action={rejectAction}>
          <Button type="submit" size="sm" variant="outline" disabled={busy}>
            {rejectPending ? t.aiInbox.rejecting : t.aiInbox.reject}
          </Button>
        </form>
      </div>
      {approveState?.error && <p className="text-xs text-destructive">{approveState.error}</p>}
      {rejectState?.error && <p className="text-xs text-destructive">{rejectState.error}</p>}
    </div>
  );
}
