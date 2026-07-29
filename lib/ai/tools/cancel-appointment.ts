import { findUpcomingAppointmentForPatient, transitionAppointment } from "@/lib/ai/appointments";
import { assertActionAllowed } from "@/lib/ai/permissions";
import type { AITool, AIToolContext } from "@/lib/ai/tools/types";
import { createAdminClient } from "@/lib/supabase/admin";

async function execute(args: Record<string, unknown>, context: AIToolContext) {
  await assertActionAllowed(context.clinicId, "cancel_appointment");

  const supabase = createAdminClient();

  let appointmentId = typeof args.appointmentId === "string" ? args.appointmentId : null;
  if (!appointmentId) {
    const patientId = typeof args.patientId === "string" ? args.patientId : null;
    if (!patientId) throw new Error("patientId or appointmentId is required to find the appointment to cancel.");

    const upcoming = await findUpcomingAppointmentForPatient(supabase, { clinicId: context.clinicId, patientId });
    if (!upcoming) throw new Error("No upcoming appointment found for this patient.");
    appointmentId = upcoming.id;
  }

  const reason = typeof args.reason === "string" && args.reason.trim() ? args.reason.trim() : null;

  const outcome = await transitionAppointment(supabase, {
    clinicId: context.clinicId,
    appointmentId,
    event: "cancel",
    actor: "ai_assistant",
    conversationId: context.conversationId ?? null,
    reason,
  });

  if (!outcome.ok) {
    if (outcome.reason === "not_found") throw new Error("Appointment not found for this clinic.");
    if (outcome.reason === "conflict") throw new Error("This appointment was just updated elsewhere -- please try again.");
    throw new Error(outcome.message);
  }

  return { cancelled: true, appointmentId, fromStatus: outcome.fromStatus, toStatus: outcome.toStatus };
}

export const cancelAppointmentTool: AITool = {
  name: "cancel_appointment",
  requiredAction: "cancel_appointment",
  description:
    "Cancel a patient's appointment. Validated against the appointment's real lifecycle state through the Appointment Lifecycle Engine -- rejects the request if the appointment is already completed, cancelled, or otherwise not cancellable.",
  inputSchema: {
    type: "object",
    properties: {
      appointmentId: { type: "string", description: "The appointment id, if already known." },
      patientId: {
        type: "string",
        description: "Existing patient id, used to find their upcoming appointment when appointmentId isn't known.",
      },
      reason: { type: "string", description: "Why the patient is cancelling, if given." },
    },
  },
  execute,
};
