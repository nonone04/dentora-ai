"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionFormState = { error?: string } | undefined;

function optionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function addMedicalNote(
  clinicId: string,
  patientId: string,
  _prevState: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  const user = await requireUser();

  const note = formData.get("note");
  if (typeof note !== "string" || !note.trim()) {
    return { error: "Note text is required." };
  }

  const appointmentId = formData.get("appointmentId");

  const supabase = await createClient();
  const { error } = await supabase.from("medical_notes").insert({
    patient_id: patientId,
    appointment_id: typeof appointmentId === "string" && appointmentId ? appointmentId : null,
    author_id: user.id,
    note: note.trim(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clinic/${clinicId}/patients/${patientId}`);
  return undefined;
}

export async function addTreatment(
  clinicId: string,
  patientId: string,
  _prevState: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  const user = await requireUser();

  const dentistId = formData.get("dentistId");
  const description = formData.get("description");

  if (typeof dentistId !== "string" || !dentistId) {
    return { error: "Dentist is required." };
  }
  if (typeof description !== "string" || !description.trim()) {
    return { error: "Description is required." };
  }

  const serviceId = formData.get("serviceId");
  const appointmentId = formData.get("appointmentId");
  const toothReference = optionalString(formData.get("toothReference"));
  const costRaw = formData.get("cost");
  const cost = typeof costRaw === "string" && costRaw.trim() ? Number(costRaw) : null;
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
    return { error: "Cost must be a positive number." };
  }

  const treatedAtRaw = formData.get("treatedAt");
  let treatedAt = new Date();
  if (typeof treatedAtRaw === "string" && treatedAtRaw) {
    const parsed = new Date(treatedAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Treatment date is invalid." };
    }
    treatedAt = parsed;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("treatments").insert({
    patient_id: patientId,
    dentist_id: dentistId,
    service_id: typeof serviceId === "string" && serviceId ? serviceId : null,
    appointment_id: typeof appointmentId === "string" && appointmentId ? appointmentId : null,
    description: description.trim(),
    tooth_reference: toothReference,
    cost,
    treated_at: treatedAt.toISOString(),
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clinic/${clinicId}/patients/${patientId}`);
  return undefined;
}
