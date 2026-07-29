import { beforeEach, describe, expect, it, vi } from "vitest";

const captureMock = vi.hoisted(() => vi.fn());
const identifyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/telemetry/providers/supabase-provider", () => ({
  createSupabaseAnalyticsProvider: () => ({ capture: captureMock, identify: identifyMock }),
}));

const { track, identify } = await import("@/lib/telemetry");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("track", () => {
  it("calls the provider's capture exactly once with a sanitized event", async () => {
    await track({ name: "Login", userId: "user-1" });
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith(expect.objectContaining({ name: "Login", userId: "user-1" }));
  });

  it("never throws even when the provider rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    captureMock.mockRejectedValueOnce(new Error("insert failed"));
    await expect(track({ name: "Logout", userId: "user-1" })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("never throws when the payload contains a denylisted property (dev/test mode)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      track({ name: "Appointment Updated", properties: { status: "cancelled", notes: "leaked" } as never }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });
});

describe("identify", () => {
  it("calls the provider's identify exactly once", async () => {
    await identify("user-1", { role: "owner", language: "en" });
    expect(identifyMock).toHaveBeenCalledTimes(1);
    expect(identifyMock).toHaveBeenCalledWith("user-1", { role: "owner", language: "en" });
  });

  it("never throws even when the provider rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    identifyMock.mockRejectedValueOnce(new Error("upsert failed"));
    await expect(identify("user-1", {})).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});
