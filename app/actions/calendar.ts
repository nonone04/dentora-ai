"use server";

import { revalidatePath } from "next/cache";
import { transitionAppointment } from "@/lib/ai/appointments";
import { fetchDentistScheduleData, isWithinWorkingHours, queryDentistAvailability, rangesOverlap } from "@/lib/ai/availability";
import { getServerDictionary } from "@/lib/i18n/server";
import type {
  CalendarAppointment,
  CalendarDentist,
  CalendarPatientOption,
  CalendarService,
  CalendarTimeOff,
  CalendarWorkingHours,
} from "@/lib/calendar/types";
import { toISODate } from "@/lib/calendar/date-grid";
import { requireUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AppointmentRow = {
  id: string;
  clinic_id: string;
  dentist_id: string;
  patient_id: string | null;
  service_id: string | null;
  start_at: string;
  end_at: string;
  status: string;
  source: string;
  notes: string | null;
  dentists: { full_name: string; color: string | null } | null;
  patients: { full_name: string } | null;
  services: { name_translations: Record<string, string> } | null;
};

function serviceLabel(nameTranslations: Record<string, string> | null | undefined): string | null {
  if (!nameTranslations) return null;
  return nameTranslations.fr || nameTranslations.en || nameTranslations.ar || null;
}

function normalizeAppointment(row: AppointmentRow): CalendarAppointment {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    dentistId: row.dentist_id,
    dentistName: row.dentists?.full_name ?? "",
    dentistColor: row.dentists?.color ?? null,
    patientId: row.patient_id,
    patientName: row.patients?.full_name ?? "",
    serviceId: row.service_id,
    serviceName: serviceLabel(row.services?.name_translations),
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status as CalendarAppointment["status"],
    source: row.source as CalendarAppointment["source"],
    notes: row.notes,
  };
}

export type CalendarData = {
  dentists: CalendarDentist[];
  services: CalendarService[];
  patients: CalendarPatientOption[];
  appointments: CalendarAppointment[];
  workingHours: CalendarWorkingHours[];
  timeOff: CalendarTimeOff[];
};

/**
 * Everything the calendar's client component needs for one visible date
 * range, in a single round trip -- called on mount and whenever the
 * view/date range changes (see components/calendar/calendar-page-client.tsx).
 * RLS-scoped like every other staff-facing read in the app; no new
 * tables, just a wider select than the plain appointments list page.
 */
export async function getCalendarData(clinicId: string, fromIso: string, toIso: string): Promise<CalendarData> {
  await requireUser();
  const supabase = await createClient();

  const { data: dentistsData } = await supabase
    .from("dentists")
    .select("id, full_name, color, is_active")
    .eq("clinic_id", clinicId)
    .order("full_name");
  const dentistIds = (dentistsData ?? []).map((d) => d.id);

  const [{ data: servicesData }, { data: patientsData }, { data: appointmentsData }, { data: workingHoursData }, { data: timeOffData }] =
    await Promise.all([
      supabase
        .from("services")
        .select("id, name_translations, default_duration_minutes")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("created_at"),
      supabase.from("patients").select("id, full_name").eq("clinic_id", clinicId).order("full_name").limit(500),
      supabase
        .from("appointments")
        .select(
          "id, clinic_id, dentist_id, patient_id, service_id, start_at, end_at, status, source, notes, dentists(full_name, color), patients(full_name), services(name_translations)",
        )
        .eq("clinic_id", clinicId)
        .lt("start_at", toIso)
        .gt("end_at", fromIso)
        .order("start_at"),
      dentistIds.length > 0
        ? supabase.from("dentist_working_hours").select("dentist_id, day_of_week, start_time, end_time").in("dentist_id", dentistIds)
        : Promise.resolve({ data: [] as { dentist_id: string; day_of_week: number; start_time: string; end_time: string }[] }),
      dentistIds.length > 0
        ? supabase
            .from("dentist_time_off")
            .select("dentist_id, start_at, end_at")
            .in("dentist_id", dentistIds)
            .lte("start_at", toIso)
            .gte("end_at", fromIso)
        : Promise.resolve({ data: [] as { dentist_id: string; start_at: string; end_at: string }[] }),
    ]);

  return {
    dentists: (dentistsData ?? []).map((d) => ({ id: d.id, fullName: d.full_name, color: d.color, isActive: d.is_active })),
    services: (servicesData ?? []).map((s) => ({
      id: s.id,
      name: serviceLabel(s.name_translations) ?? "",
      defaultDurationMinutes: s.default_duration_minutes,
    })),
    patients: (patientsData ?? []).map((p) => ({ id: p.id, fullName: p.full_name })),
    appointments: ((appointmentsData ?? []) as unknown as AppointmentRow[]).map(normalizeAppointment),
    workingHours: (workingHoursData ?? []).map((row) => ({
      dentistId: row.dentist_id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
    })),
    timeOff: (timeOffData ?? []).map((row) => ({ dentistId: row.dentist_id, startAt: row.start_at, endAt: row.end_at })),
  };
}

