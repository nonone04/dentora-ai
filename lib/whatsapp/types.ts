import type { ResponseLanguage } from "@/lib/ai/nlu/language";

/** Config a Graph API call needs -- passed explicitly rather than read from env inside client.ts, so every function stays pure/testable (mirrors WhatsAppCloudProvider's constructor-injected config). */
export type WhatsAppApiConfig = {
  accessToken: string;
  phoneNumberId: string;
};

export type WhatsAppSendResult = { success: true; providerMessageId: string } | { success: false; error: string };

export type WhatsAppPhoneNumberProfile = {
  verifiedName: string | null;
  displayPhoneNumber: string | null;
  qualityRating: string | null;
};

export type WhatsAppProfileResult = { success: true; profile: WhatsAppPhoneNumberProfile } | { success: false; error: string };

/** Everything lib/whatsapp/templates.ts's builders might need -- every field optional since not every message type uses every field. */
export type WhatsAppTemplateData = {
  patientName?: string | null;
  clinicName: string;
  dentistName?: string | null;
  serviceName?: string | null;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
  reason?: string | null;
  reviewUrl?: string | null;
};

export type WhatsAppMessageType = "reminder" | "confirmation" | "cancellation" | "reschedule" | "completed";

/**
 * Inbound webhook payload shapes (Meta Cloud API "messages" field
 * change value) -- shared between app/api/whatsapp/webhook/route.ts and
 * lib/whatsapp/webhook.ts. `statuses` (delivery/read/failure receipts
 * for messages *we* sent) is a sibling array to `messages` (inbound
 * text from patients) on the same change value; Meta only ever
 * populates one or the other per webhook delivery in practice, but both
 * are optional here since nothing guarantees that.
 */
export type CloudApiMessage = {
  from: string;
  type: string;
  text?: { body?: string };
};

export type CloudApiStatusError = { code: number; title: string; message?: string };

export type CloudApiStatus = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: CloudApiStatusError[];
};

export type CloudApiChangeValue = {
  metadata?: { phone_number_id?: string };
  messages?: CloudApiMessage[];
  statuses?: CloudApiStatus[];
};

export type CloudApiPayload = {
  entry?: { changes?: { field?: string; value?: CloudApiChangeValue }[] }[];
};

export type { ResponseLanguage as WhatsAppLanguage };
