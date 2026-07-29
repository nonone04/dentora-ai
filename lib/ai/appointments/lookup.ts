import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoarseAppointmentStatus } from "@/lib/ai/appointments/derive";

export type UpcomingAppointment = {
  id: string;
  dentistId: string;
  serviceId: string | null;
  startAt: string;
  endAt: string;
  status: CoarseAppointmentStatus;
};

/**
 * Finds the patient's next upcoming, still-active appointment for this
 * clinic -- the cancel/reschedule AI tools use this to resolve "my
 * appointment" without the patient ever needing to know an id. Returns
 * null (never throws) when there's nothing to act on.
 */
export async function findUpcomingAppointmentForPatient(
  supabase: SupabaseClient,
  params: { clinicId: string; patientId: string; now?: Date },
): Promise<UpcomingAppointment | null> {
  const now = params.now ?? new Date();

  const { data } = await supabase
    .from("appointments")
    .select("id, dentist_id, service_id, start_at, end_at, status")
    .eq("clinic_id", params.clinicId)
    .eq("patient_id", params.patientId)
    .in("status", ["scheduled", "confirmed"])
    .gt("start_at", now.toISOString())
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    dentistId: data.dentist_id,
    serviceId: data.service_id,
    startAt: data.start_at,
    endAt: data.end_at,
    status: data.status,
  };
}
