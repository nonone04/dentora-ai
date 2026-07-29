import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAccountLocked, recordLoginFailure } from "@/lib/auth/login-lockout";

describe("login-lockout", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("is not locked before any failures", () => {
    expect(isAccountLocked("acct:fresh@example.com", 5, 1000)).toBe(false);
  });

  it("locks after reaching the failure limit within the window", () => {
    const key = "acct:hammered@example.com";
    for (let i = 0; i < 5; i++) recordLoginFailure(key, 1000);
    expect(isAccountLocked(key, 5, 1000)).toBe(true);
  });

  it("does not lock one failure under the limit", () => {
    const key = "acct:almost@example.com";
    for (let i = 0; i < 4; i++) recordLoginFailure(key, 1000);
    expect(isAccountLocked(key, 5, 1000)).toBe(false);
  });

  it("checking lock status does not itself count as a failure", () => {
    const key = "acct:peek@example.com";
    for (let i = 0; i < 4; i++) recordLoginFailure(key, 1000);
    isAccountLocked(key, 5, 1000);
    isAccountLocked(key, 5, 1000);
    isAccountLocked(key, 5, 1000);
    expect(isAccountLocked(key, 5, 1000)).toBe(false);
  });

  it("failures outside the window expire", async () => {
    vi.useFakeTimers();
    const key = "acct:expiring@example.com";
    for (let i = 0; i < 5; i++) recordLoginFailure(key, 1000);
    expect(isAccountLocked(key, 5, 1000)).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(isAccountLocked(key, 5, 1000)).toBe(false);
    vi.useRealTimers();
  });

  it("isolates counters per key", () => {
    const keyA = "acct:a@example.com";
    const keyB = "acct:b@example.com";
    for (let i = 0; i < 5; i++) recordLoginFailure(keyA, 1000);
    expect(isAccountLocked(keyA, 5, 1000)).toBe(true);
    expect(isAccountLocked(keyB, 5, 1000)).toBe(false);
  });
});
