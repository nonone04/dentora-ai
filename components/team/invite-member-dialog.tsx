"use client";

import { useState } from "react";
import { useActionState } from "react";
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
      <DialogTrigger render={<Button />}>Invite member</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            Invite someone to join this clinic. If they don&apos;t have an account yet, we&apos;ll
            email them an invite link.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <Field label="Email">
            <Input type="email" name="email" required />
          </Field>
          <Field label="Role">
            <select name="role" defaultValue="receptionist" className={selectClass}>
              <option value="admin">Admin</option>
              <option value="dentist">Dentist</option>
              <option value="receptionist">Receptionist</option>
            </select>
          </Field>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Inviting..." : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
