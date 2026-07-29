import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";

const requireUserMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const updateUserMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());
const logSecurityEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/i18n/server", () => ({ getServerDictionary: () => Promise.resolve(en) }));
vi.mock("@/lib/auth/security-events", () => ({ logSecurityEvent: logSecurityEventMock }));
vi.mock("@/lib/supabase/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        signInWithPassword: signInWithPasswordMock,
        updateUser: updateUserMock,
        signOut: signOutMock,
      },
    }),
}));

const { changePasswordAction } = await import("@/app/actions/account-security");

function formData(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.append(key, value));
  return data;
}

const user = { id: "user-1", email: "user@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  requireUserMock.mockResolvedValue(user);
});

describe("changePasswordAction", () => {
  it("rejects mismatched confirmation without calling requireUser", async () => {
    const result = await changePasswordAction(
      undefined,
      formData({ currentPassword: "old", newPassword: "NewStr0ng!Pass", confirmPassword: "different" }),
    );
    expect(result).toEqual({ error: en.validation.passwordsDontMatch });
    expect(requireUserMock).not.toHaveBeenCalled();
  });

  it("never calls updateUser when the current password is wrong", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    const result = await changePasswordAction(
      undefined,
      formData({ currentPassword: "wrong", newPassword: "NewStr0ng!Pass", confirmPassword: "NewStr0ng!Pass" }),
    );

    expect(result).toEqual({ error: en.validation.currentPasswordIncorrect });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("revokes other sessions and logs the event on success", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    updateUserMock.mockResolvedValue({ error: null });

    const result = await changePasswordAction(
      undefined,
      formData({ currentPassword: "old", newPassword: "NewStr0ng!Pass", confirmPassword: "NewStr0ng!Pass" }),
    );

    expect(result).toEqual({ success: true });
    expect(signOutMock).toHaveBeenCalledWith({ scope: "others" });
    expect(logSecurityEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "password_changed", userId: "user-1" }),
    );
  });

  it("maps the same_password SDK error to a friendly message", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    updateUserMock.mockResolvedValue({ error: { code: "same_password", message: "New password should be different" } });

    const result = await changePasswordAction(
      undefined,
      formData({ currentPassword: "old", newPassword: "NewStr0ng!Pass", confirmPassword: "NewStr0ng!Pass" }),
    );

    expect(result).toEqual({ error: en.validation.newPasswordSameAsOld });
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
