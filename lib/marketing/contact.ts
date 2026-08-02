export const CONTACT_INQUIRY_TYPES = ["quote", "enterprise", "demo", "general"] as const;
export type ContactInquiryType = (typeof CONTACT_INQUIRY_TYPES)[number];

export function isContactInquiryType(value: unknown): value is ContactInquiryType {
  return typeof value === "string" && (CONTACT_INQUIRY_TYPES as readonly string[]).includes(value);
}
