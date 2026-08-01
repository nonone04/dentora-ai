import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";

const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const signUpMock = vi.hoisted(() => vi.fn());
const isAccountLockedMock = vi.hoisted(() => vi.fn());
const recordLoginFailureMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn());
const logSecurityEventMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: (key: string) => (key === "host" ? "dentora.test" : key === "user-agent" ? "test-agent" : null),
  }),
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn() }),
}));
vi.mock("@/lib/i18n/server", () => ({ getServerDictionary: () => Promise.resolve(en) }));
vi.mock("@/lib/auth/login-lockout", () => ({
  isAccountLocked: isAccountLockedMock,
  recordLoginFailure: recordLoginFailureMock,
}));
vi.mock("@/lib/ai/rate-limit", () => ({ checkRateLimit: checkRateLimitMock }));
vi.mock("@/lib/auth/security-events", () => ({ logSecurityEvent: logSecurityEventMock }));
vi.mock("@/lib/telemetry", () => ({ track: trackMock }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: vi.fn() }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
      },
    }),
}));

const { signIn, signUp } = await import("@/app/actions/auth");

function formData(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.append(key, value));
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockReturnValue(true);
  isAccountLockedMock.mockReturnValue(false);
});

describe("signIn: no information leakage", () => {
  it("returns the generic message for a wrong password", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: null, error: { message: "Invalid login credentials" } });
    const result = await signIn(undefined, formData({ email: "user@example.com", password: "wrong" }));
    expect(result).toEqual({ error: en.login.invalidCredentials });
  });

  it("returns the same generic message for a nonexistent account", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: null, error: { message: "Invalid login credentials" } });
    const result = await signIn(undefined, formData({ email: "nobody@example.com", password: "whatever" }));
    expect(result).toEqual({ error: en.login.invalidCredentials });
  });

  it("returns the same generic message when the account is locked", async () => {
    isAccountLockedMock.mockReturnValue(true);
    const result = await signIn(undefined, formData({ email: "locked@example.com", password: "whatever" }));
    expect(result).toEqual({ error: en.login.invalidCredentials });
  });
});

describe("signIn: lockout", () => {
  it("skips signInWithPassword entirely once the account is locked", async () => {
    isAccountLockedMock.mockReturnValue(true);
    await signIn(undefined, formData({ email: "locked@example.com", password: "whatever" }));
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("records a failure on a genuine wrong-password attempt", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: null, error: { message: "Invalid login credentials" } });
    await signIn(undefined, formData({ email: "user@example.com", password: "wrong" }));
    expect(recordLoginFailureMock).toHaveBeenCalledWith(expect.stringContaining("user@example.com"), expect.any(Number));
  });

  it("returns a distinct throttled message when the IP rate limit is exceeded", async () => {
    checkRateLimitMock.mockReturnValue(false);
    const result = await signIn(undefined, formData({ email: "user@example.com", password: "whatever" }));
    expect(result).toEqual({ error: en.login.tooManyAttempts });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });
});

describe("signIn: success", () => {
  it("redirects home and does not record a failure", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    await expect(signIn(undefined, formData({ email: "user@example.com", password: "correct" }))).rejects.toThrow(
      "REDIRECT:/",
    );
    expect(recordLoginFailureMock).not.toHaveBeenCalled();
    expect(logSecurityEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "login_succeeded", userId: "user-1" }),
    );
    expect(trackMock).toHaveBeenCalledWith(expect.objectContaining({ name: "Login", userId: "user-1" }));
  });

  it("redirects to /verify-email on an unconfirmed account without recording a failure", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: null, error: { code: "email_not_confirmed", message: "Email not confirmed" } });
    await expect(
      signIn(undefined, formData({ email: "unverified@example.com", password: "correct" })),
    ).rejects.toThrow("REDIRECT:/verify-email?email=unverified%40example.com");
    expect(recordLoginFailureMock).not.toHaveBeenCalled();
  });

  it("resumes a pending checkout via the `next` field instead of the dashboard", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    await expect(
      signIn(undefined, formData({ email: "user@example.com", password: "correct", next: "/checkout/standard" })),
    ).rejects.toThrow("REDIRECT:/checkout/standard");
  });

  it("ignores an off-site `next` value and falls back to the dashboard", async () => {
    signInWithPasswordMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    await expect(
      signIn(undefined, formData({ email: "user@example.com", password: "correct", next: "https://evil.example/phish" })),
    ).rejects.toThrow("REDIRECT:/");
  });
});

describe("signUp", () => {
  it("wires emailRedirectTo to the plain post-verification destination", async () => {
    signUpMock.mockResolvedValue({ data: { session: null, user: { id: "user-1" } }, error: null });
    await signUp(undefined, formData({ email: "new@example.com", password: "Str0ngP@ssword123", fullName: "New User" }));

    // Plain path, not a pre-built /auth/confirm URL -- the Send Email Hook
    // (app/api/auth/send-email-hook/route.ts) now builds the real
    // token_hash confirm link itself from this destination.
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        options: expect.objectContaining({
          emailRedirectTo: "https://dentora.test/",
        }),
      }),
    );
    expect(trackMock).toHaveBeenCalledWith(expect.objectContaining({ name: "User Registered", userId: "user-1" }));
  });

  it("carries a pending checkout's `next` field through emailRedirectTo", async () => {
    signUpMock.mockResolvedValue({ data: { session: null, user: { id: "user-1" } }, error: null });
    await signUp(
      undefined,
      formData({ email: "new@example.com", password: "Str0ngP@ssword123", fullName: "New User", next: "/checkout/professional" }),
    );

    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "https://dentora.test/checkout/professional",
        }),
      }),
    );
  });

  it("resumes a pending checkout immediately when signup returns a session", async () => {
    signUpMock.mockResolvedValue({ data: { session: { access_token: "t" }, user: { id: "user-1" } }, error: null });
    await expect(
      signUp(
        undefined,
        formData({ email: "new@example.com", password: "Str0ngP@ssword123", fullName: "New User", next: "/checkout/standard" }),
      ),
    ).rejects.toThrow("REDIRECT:/checkout/standard");
  });

  it("rejects a weak password before ever calling signUp", async () => {
    const result = await signUp(undefined, formData({ email: "new@example.com", password: "weak", fullName: "New User" }));
    expect(result?.error).toBeTruthy();
    expect(signUpMock).not.toHaveBeenCalled();
  });
});
