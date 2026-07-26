"use client";

import { useActionState } from "react";
import { updateAISettings, type UpdateAISettingsFormState } from "@/app/actions/clinics";
import { AI_ACTIONS, type AIActionName } from "@/lib/ai/actions";
import { Button } from "@/components/ui/button";

const initialState: UpdateAISettingsFormState = undefined;

export function AISettingsForm({
  clinicId,
  enabled,
  allowedActions,
}: {
  clinicId: string;
  enabled: boolean;
  allowedActions: AIActionName[];
}) {
  const [state, action, pending] = useActionState(updateAISettings.bind(null, clinicId), initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="size-4 rounded border-input" />
        Enable AI assistant
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Allowed actions</span>
        {AI_ACTIONS.map((actionDef) => (
          <label key={actionDef.name} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="allowedActions"
              value={actionDef.name}
              defaultChecked={allowedActions.includes(actionDef.name)}
              className="mt-0.5 size-4 rounded border-input"
            />
            <span>
              <span className="font-medium">{actionDef.label}</span>
              <span className="block text-xs text-muted-foreground">{actionDef.description}</span>
            </span>
          </label>
        ))}
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-muted-foreground">Saved.</p>}
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
