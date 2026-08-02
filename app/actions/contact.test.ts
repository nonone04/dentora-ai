import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";

const checkRateLimitMock = vi.hoisted(() => vi.fn());
const sendTemplatedEmailMock = vi.hoisted(() => vi.fn());
const notificationSendMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({ get: (key: string) => (key === "x-forwarded-for" ? "203.0.113.5" : null) }),
}));
vi.mock("@/lib/i18n/server", () => ({ getServerDictionary: () => Promise.resolve(en) }));
vi.mock("@/lib/i18n/get-locale", () => ({ getServerLocale: () => Promise.resolve("en") }));
vi.mock("@/lib/ai/rate-limit", () => ({ checkRateLimit: checkRateLimitMock }));
vi.mock("@/lib/email/send", () => ({ sendTemplatedEmail: sendTemplatedEmailMock }));
vi.mock("@/lib/notifications/provider", () => ({
  getNotificationProvider: () => ({ send: notificationSendMock }),
}));
vi.mock("@/lib/telemetry", () => ({ track: trackMock }));

const { submitContactRequest } = await import("@/app/actions/contact");

function formData(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.append(key, value));
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockReturnValue(true);
  sendTemplatedEmailMock.mockResolvedValue({ success: true });
  notificationSendMock.mockResolvedValue({ success: true });
});

describe("submitContactRequest", () => {
  it("returns a validation error when required fields are missing", async () => {
    const result = await submitContactRequest(undefined, formData({ name: "", email: "", message: "" }));
    expect(result).toEqual({ error: en.marketing.contact.form.error });
    expect(notificationSendMock).not.toHaveBeenCalled();
  });

  it("notifies sales and sends the visitor an auto-reply on success", async () => {
    const result = await submitContactRequest(
      undefined,
      formData({ name: "Sarah Chen", email: "Sarah@Example.com", company: "Bright Smile Dental", inquiryType: "enterprise", message: "Tell me more" }),
    );

    expect(result).toEqual({ success: true });
    expect(notificationSendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "support@dentora.ai", subject: expect.stringContaining("Sarah Chen") }),
    );
    expect(sendTemplatedEmailMock).toHaveBeenCalledWith(
      "contact_auto_reply",
      "sarah@example.com",
      expect.objectContaining({ recipientName: "Sarah Chen" }),
      "en",
    );
    expect(trackMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Contact Sales Submitted", properties: { inquiryType: "enterprise" } }),
    );
  });

  it("defaults to a general inquiry type when none is given", async () => {
    await submitContactRequest(undefined, formData({ name: "Ali", email: "ali@example.com", message: "Hi" }));
    expect(trackMock).toHaveBeenCalledWith(expect.objectContaining({ properties: { inquiryType: "general" } }));
  });

  it("rate-limits repeated submissions from the same email", async () => {
    checkRateLimitMock.mockReturnValue(false);
    const result = await submitContactRequest(undefined, formData({ name: "Ali", email: "ali@example.com", message: "Hi" }));
    expect(result).toEqual({ error: en.marketing.contact.form.rateLimited });
    expect(notificationSendMock).not.toHaveBeenCalled();
  });
});
