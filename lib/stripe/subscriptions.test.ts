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
    vi.stubEnv("STRIPE_STANDARD_PRICE_ID_EUR", "price_standard_monthly");
    vi.stubEnv("STRIPE_STANDARD_PRICE_ID_EUR_YEARLY", "price_standard_yearly");
    vi.stubEnv("STRIPE_PROFESSIONAL_PRICE_ID_EUR", "price_professional_monthly");
    vi.stubEnv("STRIPE_PROFESSIONAL_PRICE_ID_EUR_YEARLY", "price_professional_yearly");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
  });

  it("resolves the monthly EUR price id", () => {
    expect(resolvePlanFromPriceId("price_standard_monthly")).toBe("standard");
    expect(resolvePlanFromPriceId("price_professional_monthly")).toBe("professional");
  });

  it("resolves the yearly EUR price id", () => {
    expect(resolvePlanFromPriceId("price_standard_yearly")).toBe("standard");
    expect(resolvePlanFromPriceId("price_professional_yearly")).toBe("professional");
  });

  it("returns null for an unknown price id", () => {
    expect(resolvePlanFromPriceId("price_unknown")).toBeNull();
  });

  it("returns null for a nullish price id", () => {
    expect(resolvePlanFromPriceId(undefined)).toBeNull();
    expect(resolvePlanFromPriceId(null)).toBeNull();
  });
});
