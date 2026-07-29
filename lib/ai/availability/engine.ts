import { detectConflicts } from "@/lib/ai/availability/conflicts";
import { generateCandidateSlots, isFullDayTimeOff } from "@/lib/ai/availability/hours";
import { AIPermissionError, assertActionAllowed } from "@/lib/ai/permissions";
import { rankSlots } from "@/lib/ai/availability/ranking";
import { resolveDentistId, resolveServiceId } from "@/lib/ai/availability/resolve";
import { fetchDentistScheduleData, resolveDurationMinutes } from "@/lib/ai/availability/query";
import type { AvailabilityConflict, AvailabilityQuery, AvailabilityResult, AvailabilitySlot } from "@/lib/ai/availability/types";
import type { ConversationState } from "@/lib/ai/state/types";
import type { createAdminClient } from "@/lib/supabase/admin";

const APPOINTMENT_RELATED_INTENTS = ["book_appointment", "reschedule_appointment", "check_availability"] as const;

export function isAppointmentRelatedIntent(intent: string): boolean {
  return (APPOINTMENT_RELATED_INTENTS as readonly string[]).includes(intent);
}

const DEFAULT_FALLBACK_SEARCH_DAYS = 7;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function addDaysUTC(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

async function queryRankedOptionsForDate(
  supabase: ReturnType<typeof createAdminClient>,
  params: { clinicId: string; date: string; dentistId?: string | null; preferredTime?: string | null },
  durationMinutes: number,
  now?: Date,
): Promise<{ options: AvailabilitySlot[]; conflicts: AvailabilityConflict[] }> {
  const { activeDentists, schedules } = await fetchDentistScheduleData(supabase, {
    clinicId: params.clinicId,
    date: params.date,
    dentistId: params.dentistId,
  });

  const flatSlots: AvailabilitySlot[] = [];
  const dentistAvailability = schedules.map((schedule) => {
    const candidates = generateCandidateSlots({
      date: params.date,
      durationMinutes,
      workingHours: schedule.workingHours,
      busyBlocks: [...schedule.timeOffBlocks, ...schedule.appointmentBlocks],
      now,
    });
    for (const slot of candidates) {
      flatSlots.push({
        dentistId: schedule.dentistId,
        dentistName: schedule.dentistName,
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
        score: 0,
      });
    }
    return {
      dentistId: schedule.dentistId,
      dentistName: schedule.dentistName,
      slots: candidates.map((slot) => ({ startAt: slot.startAt.toISOString(), endAt: slot.endAt.toISOString() })),
    };
  });

  const conflicts = detectConflicts({
    requestedDentistId: params.dentistId,
    activeDentists,
    dentistAvailability,
    workingHoursByDentist: Object.fromEntries(schedules.map((s) => [s.dentistId, s.workingHours])),
    timeOffCoversWholeDayByDentist: Object.fromEntries(
      schedules.map((s) => [s.dentistId, isFullDayTimeOff(s.workingHours, s.timeOffBlocks, params.date)]),
    ),
  });

  const options = rankSlots(flatSlots, { preferredDentistId: params.dentistId, preferredTime: params.preferredTime });

  return { options, conflicts };
}

/**
 * The engine's top-level, ConversationState-driven entry point --
 * integrated into the orchestrator immediately after the Conversation
 * State layer (see lib/ai/orchestrator.ts) so appointment-related turns
 * are grounded in real schedule data instead of an LLM guess.
 *
 * Returns null when this turn isn't appointment-related, when there's no
 * usable date yet (the Decision Engine's ask_follow_up collects one
 * first), or when the clinic hasn't enabled check_availability -- and
 * never throws: any scheduling-data failure degrades to null so the
 * turn falls back to the LLM's on-demand check_availability tool rather
 * than breaking.
 */
export async function getAvailabilityForState(
  supabase: ReturnType<typeof createAdminClient>,
  state: ConversationState,
  options: { now?: Date; fallbackSearchDays?: number } = {},
): Promise<AvailabilityResult | null> {
  if (!isAppointmentRelatedIntent(state.intent)) return null;
  if (!state.entities.date || !ISO_DATE_PATTERN.test(state.entities.date)) return null;

  try {
    await assertActionAllowed(state.clinicId, "check_availability");
  } catch (err) {
    if (err instanceof AIPermissionError) return null;
    console.error("[ai:availability] permission check failed", err instanceof Error ? err.message : err);
    return null;
  }

  try {
    const [serviceId, dentistId] = await Promise.all([
      resolveServiceId(supabase, state.clinicId, state.entities.service),
      resolveDentistId(supabase, state.clinicId, state.entities.dentist),
    ]);

    const query: AvailabilityQuery = {
      clinicId: state.clinicId,
      date: state.entities.date,
      serviceId,
      dentistId,
      preferredTime: state.entities.time,
    };

    const durationMinutes = await resolveDurationMinutes(supabase, state.clinicId, serviceId);
    const { options: ranked, conflicts } = await queryRankedOptionsForDate(supabase, query, durationMinutes, options.now);

    if (ranked.length > 0) {
      return { query, durationMinutes, options: ranked, conflicts, fallbacks: [], fallbackDate: null };
    }

    const searchDays = options.fallbackSearchDays ?? DEFAULT_FALLBACK_SEARCH_DAYS;
    for (let offset = 1; offset <= searchDays; offset += 1) {
      const candidateDate = addDaysUTC(query.date, offset);
      const { options: fallbackOptions } = await queryRankedOptionsForDate(
        supabase,
        { ...query, date: candidateDate },
        durationMinutes,
        options.now,
      );
      if (fallbackOptions.length > 0) {
        return { query, durationMinutes, options: [], conflicts, fallbacks: fallbackOptions, fallbackDate: candidateDate };
      }
    }

    return { query, durationMinutes, options: [], conflicts, fallbacks: [], fallbackDate: null };
  } catch (err) {
    console.error("[ai:availability] query failed", err instanceof Error ? err.message : err);
    return null;
  }
}
