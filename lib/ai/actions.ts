/**
 * The vocabulary of actions a future AI integration would be constrained
 * to. Purely declarative -- nothing here calls out to any AI provider or
 * external service. This is the contract a real integration would consume
 * later (mirrors how lib/notifications/provider.ts defines an interface
 * before any real delivery provider existed).
 */
export type AIActionName =
  | "answer_faq"
  | "check_availability"
  | "book_appointment"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "escalate_to_staff";

export type AIActionDefinition = {
  name: AIActionName;
  label: string;
  description: string;
  mutatesData: boolean;
  requiresConfirmationByDefault: boolean;
};

export const AI_ACTIONS: AIActionDefinition[] = [
  {
    name: "answer_faq",
    label: "Answer questions",
    description: "Answer patient questions using the clinic's knowledge base.",
    mutatesData: false,
    requiresConfirmationByDefault: false,
  },
  {
    name: "check_availability",
    label: "Check availability",
    description: "Look up open appointment slots for a dentist or service.",
    mutatesData: false,
    requiresConfirmationByDefault: false,
  },
  {
    name: "book_appointment",
    label: "Book appointments",
    description: "Create a new appointment on a patient's behalf.",
    mutatesData: true,
    requiresConfirmationByDefault: true,
  },
  {
    name: "reschedule_appointment",
    label: "Reschedule appointments",
    description: "Change the time of an existing appointment.",
    mutatesData: true,
    requiresConfirmationByDefault: true,
  },
  {
    name: "cancel_appointment",
    label: "Cancel appointments",
    description: "Cancel an existing appointment.",
    mutatesData: true,
    requiresConfirmationByDefault: true,
  },
  {
    name: "escalate_to_staff",
    label: "Escalate to staff",
    description: "Hand the conversation off to a human when it can't help.",
    mutatesData: false,
    requiresConfirmationByDefault: false,
  },
];
