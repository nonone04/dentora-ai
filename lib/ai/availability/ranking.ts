import type { AvailabilitySlot } from "@/lib/ai/availability/types";

/**
 * Vague time-of-day windows, in UTC minutes-since-midnight -- deliberately
 * the same three words lib/ai/nlu/rule-based-client.ts's extractTime
 * already produces ("morning"/"afternoon"/"evening"), so a patient's
 * stated preference lines up with ranking without any extra mapping.
 */
const PERIOD_RANGES: Record<string, [number, number]> = {
  morning: [0, 720], // 00:00-12:00
  afternoon: [720, 1020], // 12:00-17:00
  evening: [1020, 1440], // 17:00-24:00
};

const EXACT_TIME_TOLERANCE_MINUTES = 15;

function utcMinutesOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

type TimeMatch = "exact" | "period" | "none";

function matchesPreferredTime(startAt: Date, preferredTime: string): TimeMatch {
  const minutes = utcMinutesOfDay(startAt);

  const exactMatch = preferredTime.match(/^(\d{1,2}):(\d{2})$/);
  if (exactMatch) {
    const target = Number(exactMatch[1]) * 60 + Number(exactMatch[2]);
    return Math.abs(minutes - target) <= EXACT_TIME_TOLERANCE_MINUTES ? "exact" : "none";
  }

  const period = PERIOD_RANGES[preferredTime.toLowerCase()];
  if (period) {
    const [start, end] = period;
    return minutes >= start && minutes < end ? "period" : "none";
  }

  return "none";
}

/** A tiny, capped bonus for being earlier in the day -- a tiebreaker among otherwise-equal slots, never large enough to outrank a real preference match. */
function earlinessBonus(startAt: Date): number {
  const minutesIntoDay = utcMinutesOfDay(startAt);
  return 0.1 * (1 - minutesIntoDay / 1440);
}

export function scoreSlot(
  slot: Pick<AvailabilitySlot, "dentistId" | "startAt">,
  preferences: { preferredDentistId?: string | null; preferredTime?: string | null },
): number {
  let score = 0.5;

  if (preferences.preferredDentistId && slot.dentistId === preferences.preferredDentistId) {
    score += 0.3;
  }

  if (preferences.preferredTime) {
    const match = matchesPreferredTime(new Date(slot.startAt), preferences.preferredTime);
    if (match === "exact") score += 0.5;
    else if (match === "period") score += 0.2;
  }

  score += earlinessBonus(new Date(slot.startAt));

  return Math.min(1, Math.max(0, score));
}

/**
 * Scores and sorts a flat list of candidate slots (already flattened
 * across dentists) best-match-first, tie-breaking by start time so the
 * ranking is always deterministic.
 */
export function rankSlots(
  slots: AvailabilitySlot[],
  preferences: { preferredDentistId?: string | null; preferredTime?: string | null },
): AvailabilitySlot[] {
  return slots
    .map((slot) => ({ ...slot, score: scoreSlot(slot, preferences) }))
    .sort((a, b) => b.score - a.score || new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}
