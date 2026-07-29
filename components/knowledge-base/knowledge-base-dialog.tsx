"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  createKnowledgeBaseEntry,
  updateKnowledgeBaseEntry,
  type ActionFormState,
} from "@/app/actions/knowledge-base";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/lib/i18n";

const initialState: ActionFormState = undefined;

type EntryRow = {
  id: string;
  category: string | null;
  question: string;
  answer: string;
  is_active: boolean;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

export function KnowledgeBaseDialog({
  clinicId,
  entry,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
}: {
  clinicId: string;
  entry?: EntryRow;
  triggerLabel: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
}) {
  const boundAction = entry
    ? updateKnowledgeBaseEntry.bind(null, clinicId, entry.id)
    : createKnowledgeBaseEntry.bind(null, clinicId);
  const [state, action, pending] = useActionState(boundAction, initialState);
  const [handledState, setHandledState] = useState(state);
  const [open, setOpen] = useState(false);
  const t = useTranslations();

  if (state !== handledState) {
    setHandledState(state);
    if (state?.success) {
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? t.knowledgeBase.dialog.editTitle : t.knowledgeBase.dialog.newTitle}</DialogTitle>
          <DialogDescription>
            {entry ? t.knowledgeBase.dialog.editDescription : t.knowledgeBase.dialog.newDescription}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <Field label={`${t.knowledgeBase.dialog.categoryLabel} (${t.common.optional})`}>
            <Input name="category" defaultValue={entry?.category ?? ""} />
          </Field>
          <Field label={t.knowledgeBase.dialog.questionLabel}>
            <Input name="question" defaultValue={entry?.question} required />
          </Field>
          <Field label={t.knowledgeBase.dialog.answerLabel}>
            <Textarea name="answer" rows={4} defaultValue={entry?.answer} required />
          </Field>
          {entry && (
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={entry.is_active}
                className="size-4 rounded border-input"
              />
              {t.knowledgeBase.dialog.activeLabel}
            </label>
          )}
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t.common.saving : entry ? t.knowledgeBase.dialog.save : t.knowledgeBase.dialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
