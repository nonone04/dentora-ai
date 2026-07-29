"use server";

import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/** Marks the first-run product tour as seen (whether finished or skipped) so it never reappears for this user. */
export async function completeOnboardingTourAction(): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("profiles").update({ onboarding_tour_completed_at: new Date().toISOString() }).eq("id", user.id);
}
