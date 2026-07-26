"use client";

import { useActionState } from "react";
import { createDentist, type ActionFormState } from "@/app/actions/dentists";
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

export function NewDentistDialog({ clinicId }: { clinicId: string }) {
  const [state, action, pending] = useActionState(
    createDentist.bind(null, clinicId),
    initialState,
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>New dentist</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New dentist</DialogTitle>
          <DialogDescription>Add a dentist to this clinic.</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <Field label="Full name">
            <Input name="fullName" required />
          </Field>
          <Field label="Specialty (optional)">
            <Input name="specialty" />
          </Field>
          <Field label="License number (optional)">
            <Input name="licenseNumber" />
          </Field>
          <Field label="Color (optional)">
            <Input name="color" type="color" className="h-8 w-16 p-1" />
          </Field>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create dentist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
