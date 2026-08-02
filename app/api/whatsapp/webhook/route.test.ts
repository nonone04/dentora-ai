import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const APP_SECRET = "test-app-secret";
const VERIFY_TOKEN = "test-verify-token";

const runConversationTurnMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn(() => true));
const sendMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ success: true })));
const getClinicForPhoneNumberIdMock = vi.hoisted(() => vi.fn());
const findPatientIdByPhoneMock = vi.hoisted(() => vi.fn());
const applyWhatsAppStatusUpdateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/orchestrator", () => ({ runConversationTurn: runConversationTurnMock }));
vi.mock("@/lib/ai/rate-limit", () => ({ checkRateLimit: checkRateLimitMock }));
vi.mock("@/lib/notifications/provider", () => ({ getNotificationProvider: () => ({ send: sendMock }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeSupabase }));
vi.mock("@/lib/whatsapp/clinic", () => ({ getClinicForPhoneNumberId: getClinicForPhoneNumberIdMock }));
vi.mock("@/lib/whatsapp/patient-match", () => ({ findPatientIdByPhone: findPatientIdByPhoneMock }));
vi.mock("@/lib/whatsapp/webhook", async () => {
  const actual = await vi.importActual<typeof import("@/lib/whatsapp/webhook")>("@/lib/whatsapp/webhook");
  return { ...actual, applyWhatsAppStatusUpdate: applyWhatsAppStatusUpdateMock };
});

const fakeSupabase = {
  from: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
          }),
        }),
      }),
    }),
  }),
};

const { GET, POST } = await import("@/app/api/whatsapp/webhook/route");

function sign(body: string) {
  return `sha256=${crypto.createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
}

function makeRequest(body: unknown, signature?: string) {
  const raw = JSON.stringify(body);
  return new Request("https://example.com/api/whatsapp/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": signature ?? sign(raw) },
    body: raw,
  });
}

beforeEach(() => {
  vi.stubEnv("WHATSAPP_APP_SECRET", APP_SECRET);
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", VERIFY_TOKEN);
  runConversationTurnMock.mockReset().mockResolvedValue({ reply: "Sure, see you then!" });
  checkRateLimitMock.mockReset().mockReturnValue(true);
  sendMock.mockReset().mockResolvedValue({ success: true });
  getClinicForPhoneNumberIdMock.mockReset().mockResolvedValue({ id: "clinic-1", name: "Dentora" });
  findPatientIdByPhoneMock.mockReset().mockResolvedValue("patient-1");
  applyWhatsAppStatusUpdateMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET (webhook verification handshake)", () => {
  it("echoes the challenge when the verify token matches", async () => {
    const url = `https://example.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=xyz123`;
    const response = await GET(new Request(url));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("xyz123");
  });

  it("rejects a wrong verify token", async () => {
    const url = `https://example.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=xyz123`;
    const response = await GET(new Request(url));
    expect(response.status).toBe(403);
  });
});

describe("POST (signature verification)", () => {
  it("rejects a request with an invalid signature", async () => {
    const response = await POST(makeRequest({ entry: [] }, "sha256=deadbeef"));
    expect(response.status).toBe(401);
  });

  it("rejects a request when WHATSAPP_APP_SECRET isn't configured", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "");
    const response = await POST(makeRequest({ entry: [] }));
    expect(response.status).toBe(401);
  });
});

describe("POST (inbound messages)", () => {
  const messagePayload = {
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "1234567890" },
              messages: [{ from: "15550001111", type: "text", text: { body: "Can I reschedule?" } }],
            },
          },
        ],
      },
    ],
  };

  it("resolves the clinic/patient, runs the conversation turn, and sends the reply back", async () => {
    const response = await POST(makeRequest(messagePayload));

    expect(response.status).toBe(200);
    expect(getClinicForPhoneNumberIdMock).toHaveBeenCalledWith("1234567890");
    expect(runConversationTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1", channel: "whatsapp", patientId: "patient-1", userMessage: "Can I reschedule?" }),
    );
    expect(sendMock).toHaveBeenCalledWith({ to: "15550001111", body: "Sure, see you then!" });
  });

  it("acknowledges with 200 even when no clinic maps to the phone_number_id", async () => {
    getClinicForPhoneNumberIdMock.mockResolvedValue(null);
    const response = await POST(makeRequest(messagePayload));
    expect(response.status).toBe(200);
    expect(runConversationTurnMock).not.toHaveBeenCalled();
  });

  it("acknowledges with 200 even when the sender is rate limited", async () => {
    checkRateLimitMock.mockReturnValue(false);
    const response = await POST(makeRequest(messagePayload));
    expect(response.status).toBe(200);
    expect(runConversationTurnMock).not.toHaveBeenCalled();
  });

  it("ignores non-text messages", async () => {
    const payload = {
      entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "1" }, messages: [{ from: "x", type: "image" }] } }] }],
    };
    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(200);
    expect(runConversationTurnMock).not.toHaveBeenCalled();
  });
});

describe("POST (status callbacks)", () => {
  it("applies each status receipt via applyWhatsAppStatusUpdate", async () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "1234567890" },
                statuses: [
                  { id: "wamid.a", status: "delivered", timestamp: "1700000000", recipient_id: "x" },
                  { id: "wamid.b", status: "read", timestamp: "1700000001", recipient_id: "x" },
                ],
              },
            },
          ],
        },
      ],
    };

    const response = await POST(makeRequest(payload));

    expect(response.status).toBe(200);
    expect(applyWhatsAppStatusUpdateMock).toHaveBeenCalledTimes(2);
    expect(applyWhatsAppStatusUpdateMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "wamid.a", status: "delivered" }));
    expect(applyWhatsAppStatusUpdateMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "wamid.b", status: "read" }));
  });

  it("acknowledges with 200 even when applying a status update throws", async () => {
    applyWhatsAppStatusUpdateMock.mockRejectedValue(new Error("db down"));
    const payload = {
      entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: "wamid.a", status: "failed", timestamp: "1", recipient_id: "x" }] } } ] }],
    };

    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(200);
  });
});
