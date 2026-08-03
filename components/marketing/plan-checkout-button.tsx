"use client";

import { useActionState } from "react";
import { createCheckoutSession, type CheckoutFormState } from "@/app/actions/billing";
import type { CurrencyCode } from "@/lib/currency";
import type { BillingInterval, CheckoutPlan } from "@/lib/stripe/checkout";
import { cn } from "@/lib/utils";

const initialState: CheckoutFormState = undefined;

export function PlanCheckoutButton({
  plan,
  currency,
  billingInterval,
  className,
  children,
}: {
  plan: CheckoutPlan;
  currency: CurrencyCode;
  billingInterval: BillingInterval;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(
    createCheckoutSession.bind(null, plan, currency, billingInterval),
    initialState,
  );

  return (
    <form action={action}>
      <button type="submit" disabled={pending} className={cn(className, "disabled:opacity-70")}>
        {children}
      </button>
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
