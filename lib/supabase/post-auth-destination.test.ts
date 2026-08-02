import { beforeEach, describe, expect, it, vi } from "vitest";

const hasActiveSubscriptionMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/subscription", () => ({ hasActiveSubscription: hasActiveSubscriptionMock }));
vi.mock("@/lib/supabase/auth", () => ({ getUser: getUserMock }));

let currentSupabase: ReturnType<typeof makeSupabase>;
vi.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(currentSupabase) }));

function makeSupabase({ membership, pending }: { membership: { clinic_id: string } | null; pending: unknown[] }) {
  return {
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        limit: () => builder,
        maybeSingle: () => Promise.resolve({ data: membership, error: null }),
      };
      return builder;
    },
    rpc: () => Promise.resolve({ data: pending, error: null }),
  };
}

const { resolvePostAuthDestination, getMarketingNavState } = await import("@/lib/supabase/post-auth-destination");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolvePostAuthDestination", () => {
  it("routes to the clinic when the user has an active membership", async () => {
    const supabase = makeSupabase({ membership: { clinic_id: "clinic-1" }, pending: [] });
    hasActiveSubscriptionMock.mockResolvedValue(false);
    const result = await resolvePostAuthDestination(supabase as never, "user-1");
    expect(result).toEqual({ kind: "clinic", href: "/clinic/clinic-1" });
  });

  it("routes to onboarding when there's a pending invitation and no clinic", async () => {
    const supabase = makeSupabase({ membership: null, pending: [{ membership_id: "m1" }] });
    hasActiveSubscriptionMock.mockResolvedValue(false);
    const result = await resolvePostAuthDestination(supabase as never, "user-1");
    expect(result).toEqual({ kind: "onboarding", href: "/" });
  });

  it("routes to onboarding when the user has an active subscription but no clinic yet", async () => {
    const supabase = makeSupabase({ membership: null, pending: [] });
    hasActiveSubscriptionMock.mockResolvedValue(true);
    const result = await resolvePostAuthDestination(supabase as never, "user-1");
    expect(result).toEqual({ kind: "onboarding", href: "/" });
  });

  it("routes to pricing when there's no membership, no pending invite, and no active subscription", async () => {
    const supabase = makeSupabase({ membership: null, pending: [] });
    hasActiveSubscriptionMock.mockResolvedValue(false);
    const result = await resolvePostAuthDestination(supabase as never, "user-1");
    expect(result).toEqual({ kind: "pricing", href: "/pricing" });
  });
});

describe("getMarketingNavState", () => {
  it("returns unauthenticated for a visitor", async () => {
    getUserMock.mockResolvedValue(null);
    const result = await getMarketingNavState();
    expect(result).toEqual({ authenticated: false });
  });

  it("returns a null dashboardHref for a logged-in user with no clinic access", async () => {
    getUserMock.mockResolvedValue({ id: "user-1" });
    currentSupabase = makeSupabase({ membership: null, pending: [] });
    hasActiveSubscriptionMock.mockResolvedValue(false);
    const result = await getMarketingNavState();
    expect(result).toEqual({ authenticated: true, dashboardHref: null });
  });

  it("returns the clinic href for a logged-in user with dashboard access", async () => {
    getUserMock.mockResolvedValue({ id: "user-1" });
    currentSupabase = makeSupabase({ membership: { clinic_id: "clinic-1" }, pending: [] });
    hasActiveSubscriptionMock.mockResolvedValue(false);
    const result = await getMarketingNavState();
    expect(result).toEqual({ authenticated: true, dashboardHref: "/clinic/clinic-1" });
  });
});
