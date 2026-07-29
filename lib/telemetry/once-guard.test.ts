import { describe, expect, it, vi } from "vitest";
import { createOnceGuard } from "@/lib/telemetry/once-guard";

describe("createOnceGuard", () => {
  it("runs the callback on the first fireOnce call", () => {
    const guard = createOnceGuard();
    const callback = vi.fn();
    guard.fireOnce(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores every subsequent fireOnce call", () => {
    const guard = createOnceGuard();
    const callback = vi.fn();
    guard.fireOnce(callback);
    guard.fireOnce(callback);
    guard.fireOnce(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("is independent per guard instance", () => {
    const guardA = createOnceGuard();
    const guardB = createOnceGuard();
    const callback = vi.fn();
    guardA.fireOnce(callback);
    guardB.fireOnce(callback);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
