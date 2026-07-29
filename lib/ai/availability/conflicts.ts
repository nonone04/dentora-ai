import type { WorkingHoursBlock } from "@/lib/ai/availability/hours";
import type { AvailabilityConflict, DentistAvailability } from "@/lib/ai/availability/types";

/**
 * Explains *why* a dentist has zero slots on the requested day, so the
 * patient gets "Dr. Amrani is off that day" instead of a silent empty
 * list. Pure -- operates on already-fetched per-dentist data.
 */
export function detectConflicts(params: {
  requestedDentistId?: string | null;
  activeDentists: { id: string; fullName: string }[];
  dentistAvailability: DentistAvailability[];
  workingHoursByDentist: Record<string, WorkingHoursBlock[]>;
  timeOffCoversWholeDayByDentist: Record<string, boolean>;
}): AvailabilityConflict[] {
  const conflicts: AvailabilityConflict[] = [];

  if (params.activeDentists.length === 0) {
    conflicts.push({
      type: "no_active_dentists",
      message: params.requestedDentistId
        ? "The requested dentist is not active at this clinic."
        : "This clinic has no active dentists configured.",
    });
    return conflicts;
  }

  if (params.requestedDentistId && !params.activeDentists.some((d) => d.id === params.requestedDentistId)) {
    conflicts.push({
      type: "dentist_not_found",
      message: "The requested dentist was not found for this clinic.",
      dentistId: params.requestedDentistId,
    });
    return conflicts;
  }

  for (const dentist of params.activeDentists) {
    const availability = params.dentistAvailability.find((d) => d.dentistId === dentist.id);
    if (availability && availability.slots.length > 0) continue;

    const workingHours = params.workingHoursByDentist[dentist.id] ?? [];
    if (workingHours.length === 0) {
      conflicts.push({
        type: "outside_business_hours",
        message: `${dentist.fullName} does not work on the requested day.`,
        dentistId: dentist.id,
      });
      continue;
    }

    if (params.timeOffCoversWholeDayByDentist[dentist.id]) {
      conflicts.push({
        type: "time_off",
        message: `${dentist.fullName} is on approved time off that day.`,
        dentistId: dentist.id,
      });
      continue;
    }

    conflicts.push({
      type: "fully_booked",
      message: `${dentist.fullName} is fully booked on the requested day.`,
      dentistId: dentist.id,
    });
  }

  return conflicts;
}
