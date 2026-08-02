import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";

const checkRateLimitMock = vi.hoisted(() => vi.fn());
const sendTemplatedEmailMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({ get: (key: string) => (key === "x-forwarded-for" ? "203.0.113.5" : null) }),
}));
vi.mock("@/lib/i18n/server", () => ({ getServerDictionary: () => Promise.resolve(en) }));
vi.mock("@/lib/i18n/get-locale", () => ({ getServerLocale: () => Promise.resolve("en") }));
vi.mock("@/lib/ai/rate-limit", () => ({ checkRateLimit: checkRateLimitMock }));
vi.mock("@/lib/email/send", () => ({ sendTemplatedEmail: sendTemplatedEmailMock }));
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
});

describe("submitContactRequest", () => {
  it("returns a validation error when required fields are missing", async () => {
    const result = await submitContactRequest(undefined, formData({ name: "", email: "", phone: "", message: "" }));
    expect(result).toEqual({ error: en.marketing.contact.form.error });
    expect(sendTemplatedEmailMock).not.toHaveBeenCalled();
  });

  it("returns a validation error when phone is missing", async () => {
    const result = await submitContactRequest(undefined, formData({ name: "Ali", email: "ali@example.com", message: "Hi" }));
    expect(result).toEqual({ error: en.marketing.contact.form.error });
  });

  it("routes Custom Plan/Enterprise inquiries to the sales inbox only, with the full lead detail", async () => {
    const result = await submitContactRequest(
      undefined,
      formData({
        name: "Sarah Chen",
        email: "Sarah@Example.com",
        phone: "+212600000000",
        company: "Bright Smile Dental",
        country: "Morocco",
        dentistCount: "8",
        clinicCount: "3",
        currentSoftware: "Excel",
        requestedFeatures: "Multi-clinic reporting",
        inquiryType: "enterprise",
        message: "Tell me more",
      }),
    );

    expect(result).toEqual({ success: true });
    expect(sendTemplatedEmailMock).toHaveBeenCalledWith(
      "contact_sales_notification",
      "contact@dentora.vip",
      expect.objectContaining({
        contactName: "Sarah Chen",
        email: "sarah@example.com",
        phone: "+212600000000",
        clinicName: "Bright Smile Dental",
        country: "Morocco",
        dentistCount: "8",
        clinicCount: "3",
        currentSoftware: "Excel",
        requestedFeatures: "Multi-clinic reporting",
      }),
      "en",
    );
    expect(sendTemplatedEmailMock).toHaveBeenCalledWith(
      "contact_auto_reply",
      "sarah@example.com",
      expect.objectContaining({ recipientName: "Sarah Chen" }),
      "en",
    );
    expect(sendTemplatedEmailMock).not.toHaveBeenCalledWith("contact_sales_notification", "hello@dentora.vip", expect.anything(), expect.anything());
    expect(trackMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Contact Sales Submitted", properties: { inquiryType: "enterprise" } }),
    );
  });

  it("routes general inquiries to both the general and support inboxes", async () => {
    await submitContactRequest(
      undefined,
      formData({ name: "Ali", email: "ali@example.com", phone: "+212600000001", message: "Hi" }),
    );

    expect(sendTemplatedEmailMock).toHaveBeenCalledWith("contact_sales_notification", "hello@dentora.vip", expect.anything(), "en");
    expect(sendTemplatedEmailMock).toHaveBeenCalledWith("contact_sales_notification", "support@dentora.vip", expect.anything(), "en");
    expect(trackMock).toHaveBeenCalledWith(expect.objectContaining({ properties: { inquiryType: "general" } }));
  });

  it("rate-limits repeated submissions from the same email", async () => {
    checkRateLimitMock.mockReturnValue(false);
    const result = await submitContactRequest(
      undefined,
      formData({ name: "Ali", email: "ali@example.com", phone: "+212600000001", message: "Hi" }),
    );
    expect(result).toEqual({ error: en.marketing.contact.form.rateLimited });
    expect(sendTemplatedEmailMock).not.toHaveBeenCalled();
  });
});
