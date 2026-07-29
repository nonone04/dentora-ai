"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_PASSWORD, ensureDemoClinic, resetDemoClinicData } from "@/lib/demo/provision";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/telemetry";

export type EnterDemoFormState = { error?: string } | undefined;

/** Provisions the shared demo clinic on first use, signs the visitor in as the demo owner, and drops them straight into the product. */
export async function enterDemoAction(
  _prevState: EnterDemoFormState,
  _formData: FormData,
): Promise<EnterDemoFormState> {
  const t = await getServerDictionary();

  let clinicId: string;
  try {
    clinicId = await ensureDemoClinic();
  } catch {
    return { error: t.demo.launchError };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: DEMO_ACCOUNT_EMAIL,
    password: DEMO_ACCOUNT_PASSWORD,
  });

  if (error) {
    return { error: t.demo.launchError };
  }

  await track({ name: "Demo Started", userId: data.user.id, clinicId });

  redirect(`/clinic/${clinicId}`);
}

export type ResetDemoResult = { ok: true } | { ok: false; message: string };

/** Re-seeds the shared demo clinic to its canonical state. Guarded (via resetDemoClinicData) to clinics with is_demo=true, so it can never touch a real tenant. */
export async function resetDemoAction(clinicId: string): Promise<ResetDemoResult> {
  const user = await requireManager(clinicId);
  const t = await getServerDictionary();
  if (!user) {
    return { ok: false, message: t.demo.banner.resetError };
  }

  try {
    await resetDemoClinicData(clinicId);
  } catch {
    return { ok: false, message: t.demo.banner.resetError };
  }

  await track({ name: "Demo Reset", userId: user.id, clinicId });

  revalidatePath(`/clinic/${clinicId}`, "layout");
  return { ok: true };
}