export type ConflictCheckResult =
  | { ok: true }
  | { ok: false; reason: "outside_hours" | "time_off" | "overlap"; message: string };

export async function checkConflictAction(params: {
  clinicId: string;
  dentistId: string;
  startAtIso: string;
  endAtIso: string;
  excludeAppointmentId?: string;
}): Promise<ConflictCheckResult> {
  await requireUser();
  return checkConflictExcluding(params);
}

/**
 * Same validation lib/ai/tools/reschedule-appointment.ts applies for the
 * AI assistant's own reschedule tool -- working hours + time off +
 * overlap against the dentist's real schedule -- reused here for the
 * calendar's drag-and-drop and resize. When moving an already-existing
 * appointment, its own current start/end is fetched first so it can be
 * excluded from the overlap set by identity (lib/ai/availability's
 * schedule data intentionally carries no ids -- every other caller has
 * no use for them). Read-only; used both for the live conflict preview
 * while dragging and as the final guard inside rescheduleAppointmentAction.
 */
async function checkConflictExcluding(params: {
  clinicId: string;
  dentistId: string;
  startAtIso: string;
  endAtIso: string;
  excludeAppointmentId?: string;
}): Promise<ConflictCheckResult> {
  const admin = createAdminClient();
  const t = await getServerDictionary();
  const startAt = new Date(params.startAtIso);
  const endAt = new Date(params.endAtIso);
  const date = toISODate(startAt);

  const { schedules } = await fetchDentistScheduleData(admin, { clinicId: params.clinicId, date, dentistId: params.dentistId });
  const schedule = schedules[0];
  if (!schedule) return { ok: false, reason: "outside_hours", message: t.calendar.conflict.dentistInactive };

  if (!isWithinWorkingHours(startAt, endAt, date, schedule.workingHours)) {
    return { ok: false, reason: "outside_hours", message: t.calendar.conflict.outsideHours };
  }

  const timeOffHit = schedule.timeOffBlocks.some((block) => rangesOverlap(startAt, endAt, block.start, block.end));
  if (timeOffHit) return { ok: false, reason: "time_off", message: t.calendar.conflict.timeOff };

  let excludedStartMs: number | null = null;
  let excludedEndMs: number | null = null;
  if (params.excludeAppointmentId) {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("appointments")
      .select("start_at, end_at")
      .eq("id", params.excludeAppointmentId)
      .eq("clinic_id", params.clinicId)
      .maybeSingle();
    if (existing) {
      excludedStartMs = new Date(existing.start_at).getTime();
      excludedEndMs = new Date(existing.end_at).getTime();
    }
  }

  const overlapHit = schedule.appointmentBlocks.some((block) => {
    if (excludedStartMs !== null && block.start.getTime() === excludedStartMs && block.end.getTime() === excludedEndMs) {
      return false;
    }
    return rangesOverlap(startAt, endAt, block.start, block.end);
  });
  if (overlapHit) return { ok: false, reason: "overlap", message: t.calendar.conflict.overlap };

  return { ok: true };
}

