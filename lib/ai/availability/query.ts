import { generateCandidateSlots, type BusyBlock, type WorkingHoursBlock } from "@/lib/ai/availability/hours";
import type { DentistAvailabilityResult } from "@/lib/ai/availability/types";
import type { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_SLOT_MINUTES = 30;

export type DentistScheduleData = {
  dentistId: string;
  dentistName: string;
  workingHours: WorkingHoursBlock[];
  timeOffBlocks: BusyBlock[];
  appointmentBlocks: BusyBlock[];
};

/** Duration comes from the requested service when given, otherwise the clinic's default slot length. Throws only when a serviceId was given but doesn't resolve -- an invalid explicit request, not a missing-preference case. */
export async function resolveDurationMinutes(
  supabase: ReturnType<typeof createAdminClient>,
  clinicId: string,
  serviceId?: string | null,
): Promise<number> {
  if (!serviceId) return DEFAULT_SLOT_MINUTES;

  const { data: service } = await supabase
    .from("services")
    .select("default_duration_minutes")
    .eq("id", serviceId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!service) throw new Error("Service not found for this clinic.");
  return service.default_duration_minutes;
}

/**
 * Fetches the raw schedule ingredients (working hours, approved time
 * off, existing appointments) for every active dentist matching the
 * filter, for one day. This is the one place that talks to Supabase for
 * scheduling data -- lib/ai/availability/query.ts's queryDentistAvailability
 * (tool-facing) and lib/ai/availability/engine.ts (ranked, conflict-aware)
 * both build on it, so they can never see different data.
 */
export async function fetchDentistScheduleData(
  supabase: ReturnType<typeof createAdminClient>,
  params: { clinicId: string; date: string; dentistId?: string | null },
): Promise<{ activeDentists: { id: string; fullName: string }[]; schedules: DentistScheduleData[] }> {
  const { clinicId, date, dentistId } = params;

  let dentistsQuery = supabase.from("dentists").select("id, full_name").eq("clinic_id", clinicId).eq("is_active", true);
  if (dentistId) dentistsQuery = dentistsQuery.eq("id", dentistId);

  const { data: dentists } = await dentistsQuery;
  const activeDentists = (dentists ?? []).map((d) => ({ id: d.id as string, fullName: d.full_name as string }));
  if (activeDentists.length === 0) return { activeDentists: [], schedules: [] };

  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59Z`);

  const schedules = await Promise.all(
    activeDentists.map(async (dentist) => {
      const [{ data: workingHoursRows }, { data: timeOffRows }, { data: appointmentRows }] = await Promise.all([
        supabase
          .from("dentist_working_hours")
          .select("start_time, end_time")
          .eq("dentist_id", dentist.id)
          .eq("day_of_week", dayOfWeek),
        supabase
          .from("dentist_time_off")
          .select("start_at, end_at")
          .eq("dentist_id", dentist.id)
          .lte("start_at", dayEnd.toISOString())
          .gte("end_at", dayStart.toISOString()),
        supabase
          .from("appointments")
          .select("start_at, end_at")
          .eq("dentist_id", dentist.id)
          .neq("status", "cancelled")
          .lte("start_at", dayEnd.toISOString())
          .gte("end_at", dayStart.toISOString()),
      ]);

      const schedule: DentistScheduleData = {
        dentistId: dentist.id,
        dentistName: dentist.fullName,
        workingHours: (workingHoursRows ?? []).map((row) => ({ startTime: row.start_time, endTime: row.end_time })),
        timeOffBlocks: (timeOffRows ?? []).map((row) => ({ start: new Date(row.start_at), end: new Date(row.end_at) })),
        appointmentBlocks: (appointmentRows ?? []).map((row) => ({ start: new Date(row.start_at), end: new Date(row.end_at) })),
      };
      return schedule;
    }),
  );

  return { activeDentists, schedules };
}

/**
 * Tool-facing shape: per-dentist candidate slots for one day, matching
 * the shape lib/ai/tools/check-availability.ts has always returned to
 * the LLM.
 */
export async function queryDentistAvailability(
  supabase: ReturnType<typeof createAdminClient>,
  params: { clinicId: string; date: string; serviceId?: string | null; dentistId?: string | null; now?: Date },
): Promise<DentistAvailabilityResult> {
  const { clinicId, date, serviceId, dentistId, now } = params;

  const durationMinutes = await resolveDurationMinutes(supabase, clinicId, serviceId);
  const { schedules } = await fetchDentistScheduleData(supabase, { clinicId, date, dentistId });

  const dentists = schedules.map((schedule) => {
    const candidates = generateCandidateSlots({
      date,
      durationMinutes,
      workingHours: schedule.workingHours,
      busyBlocks: [...schedule.timeOffBlocks, ...schedule.appointmentBlocks],
      now,
    });
    return {
      dentistId: schedule.dentistId,
      dentistName: schedule.dentistName,
      slots: candidates.map((slot) => ({ startAt: slot.startAt.toISOString(), endAt: slot.endAt.toISOString() })),
    };
  });

  return { date, durationMinutes, dentists };
}
