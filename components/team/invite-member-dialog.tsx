"use client";

import { useState } from "react";
import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { inviteMember, type ActionFormState } from "@/app/actions/team";
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
import { useTranslations } from "@/lib/i18n";

const initialState: ActionFormState = undefined;

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

export function InviteMemberDialog({ clinicId }: { clinicId: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(
    inviteMember.bind(null, clinicId),
    initialState,
  );
  const [handledState, setHandledState] = useState(state);
  const [open, setOpen] = useState(false);

  if (state !== handledState) {
    setHandledState(state);
    if (state?.success) {
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <UserPlus className="size-4" aria-hidden="true" />
        {t.staffManagement.members.invite}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.staffManagement.invite.title}</DialogTitle>
          <DialogDescription>{t.staffManagement.invite.description}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <Field label={t.staffManagement.invite.emailLabel}>
            <Input type="email" name="email" required />
          </Field>
          <Field label={t.staffManagement.invite.roleLabel}>
            <select name="role" defaultValue="receptionist" className={selectClass}>
              <option value="admin">{t.roles.admin}</option>
              <option value="dentist">{t.roles.dentist}</option>
              <option value="receptionist">{t.roles.receptionist}</option>
            </select>
          </Field>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t.staffManagement.invite.sending : t.staffManagement.invite.send}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