export type RescheduleResult = { ok: true } | { ok: false; reason: string; message: string };

/**
 * Drag-move and resize both land here -- same underlying operation
 * (change start/end, keep everything else). Reuses the Appointment
 * Lifecycle Engine's own "reschedule" transition (lib/ai/appointments),
 * the exact function lib/ai/tools/reschedule-appointment.ts calls for
 * the AI assistant, so drag-and-drop gets the same optimistic-
 * concurrency-safe, audited, notification-triggering path -- nothing
 * about that engine changes for the calendar to use it.
 */
export async function rescheduleAppointmentAction(params: {
  clinicId: string;
  appointmentId: string;
  newStartAtIso: string;
  newEndAtIso: string;
}): Promise<RescheduleResult> {
  const user = await requireUser();
  const t = await getServerDictionary();

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("dentist_id")
    .eq("id", params.appointmentId)
    .eq("clinic_id", params.clinicId)
    .maybeSingle();
  if (!appointment) return { ok: false, reason: "not_found", message: t.calendar.conflict.notFound };

  const conflict = await checkConflictExcluding({
    clinicId: params.clinicId,
    dentistId: appointment.dentist_id,
    startAtIso: params.newStartAtIso,
    endAtIso: params.newEndAtIso,
    excludeAppointmentId: params.appointmentId,
  });
  if (!conflict.ok) return { ok: false, reason: conflict.reason, message: conflict.message };

  const outcome = await transitionAppointment(supabase, {
    clinicId: params.clinicId,
    appointmentId: params.appointmentId,
    event: "reschedule",
    actor: "staff",
    actorId: user.id,
    newStartAt: params.newStartAtIso,
    newEndAt: params.newEndAtIso,
  });

  if (!outcome.ok) {
    if (outcome.reason === "not_found") return { ok: false, reason: "not_found", message: t.calendar.conflict.notFound };
    if (outcome.reason === "conflict") return { ok: false, reason: "conflict", message: t.calendar.conflict.raceLost };
    return { ok: false, reason: "invalid_transition", message: outcome.message };
  }

  revalidatePath(`/clinic/${params.clinicId}/calendar`);
  revalidatePath(`/clinic/${params.clinicId}/appointments`);
  revalidatePath(`/clinic/${params.clinicId}`);
  return { ok: true };
}

export type SuggestedSlot = { dentistId: string; dentistName: string; startAt: string; endAt: string; date: string };

/**
 * Reuses the Availability Engine's own candidate-slot generator (the
 * exact deterministic ranking the AI assistant offers patients) to
 * surface "AI-recommended" alternative times -- checked in this file's
 * search order (the requested day, then up to 6 days forward) rather
 * than lib/ai/availability's own fallback-day search, which is built
 * around a full ConversationState this UI doesn't have.
 */
export async function getSuggestedSlotsAction(params: {
  clinicId: string;
  dentistId: string;
  serviceId?: string | null;
  fromDateIso: string;
  limit?: number;
}): Promise<SuggestedSlot[]> {
  await requireUser();
  const admin = createAdminClient();
  const limit = params.limit ?? 5;
  const results: SuggestedSlot[] = [];

  for (let dayOffset = 0; dayOffset < 7 && results.length < limit; dayOffset++) {
    const date = toISODate(new Date(new Date(params.fromDateIso).getTime() + dayOffset * 24 * 60 * 60 * 1000));
    const availability = await queryDentistAvailability(admin, {
      clinicId: params.clinicId,
      date,
      serviceId: params.serviceId,
      dentistId: params.dentistId,
    });

    for (const dentist of availability.dentists) {
      for (const slot of dentist.slots) {
        if (results.length >= limit) break;
        results.push({ dentistId: dentist.dentistId, dentistName: dentist.dentistName, startAt: slot.startAt, endAt: slot.endAt, date });
      }
    }
  }

  return results;
}
