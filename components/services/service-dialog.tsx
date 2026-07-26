"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createService, updateService, type ActionFormState } from "@/app/actions/services";
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

type ServiceRow = {
  id: string;
  name_translations: Record<string, string>;
  default_duration_minutes: number;
  price: number | string | null;
  currency: string;
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

export function ServiceDialog({
  clinicId,
  service,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
}: {
  clinicId: string;
  service?: ServiceRow;
  triggerLabel: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
}) {
  const boundAction = service
    ? updateService.bind(null, clinicId, service.id)
    : createService.bind(null, clinicId);
  const [state, action, pending] = useActionState(boundAction, initialState);
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
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{service ? "Edit service" : "New service"}</DialogTitle>
          <DialogDescription>
            {service ? "Update this service." : "Add a service to this clinic."}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <Field label="Name (French)">
            <Input name="nameFr" defaultValue={service?.name_translations.fr} />
          </Field>
          <Field label="Name (Arabic)">
            <Input name="nameAr" defaultValue={service?.name_translations.ar} dir="rtl" />
          </Field>
          <Field label="Name (English)">
            <Input name="nameEn" defaultValue={service?.name_translations.en} />
          </Field>
          <Field label="Duration (minutes)">
            <Input
              type="number"
              name="defaultDurationMinutes"
              min={5}
              step={5}
              defaultValue={service?.default_duration_minutes ?? 30}
              required
            />
          </Field>
          <Field label="Price (optional)">
            <Input
              type="number"
              name="price"
              min={0}
              step="0.01"
              defaultValue={service?.price ?? ""}
            />
          </Field>
          <Field label="Currency">
            <Input name="currency" defaultValue={service?.currency ?? "MAD"} />
          </Field>
          {service && (
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={service.is_active}
                className="size-4 rounded border-input"
              />
              Active
            </label>
          )}
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : service ? "Save changes" : "Create service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
