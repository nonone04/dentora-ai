import type { CommunicationPreferences, ReliabilityScore, SchedulingPreferences } from "@/lib/ai/patient/types";

export type SummaryInputs = {
  patientName: string;
  reliability: ReliabilityScore;
  communication: CommunicationPreferences;
  scheduling: SchedulingPreferences;
};

/**
 * Deterministic, template-based patient summary -- always available
 * (no network, no API key), and what lib/ai/patient/summary.ts falls
 * back to whenever the optional LLM-generated summary isn't configured
 * or fails. Never invents anything not present in the inputs.
 */
export function buildRuleBasedSummary(inputs: SummaryInputs): string {
  const { patientName, reliability, communication, scheduling } = inputs;
  const sentences: string[] = [];

  if (reliability.sampleSize === 0) {
    sentences.push(`${patientName} has no appointment history yet.`);
  } else {
    const appointmentWord = reliability.sampleSize === 1 ? "appointment" : "appointments";
    sentences.push(
      `${patientName} has ${reliability.sampleSize} past ${appointmentWord} ` +
        `(${reliability.completedCount} completed, ${reliability.noShowCount} no-show, ${reliability.cancelledCount} cancelled) -- ` +
        `reliability: ${reliability.label.replace("_", " ")}.`,
    );
  }

  if (communication.preferredChannel) {
    sentences.push(`Prefers contact via ${communication.preferredChannel}.`);
  }

  const schedulingBits: string[] = [];
  if (scheduling.preferredTimeOfDay) schedulingBits.push(`${scheduling.preferredTimeOfDay} appointments`);
  if (scheduling.preferredDentistId) schedulingBits.push("usually sees the same dentist");
  if (schedulingBits.length > 0) sentences.push(`Tends to prefer ${schedulingBits.join(" and ")}.`);

  return sentences.join(" ");
}
