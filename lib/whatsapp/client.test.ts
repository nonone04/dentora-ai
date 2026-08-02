import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPhoneNumberProfile, sendTemplateMessage, sendTextMessage } from "@/lib/whatsapp/client";

const CONFIG = { accessToken: "test-token", phoneNumberId: "123456" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("sendTextMessage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the provider message id on success", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ messages: [{ id: "wamid.abc123" }] }));

    const result = await sendTextMessage(CONFIG, "+15550001111", "Hello!");

    expect(result).toEqual({ success: true, providerMessageId: "wamid.abc123" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(CONFIG.phoneNumberId);
    expect(init.headers.Authorization).toBe(`Bearer ${CONFIG.accessToken}`);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ messaging_product: "whatsapp", to: "+15550001111", type: "text", text: { body: "Hello!" } });
  });

  it("fails without retrying on a non-retryable error (e.g. 400 invalid request)", async () => {
    fetchMock.mockResolvedValue(new Response("bad number", { status: 400 }));

    const result = await sendTextMessage(CONFIG, "+15550001111", "Hi");

    expect(result).toEqual({ success: false, error: expect.stringContaining("400") });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on a transient error and succeeds once the provider recovers", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ messages: [{ id: "wamid.retry-ok" }] }));

    const result = await sendTextMessage(CONFIG, "+15550001111", "Hi");

    expect(result).toEqual({ success: true, providerMessageId: "wamid.retry-ok" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after exhausting retries on a persistent transient error", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("server error", { status: 503 })));

    const result = await sendTextMessage(CONFIG, "+15550001111", "Hi");

    expect(result).toEqual({ success: false, error: expect.stringContaining("503") });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("fails gracefully (no throw) on a network error", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await sendTextMessage(CONFIG, "+15550001111", "Hi");

    expect(result).toEqual({ success: false, error: "network down" });
  });

  it("fails when the response has no message id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ messages: [] }));

    const result = await sendTextMessage(CONFIG, "+15550001111", "Hi");

    expect(result).toEqual({ success: false, error: expect.stringContaining("no message id") });
  });
});

describe("sendTemplateMessage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a template-typed payload with the given name/language/components", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ messages: [{ id: "wamid.tmpl" }] }));

    const result = await sendTemplateMessage(CONFIG, "+15550001111", "appointment_reminder", "en", [{ type: "body", parameters: [] }]);

    expect(result).toEqual({ success: true, providerMessageId: "wamid.tmpl" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      type: "template",
      template: { name: "appointment_reminder", language: { code: "en" }, components: [{ type: "body", parameters: [] }] },
    });
  });

  it("surfaces the API error on failure", async () => {
    fetchMock.mockResolvedValue(new Response("template not approved", { status: 400 }));

    const result = await sendTemplateMessage(CONFIG, "+15550001111", "unapproved_template", "en");

    expect(result).toEqual({ success: false, error: expect.stringContaining("400") });
  });
});

describe("getPhoneNumberProfile", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the verified business name and display number on success", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ verified_name: "Dentora", display_phone_number: "+36 70 159 4483", quality_rating: "GREEN" }),
    );

    const result = await getPhoneNumberProfile(CONFIG);

    expect(result).toEqual({
      success: true,
      profile: { verifiedName: "Dentora", displayPhoneNumber: "+36 70 159 4483", qualityRating: "GREEN" },
    });
  });

  it("surfaces an error when the phone number id is invalid", async () => {
    fetchMock.mockResolvedValue(new Response("not found", { status: 404 }));

    const result = await getPhoneNumberProfile(CONFIG);

    expect(result).toEqual({ success: false, error: expect.stringContaining("404") });
  });
});
