export { detectConflicts } from "@/lib/ai/availability/conflicts";
export { getAvailabilityForState, isAppointmentRelatedIntent } from "@/lib/ai/availability/engine";
export {
  generateCandidateSlots,
  isFullDayTimeOff,
  isWithinWorkingHours,
  minutesToDateUTC,
  rangesOverlap,
  timeToMinutes,
} from "@/lib/ai/availability/hours";
export type { BusyBlock, CandidateSlot, WorkingHoursBlock } from "@/lib/ai/availability/hours";
export { recordAvailabilityQuery } from "@/lib/ai/availability/log";
export { findDentistMatch, findServiceMatch } from "@/lib/ai/availability/match";
export { buildAvailabilitySection } from "@/lib/ai/availability/prompt";
export { fetchDentistScheduleData, queryDentistAvailability, resolveDurationMinutes } from "@/lib/ai/availability/query";
export type { DentistScheduleData } from "@/lib/ai/availability/query";
export { rankSlots, scoreSlot } from "@/lib/ai/availability/ranking";
export { resolveDentistId, resolveServiceId } from "@/lib/ai/availability/resolve";
export type {
  AvailabilityConflict,
  AvailabilityConflictType,
  AvailabilityQuery,
  AvailabilityResult,
  AvailabilitySlot,
  DentistAvailability,
  DentistAvailabilityResult,
} from "@/lib/ai/availability/types";
