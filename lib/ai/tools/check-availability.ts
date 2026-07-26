import { assertActionAllowed } from "@/lib/ai/permissions";
import type { AITool, AIToolContext } from "@/lib/ai/tools/types";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_SLOT_MINUTES = 30;
const MAX_SLOTS_PER_DENTIST = 20;

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToDate(date: string, minutes: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCMinutes(result.getUTCMinutes() + minutes);
  return result;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

async function execute(args: Record<string, unknown>, context: AIToolContext) {
  await assertActionAllowed(context.clinicId, "check_availability");

  const date = typeof args.date === "string" ? args.date : null;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("A valid date (YYYY-MM-DD) is required.");
  }

  const supabase = createAdminClient();

  let durationMinutes = DEFAULT_SLOT_MINUTES;
  if (typeof args.serviceId === "string") {
    const { data: service } = await supabase
      .from("services")
      .select("default_duration_minutes")
      .eq("id", args.serviceId)
      .eq("clinic_id", context.clinicId)
      .maybeSingle();
    if (!service) {
      throw new Error("Service not found for this clinic.");
    }
    durationMinutes = service.default_duration_minutes;
  }

  let dentistsQuery = supabase
    .from("dentists")
    .select("id, full_name")
    .eq("clinic_id", context.clinicId)
    .eq("is_active", true);

  if (typeof args.dentistId === "string") {
    dentistsQuery = dentistsQuery.eq("id", args.dentistId);
  }

  const { data: dentists } = await dentistsQuery;
  if (!dentists || dentists.length === 0) {
    return { date, durationMinutes, dentists: [] };
  }

  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59Z`);

  const results = [];

  for (const dentist of dentists) {
    const [{ data: workingHours }, { data: timeOff }, { data: appointments }] = await Promise.all([
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

    const busyBlocks = [
      ...(timeOff ?? []).map((entry) => ({ start: new Date(entry.start_at), end: new Date(entry.end_at) })),
      ...(appointments ?? []).map((entry) => ({ start: new Date(entry.start_at), end: new Date(entry.end_at) })),
    ];

    const slots: { startAt: string; endAt: string }[] = [];

    for (const block of workingHours ?? []) {
      const blockStartMin = timeToMinutes(block.start_time);
      const blockEndMin = timeToMinutes(block.end_time);

      for (
        let start = blockStartMin;
        start + durationMinutes <= blockEndMin && slots.length < MAX_SLOTS_PER_DENTIST;
        start += durationMinutes
      ) {
        const slotStart = minutesToDate(date, start);
        const slotEnd = minutesToDate(date, start + durationMinutes);

        const isBusy = busyBlocks.some((busy) => overlaps(slotStart, slotEnd, busy.start, busy.end));
        if (!isBusy && slotStart.getTime() > Date.now()) {
          slots.push({ startAt: slotStart.toISOString(), endAt: slotEnd.toISOString() });
        }
      }
    }

    results.push({ dentistId: dentist.id, dentistName: dentist.full_name, slots });
  }

  return { date, durationMinutes, dentists: results };
}

export const checkAvailabilityTool: AITool = {
  name: "check_availability",
  requiredAction: "check_availability",
  description:
    "Check available appointment slots for a given date, optionally filtered by dentist or service.",
  inputSchema: {
    type: "object",
    properties: {
      date: { type: "string", description: "Date in YYYY-MM-DD format." },
      dentistId: { type: "string", description: "Optional dentist id to check a specific dentist." },
      serviceId: { type: "string", description: "Optional service id, used to determine slot duration." },
    },
    required: ["date"],
  },
  execute,
};
