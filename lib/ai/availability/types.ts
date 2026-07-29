/** One concrete, bookable slot -- always the output of real schedule data, never invented. */
export type AvailabilitySlot = {
  dentistId: string;
  dentistName: string;
  startAt: string;
  endAt: string;
  /** 0..1 -- how well this slot matches the patient's stated preferences (dentist/time-of-day) plus a small earliness tiebreaker. See lib/ai/availability/ranking.ts. */
  score: number;
};

export type AvailabilityConflictType =
  | "no_active_dentists"
  | "dentist_not_found"
  | "outside_business_hours"
  | "time_off"
  | "fully_booked";

export type AvailabilityConflict = {
  type: AvailabilityConflictType;
  message: string;
  dentistId?: string;
};

export type AvailabilityQuery = {
  clinicId: string;
  /** YYYY-MM-DD, the anchor date the patient asked about. */
  date: string;
  serviceId?: string | null;
  dentistId?: string | null;
  /** "HH:MM" or a vague period ("morning"/"afternoon"/"evening") -- ranking-only, never filters a slot out. */
  preferredTime?: string | null;
};

/** Per-dentist raw availability for one day -- the shape lib/ai/tools/check-availability.ts has always returned; also the building block the engine ranks on top of. */
export type DentistAvailability = {
  dentistId: string;
  dentistName: string;
  slots: { startAt: string; endAt: string }[];
};

export type DentistAvailabilityResult = {
  date: string;
  durationMinutes: number;
  dentists: DentistAvailability[];
};

/** The engine's full, ranked answer for a ConversationState -- see lib/ai/availability/engine.ts. */
export type AvailabilityResult = {
  query: AvailabilityQuery;
  durationMinutes: number;
  /** Ranked slots for the exact requested date (and dentist, if given), best match first. Empty when the day has no availability -- see `fallbacks`. */
  options: AvailabilitySlot[];
  conflicts: AvailabilityConflict[];
  /** Populated only when `options` is empty -- the nearest subsequent day (within the search window) that does have availability under the same filters. */
  fallbacks: AvailabilitySlot[];
  /** The date `fallbacks` was found on, if any. */
  fallbackDate: string | null;
};
