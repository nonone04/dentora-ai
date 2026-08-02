import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isActiveSubscriptionStatus, resolvePlanFromPriceId } from "@/lib/stripe/subscriptions";

describe("isActiveSubscriptionStatus", () => {
  it("treats trialing and active as active", () => {
    expect(isActiveSubscriptionStatus("trialing")).toBe(true);
    expect(isActiveSubscriptionStatus("active")).toBe(true);
  });

  it("treats past_due, canceled, unpaid, incomplete as inactive", () => {
    expect(isActiveSubscriptionStatus("past_due")).toBe(false);
    expect(isActiveSubscriptionStatus("canceled")).toBe(false);
    expect(isActiveSubscriptionStatus("unpaid")).toBe(false);
    expect(isActiveSubscriptionStatus("incomplete")).toBe(false);
    expect(isActiveSubscriptionStatus("incomplete_expired")).toBe(false);
    expect(isActiveSubscriptionStatus("paused")).toBe(false);
  });
});

describe("resolvePlanFromPriceId", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubEnv("STRIPE_STANDARD_PRICE_ID", "price_standard_mad");
    vi.stubEnv("STRIPE_STANDARD_PRICE_ID_USD", "price_standard_usd");
    vi.stubEnv("STRIPE_PROFESSIONAL_PRICE_ID", "price_professional_mad");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
  });

  it("resolves the legacy no-suffix env var", () => {
    expect(resolvePlanFromPriceId("price_standard_mad")).toBe("standard");
    expect(resolvePlanFromPriceId("price_professional_mad")).toBe("professional");
  });

  it("resolves a currency-suffixed env var", () => {
    expect(resolvePlanFromPriceId("price_standard_usd")).toBe("standard");
  });

  it("returns null for an unknown price id", () => {
    expect(resolvePlanFromPriceId("price_unknown")).toBeNull();
  });

  it("returns null for a nullish price id", () => {
    expect(resolvePlanFromPriceId(undefined)).toBeNull();
    expect(resolvePlanFromPriceId(null)).toBeNull();
  });
});
