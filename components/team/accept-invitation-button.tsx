"use client";

import { useActionState } from "react";
import { acceptInvitation } from "@/app/actions/team";
import { Button } from "@/components/ui/button";

export function AcceptInvitationButton({ membershipId }: { membershipId: string }) {
  const [state, action, pending] = useActionState(
    acceptInvitation.bind(null, membershipId),
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Joining..." : "Accept invitation"}
      </Button>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
