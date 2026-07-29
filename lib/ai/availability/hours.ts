/**
 * Pure slot-generation primitives -- no I/O, no Supabase. Given a day's
 * working-hours blocks and a set of already-busy time ranges (time off +
 * existing appointments), produces the list of bookable candidate slots.
 * This is the deterministic core both lib/ai/availability/query.ts (the
 * engine's own query) and lib/ai/tools/check-availability.ts (the
 * on-demand tool) build on, so the two never compute availability
 * differently.
 */

export type WorkingHoursBlock = { startTime: string; endTime: string };
export type BusyBlock = { start: Date; end: Date };
export type CandidateSlot = { startAt: Date; endAt: Date };

/** "HH:MM" or "HH:MM:SS" (Postgres `time` columns serialize with seconds) -> minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Builds a UTC Date for `date` (YYYY-MM-DD) plus an offset in minutes from midnight -- matches how appointment timestamps are stored (timestamptz, generated from naive UTC-anchored dates throughout this codebase). */
export function minutesToDateUTC(date: string, minutes: number): Date {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCMinutes(result.getUTCMinutes() + minutes);
  return result;
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

const DEFAULT_MAX_SLOTS = 20;

/**
 * Walks every working-hours block for the day in `durationMinutes`
 * increments, dropping any candidate that overlaps a busy block or has
 * already passed. Deterministic and side-effect free -- the only
 * "clock" dependency is the injectable `now`, so tests never race real
 * time.
 */
export function generateCandidateSlots(params: {
  date: string;
  durationMinutes: number;
  workingHours: WorkingHoursBlock[];
  busyBlocks: BusyBlock[];
  now?: Date;
  maxSlots?: number;
}): CandidateSlot[] {
  const { date, durationMinutes, workingHours, busyBlocks, now = new Date(), maxSlots = DEFAULT_MAX_SLOTS } = params;
  const slots: CandidateSlot[] = [];

  for (const block of workingHours) {
    const blockStartMin = timeToMinutes(block.startTime);
    const blockEndMin = timeToMinutes(block.endTime);

    for (
      let start = blockStartMin;
      start + durationMinutes <= blockEndMin && slots.length < maxSlots;
      start += durationMinutes
    ) {
      const slotStart = minutesToDateUTC(date, start);
      const slotEnd = minutesToDateUTC(date, start + durationMinutes);

      const isBusy = busyBlocks.some((busy) => rangesOverlap(slotStart, slotEnd, busy.start, busy.end));
      if (!isBusy && slotStart.getTime() > now.getTime()) {
        slots.push({ startAt: slotStart, endAt: slotEnd });
      }
    }
  }

  return slots;
}

/**
 * True if a single time-off entry spans the dentist's entire working day
 * (e.g. a vacation/sick-leave day), as opposed to a partial-day block
 * that still leaves some working hours free. Deliberately checks for one
 * block fully containing the whole span rather than unioning fragmented
 * time-off entries -- covers the common real case without the
 * complexity of general interval-union coverage.
 */
export function isFullDayTimeOff(workingHours: WorkingHoursBlock[], timeOffBlocks: BusyBlock[], date: string): boolean {
  if (workingHours.length === 0 || timeOffBlocks.length === 0) return false;

  const starts = workingHours.map((block) => timeToMinutes(block.startTime));
  const ends = workingHours.map((block) => timeToMinutes(block.endTime));
  const workStart = minutesToDateUTC(date, Math.min(...starts));
  const workEnd = minutesToDateUTC(date, Math.max(...ends));

  return timeOffBlocks.some((block) => block.start.getTime() <= workStart.getTime() && block.end.getTime() >= workEnd.getTime());
}

/**
 * True if [start, end) falls entirely within at least one working-hours
 * block that day. Deliberately a direct range check rather than
 * membership in generateCandidateSlots' fixed grid -- a specific
 * requested time (e.g. a reschedule target) doesn't have to land on a
 * duration-aligned boundary to be legitimately within business hours.
 */
export function isWithinWorkingHours(start: Date, end: Date, date: string, workingHours: WorkingHoursBlock[]): boolean {
  return workingHours.some((block) => {
    const blockStart = minutesToDateUTC(date, timeToMinutes(block.startTime));
    const blockEnd = minutesToDateUTC(date, timeToMinutes(block.endTime));
    return start.getTime() >= blockStart.getTime() && end.getTime() <= blockEnd.getTime();
  });
}
