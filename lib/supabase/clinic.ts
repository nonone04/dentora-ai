import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type ClinicRole = "owner" | "admin" | "dentist" | "receptionist";

export type ClinicMembership = {
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  role: ClinicRole;
};

export async function requireClinicMembership(
  clinicId: string,
  userId: string,
): Promise<ClinicMembership> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinic_members")
    .select("role, clinics(id, name, slug)")
    .eq("clinic_id", clinicId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  const clinic = data?.clinics as { id: string; name: string; slug: string } | null | undefined;

  if (!data || !clinic) {
    notFound();
  }

  return {
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicSlug: clinic.slug,
    role: data.role as ClinicRole,
  };
}

/** Returns the authenticated user if they're owner/admin of clinicId, null otherwise. */
export async function requireManager(clinicId: string) {
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);
  if (membership.role !== "owner" && membership.role !== "admin") {
    return null;
  }
  return user;
}

/**
 * Returns the authenticated user if they're the owner of clinicId, null
 * otherwise. Stricter than requireManager -- used for actions the owner
 * alone should be able to take (renaming/editing the clinic's core
 * identity, wiping clinic data) even though admins otherwise manage most
 * other Settings sections.
 */
export async function requireOwner(clinicId: string) {
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);
  if (membership.role !== "owner") {
    return null;
  }
  return user;
}
