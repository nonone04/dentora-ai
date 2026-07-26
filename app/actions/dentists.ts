"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

export type ActionFormState = { error?: string } | undefined;

function optionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function createDentist(
  clinicId: string,
  _prevState: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  const user = await requireManager(clinicId);
  if (!user) {
    return { error: "Only clinic owners and admins can add dentists." };
  }

  const fullName = formData.get("fullName");
  if (typeof fullName !== "string" || !fullName.trim()) {
    return { error: "Full name is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dentists")
    .insert({
      clinic_id: clinicId,
      full_name: fullName.trim(),
      specialty: optionalString(formData.get("specialty")),
      license_number: optionalString(formData.get("licenseNumber")),
      color: optionalString(formData.get("color")),
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  redirect(`/clinic/${clinicId}/dentists/${data.id}`);
}

export async function addWorkingHours(
  clinicId: string,
  dentistId: string,
  _prevState: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  const user = await requireManager(clinicId);
  if (!user) {
    return { error: "Only clinic owners and admins can manage working hours." };
  }

  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startTime = formData.get("startTime");
  const endTime = formData.get("endTime");

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { error: "Day of week is invalid." };
  }
  if (typeof startTime !== "string" || typeof endTime !== "string" || !startTime || !endTime) {
    return { error: "Start and end time are required." };
  }
  if (startTime >= endTime) {
    return { error: "End time must be after start time." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("dentist_working_hours").insert({
    dentist_id: dentistId,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clinic/${clinicId}/dentists/${dentistId}`);
  return undefined;
}

export async function deleteWorkingHours(clinicId: string, dentistId: string, formData: FormData) {
  const user = await requireManager(clinicId);
  if (!user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const supabase = await createClient();
  await supabase.from("dentist_working_hours").delete().eq("id", id).eq("dentist_id", dentistId);

  revalidatePath(`/clinic/${clinicId}/dentists/${dentistId}`);
}

export async function addTimeOff(
  clinicId: string,
  dentistId: string,
  _prevState: ActionFormState,
  formData: FormData,
): Promise<ActionFormState> {
  const user = await requireManager(clinicId);
  if (!user) {
    return { error: "Only clinic owners and admins can manage time off." };
  }

  const startAt = formData.get("startAt");
  const endAt = formData.get("endAt");
  const reason = optionalString(formData.get("reason"));

  if (typeof startAt !== "string" || !startAt || typeof endAt !== "string" || !endAt) {
    return { error: "Start and end are required." };
  }

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "Start or end date is invalid." };
  }
  if (end <= start) {
    return { error: "End must be after start." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("dentist_time_off").insert({
    dentist_id: dentistId,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    reason,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clinic/${clinicId}/dentists/${dentistId}`);
  return undefined;
}

export async function deleteTimeOff(clinicId: string, dentistId: string, formData: FormData) {
  const user = await requireManager(clinicId);
  if (!user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const supabase = await createClient();
  await supabase.from("dentist_time_off").delete().eq("id", id).eq("dentist_id", dentistId);

  revalidatePath(`/clinic/${clinicId}/dentists/${dentistId}`);
}
