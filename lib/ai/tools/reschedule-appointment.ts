import { findUpcomingAppointmentForPatient, transitionAppointment } from "@/lib/ai/appointments";
import { fetchDentistScheduleData, isWithinWorkingHours, rangesOverlap } from "@/lib/ai/availability";
import { assertActionAllowed } from "@/lib/ai/permissions";
import type { AITool, AIToolContext } from "@/lib/ai/tools/types";
import { createAdminClient } from "@/lib/supabase/admin";

async function execute(args: Record<string, unknown>, context: AIToolContext) {
  await assertActionAllowed(context.clinicId, "reschedule_appointment");

  const newStartAtRaw = typeof args.newStartAt === "string" ? args.newStartAt : null;
  if (!newStartAtRaw) throw new Error("newStartAt is required.");
  const newStartAt = new Date(newStartAtRaw);
  if (Number.isNaN(newStartAt.getTime())) throw new Error("newStartAt is invalid.");

  const supabase = createAdminClient();

  let appointmentId = typeof args.appointmentId === "string" ? args.appointmentId : null;
  if (!appointmentId) {
    const patientId = typeof args.patientId === "string" ? args.patientId : null;
    if (!patientId) throw new Error("patientId or appointmentId is required to find the appointment to reschedule.");

    const upcoming = await findUpcomingAppointmentForPatient(supabase, { clinicId: context.clinicId, patientId });
    if (!upcoming) throw new Error("No upcoming appointment found for this patient.");
    appointmentId = upcoming.id;
  }

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, dentist_id, start_at, end_at")
    .eq("id", appointmentId)
    .eq("clinic_id", context.clinicId)
    .maybeSingle();
  if (!appointment) throw new Error("Appointment not found for this clinic.");

  const durationMinutes = Math.round(
    (new Date(appointment.end_at).getTime() - new Date(appointment.start_at).getTime()) / 60_000,
  );
  const newEndAt = new Date(newStartAt.getTime() + durationMinutes * 60_000);
  const date = newStartAt.toISOString().slice(0, 10);
  const currentStartMs = new Date(appointment.start_at).getTime();

  // Real-availability check (Availability Engine) against the dentist's
  // actual schedule for the new day -- this appointment's own current
  // slot is excluded from the busy blocks it's checked against, since
  // we're moving it, not double-booking against itself.
  const { schedules } = await fetchDentistScheduleData(supabase, {
    clinicId: context.clinicId,
    date,
    dentistId: appointment.dentist_id,
  });
  const schedule = schedules[0];
  if (!schedule) throw new Error("The dentist is not active for this clinic.");

  if (!isWithinWorkingHours(newStartAt, newEndAt, date, schedule.workingHours)) {
    throw new Error("The requested time is outside the dentist's working hours.");
  }

  const busyBlocks = [
    ...schedule.timeOffBlocks,
    ...schedule.appointmentBlocks.filter((block) => block.start.getTime() !== currentStartMs),
  ];
  if (busyBlocks.some((block) => rangesOverlap(newStartAt, newEndAt, block.start, block.end))) {
    throw new Error("This dentist already has an appointment during that time. Choose a different slot.");
  }

  const outcome = await transitionAppointment(supabase, {
    clinicId: context.clinicId,
    appointmentId,
    event: "reschedule",
    actor: "ai_assistant",
    conversationId: context.conversationId ?? null,
    newStartAt: newStartAt.toISOString(),
    newEndAt: newEndAt.toISOString(),
  });

  if (!outcome.ok) {
    if (outcome.reason === "not_found") throw new Error("Appointment not found for this clinic.");
    if (outcome.reason === "conflict") throw new Error("This appointment was just updated elsewhere -- please try again.");
    throw new Error(outcome.message);
  }

  return { rescheduled: true, appointmentId, startAt: newStartAt.toISOString(), endAt: newEndAt.toISOString() };
}

export const rescheduleAppointmentTool: AITool = {
  name: "reschedule_appointment",
  requiredAction: "reschedule_appointment",
  description:
    "Move a patient's appointment to a new time. Checked against the dentist's real working hours, time off, and existing appointments through the Availability Engine before committing -- never just trusts a suggested time.",
  inputSchema: {
    type: "object",
    properties: {
      appointmentId: { type: "string", description: "The appointment id, if already known." },
      patientId: {
        type: "string",
        description: "Existing patient id, used to find their upcoming appointment when appointmentId isn't known.",
      },
      newStartAt: { type: "string", description: "ISO 8601 datetime for the new start time." },
    },
    required: ["newStartAt"],
  },
  execute,
};
