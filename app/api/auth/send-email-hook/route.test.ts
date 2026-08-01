import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";

const sendTemplatedEmailMock = vi.fn();
vi.mock("@/lib/email/send", () => ({
  sendTemplatedEmail: (...args: unknown[]) => sendTemplatedEmailMock(...args),
}));

const SECRET_B64 = Buffer.from("test-only-signing-secret-do-not-use").toString("base64");
const HOOK_SECRET = `v1,whsec_${SECRET_B64}`;

function buildSignedRequest(payload: unknown, options: { tamperAfterSigning?: boolean } = {}) {
  const body = JSON.stringify(payload);
  const wh = new Webhook(SECRET_B64);
  const msgId = "msg_test_1";
  const timestamp = new Date();
  const signature = wh.sign(msgId, timestamp, body);

  const finalBody = options.tamperAfterSigning ? JSON.stringify({ ...(payload as object), tampered: true }) : body;

  return new Request("http://localhost/api/auth/send-email-hook", {
    method: "POST",
    body: finalBody,
    headers: {
      "webhook-id": msgId,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": signature,
    },
  });
}

function payloadFor(email: string, emailActionType: string, userMetadata: Record<string, unknown> = {}) {
  return {
    user: { id: "user-1", email, user_metadata: userMetadata },
    email_data: {
      token_hash: "abc123",
      redirect_to: "https://app.example.com/",
      email_action_type: emailActionType,
      site_url: "https://app.example.com",
    },
  };
}

describe("POST /api/auth/send-email-hook", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_AUTH_HOOK_SECRET", HOOK_SECRET);
    sendTemplatedEmailMock.mockReset();
    sendTemplatedEmailMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rejects a request whose body doesn't match its signature", async () => {
    const { POST } = await import("./route");
    const request = buildSignedRequest(payloadFor("invalid-sig@example.com", "signup"), { tamperAfterSigning: true });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(sendTemplatedEmailMock).not.toHaveBeenCalled();
  });

  it("sends verify_email for a signup action, building the /auth/confirm link from token_hash", async () => {
    const { POST } = await import("./route");
    const request = buildSignedRequest(payloadFor("signup@example.com", "signup", { full_name: "Amina" }));

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendTemplatedEmailMock).toHaveBeenCalledWith(
      "verify_email",
      "signup@example.com",
      expect.objectContaining({
        recipientName: "Amina",
        verifyUrl: expect.stringMatching(/\/auth\/confirm\?.*token_hash=abc123.*type=signup/),
      }),
      "en",
    );
  });

  it("sends password_reset for a recovery action", async () => {
    const { POST } = await import("./route");
    const request = buildSignedRequest(payloadFor("recovery@example.com", "recovery"));

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendTemplatedEmailMock).toHaveBeenCalledWith(
      "password_reset",
      "recovery@example.com",
      expect.objectContaining({ resetUrl: expect.stringMatching(/type=recovery/) }),
      "en",
    );
  });

  it("sends staff_invitation for an invite action, using inviter/clinic metadata and locale", async () => {
    const { POST } = await import("./route");
    const request = buildSignedRequest(payloadFor("invite@example.com", "invite", {
      inviter_name: "Dr. Bennani",
      clinic_name: "Sourire Clinic",
      invited_role: "dentist",
      locale: "fr",
    }));

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendTemplatedEmailMock).toHaveBeenCalledWith(
      "staff_invitation",
      "invite@example.com",
      expect.objectContaining({
        inviterName: "Dr. Bennani",
        clinicName: "Sourire Clinic",
        role: "dentist",
      }),
      "fr",
    );
  });

  it("acknowledges with 200 and sends nothing for an action type with no branded template", async () => {
    const { POST } = await import("./route");
    const request = buildSignedRequest(payloadFor("other@example.com", "email_change"));

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendTemplatedEmailMock).not.toHaveBeenCalled();
  });

  it("still acknowledges with 200 when the underlying send fails, so Supabase never blocks the auth operation", async () => {
    sendTemplatedEmailMock.mockResolvedValue({ success: false, error: "boom" });
    const { POST } = await import("./route");
    const request = buildSignedRequest(payloadFor("failure@example.com", "signup"));

    const response = await POST(request);

    expect(response.status).toBe(200);
  });
});
