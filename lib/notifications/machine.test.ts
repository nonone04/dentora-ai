import { describe, expect, it } from "vitest";
import { isTerminalDeliveryStatus, transitionDelivery } from "@/lib/notifications/machine";

describe("transitionDelivery: valid paths", () => {
  it("pending -> sending -> sent (happy path)", () => {
    expect(transitionDelivery("pending", "start_send")).toEqual({ ok: true, toStatus: "sending" });
    expect(transitionDelivery("sending", "send_succeeded")).toEqual({ ok: true, toStatus: "sent" });
  });

  it("sent -> delivered -> read", () => {
    expect(transitionDelivery("sent", "mark_delivered")).toEqual({ ok: true, toStatus: "delivered" });
    expect(transitionDelivery("delivered", "mark_read")).toEqual({ ok: true, toStatus: "read" });
  });

  it("sent -> read directly (a channel with no delivered receipt)", () => {
    expect(transitionDelivery("sent", "mark_read")).toEqual({ ok: true, toStatus: "read" });
  });

  it("sending -> pending on retry", () => {
    expect(transitionDelivery("sending", "retry")).toEqual({ ok: true, toStatus: "pending" });
  });

  it("sending -> failed on exhaust", () => {
    expect(transitionDelivery("sending", "exhaust")).toEqual({ ok: true, toStatus: "failed" });
  });

  it("pending -> failed on skip (e.g. appointment cancelled)", () => {
    expect(transitionDelivery("pending", "skip")).toEqual({ ok: true, toStatus: "failed" });
  });
});

describe("transitionDelivery: invalid paths", () => {
  it("rejects events not valid from the current status", () => {
    expect(transitionDelivery("pending", "send_succeeded")).toEqual({
      ok: false,
      reason: "invalid_transition",
      message: expect.any(String),
    });
    expect(transitionDelivery("sent", "start_send")).toEqual({
      ok: false,
      reason: "invalid_transition",
      message: expect.any(String),
    });
  });

  it("rejects any event from a terminal status", () => {
    expect(transitionDelivery("read", "mark_read")).toEqual({ ok: false, reason: "invalid_transition", message: expect.any(String) });
    expect(transitionDelivery("failed", "retry")).toEqual({ ok: false, reason: "invalid_transition", message: expect.any(String) });
  });
});

describe("isTerminalDeliveryStatus", () => {
  it("read and failed are terminal", () => {
    expect(isTerminalDeliveryStatus("read")).toBe(true);
    expect(isTerminalDeliveryStatus("failed")).toBe(true);
  });

  it("pending/sending/sent/delivered are not terminal", () => {
    expect(isTerminalDeliveryStatus("pending")).toBe(false);
    expect(isTerminalDeliveryStatus("sending")).toBe(false);
    expect(isTerminalDeliveryStatus("sent")).toBe(false);
    expect(isTerminalDeliveryStatus("delivered")).toBe(false);
  });
});
