import { assertActionAllowed } from "@/lib/ai/permissions";
import type { AITool, AIToolContext } from "@/lib/ai/tools/types";
import { createAdminClient } from "@/lib/supabase/admin";

async function execute(args: Record<string, unknown>, context: AIToolContext) {
  await assertActionAllowed(context.clinicId, "book_appointment");

  const dentistId = typeof args.dentistId === "string" ? args.dentistId : null;
  const startAtRaw = typeof args.startAt === "string" ? args.startAt : null;

  if (!dentistId) throw new Error("dentistId is required.");
  if (!startAtRaw) throw new Error("startAt is required.");

  const startAt = new Date(startAtRaw);
  if (Number.isNaN(startAt.getTime())) throw new Error("startAt is invalid.");

  const supabase = createAdminClient();

  const { data: dentist } = await supabase
    .from("dentists")
    .select("id")
    .eq("id", dentistId)
    .eq("clinic_id", context.clinicId)
    .eq("is_active", true)
    .maybeSingle();
  if (!dentist) throw new Error("Dentist not found for this clinic.");

  let durationMinutes = 30;
  let serviceId: string | null = null;
  if (typeof args.serviceId === "string") {
    const { data: service } = await supabase
      .from("services")
      .select("id, default_duration_minutes")
      .eq("id", args.serviceId)
      .eq("clinic_id", context.clinicId)
      .maybeSingle();
    if (!service) throw new Error("Service not found for this clinic.");
    durationMinutes = service.default_duration_minutes;
    serviceId = service.id;
  }

  const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

  let patientId: string | null = null;
  if (typeof args.patientId === "string") {
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("id", args.patientId)
      .eq("clinic_id", context.clinicId)
      .maybeSingle();
    if (!patient) throw new Error("Patient not found for this clinic.");
    patientId = patient.id;
  }

  // Application-level overlap check against real appointments -- a
  // draft isn't a real booking, so it doesn't benefit from
  // appointments' DB-level exclusion constraint.
  const { data: conflicting } = await supabase
    .from("appointments")
    .select("id")
    .eq("dentist_id", dentistId)
    .neq("status", "cancelled")
    .lt("start_at", endAt.toISOString())
    .gt("end_at", startAt.toISOString());

  if (conflicting && conflicting.length > 0) {
    throw new Error("This dentist already has an appointment during that time. Choose a different slot.");
  }

  const { data: draft, error } = await supabase
    .from("appointment_drafts")
    .insert({
      clinic_id: context.clinicId,
      conversation_id: context.conversationId ?? null,
      patient_id: patientId,
      patient_name: typeof args.patientName === "string" ? args.patientName : null,
      patient_phone: typeof args.patientPhone === "string" ? args.patientPhone : null,
      dentist_id: dentistId,
      service_id: serviceId,
      proposed_start_at: startAt.toISOString(),
      proposed_end_at: endAt.toISOString(),
      notes: typeof args.notes === "string" ? args.notes : null,
    })
    .select("id, proposed_start_at, proposed_end_at, status")
    .single();

  if (error) throw new Error(error.message);

  return draft;
}

export const draftAppointmentTool: AITool = {
  name: "draft_appointment",
  requiredAction: "book_appointment",
  description:
    "Propose a new appointment. This does NOT book a real appointment -- it creates a draft that clinic staff must review and confirm before it becomes a real booking.",
  inputSchema: {
    type: "object",
    properties: {
      dentistId: { type: "string" },
      serviceId: { type: "string" },
      startAt: { type: "string", description: "ISO 8601 datetime for the proposed start time." },
      patientId: { type: "string", description: "Existing patient id, if known." },
      patientName: { type: "string", description: "Patient's name, if not yet a registered patient." },
      patientPhone: { type: "string", description: "Patient's phone, if not yet a registered patient." },
      notes: { type: "string" },
    },
    required: ["dentistId", "startAt"],
  },
  execute,
};
