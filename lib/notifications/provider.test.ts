import { describe, expect, it } from "vitest";
import { getNotificationProvider } from "@/lib/notifications/provider";

describe("getNotificationProvider: in_app", () => {
  it("returns an in_app provider whose send() always succeeds without calling out anywhere", async () => {
    const provider = getNotificationProvider("in_app");
    expect(provider.channel).toBe("in_app");

    const result = await provider.send({ to: "staff-dashboard", body: "New draft awaiting review" });
    expect(result).toEqual({ success: true });
  });

  it("returns the same cached instance on repeated calls", () => {
    expect(getNotificationProvider("in_app")).toBe(getNotificationProvider("in_app"));
  });
});
