import { beforeEach, describe, expect, it, vi } from "vitest";

const requireManagerMock = vi.hoisted(() => vi.fn());
const getDashboardSummaryMock = vi.hoisted(() => vi.fn());
const getSystemHealthMock = vi.hoisted(() => vi.fn());
const getConversationTraceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/clinic", () => ({ requireManager: requireManagerMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve({ __fake: true }) }));
vi.mock("@/lib/analytics", () => ({ getDashboardSummary: getDashboardSummaryMock }));
vi.mock("@/lib/observability", () => ({ getSystemHealth: getSystemHealthMock, getConversationTrace: getConversationTraceMock }));

const { getConversationTraceAction, getDashboardSummaryAction, getSystemHealthAction } = await import("@/app/actions/analytics");

beforeEach(() => {
  vi.restoreAllMocks();
  requireManagerMock.mockReset();
  getDashboardSummaryMock.mockReset();
  getSystemHealthMock.mockReset();
  getConversationTraceMock.mockReset();
});

describe("permission enforcement", () => {
  it("getDashboardSummaryAction refuses a non-manager without ever calling the engine", async () => {
    requireManagerMock.mockResolvedValue(null);
    const result = await getDashboardSummaryAction("clinic-1");
    expect(result).toEqual({ error: expect.stringContaining("owners and admins") });
    expect(getDashboardSummaryMock).not.toHaveBeenCalled();
  });

  it("getSystemHealthAction refuses a non-manager", async () => {
    requireManagerMock.mockResolvedValue(null);
    const result = await getSystemHealthAction("clinic-1");
    expect(result).toEqual({ error: expect.stringContaining("owners and admins") });
    expect(getSystemHealthMock).not.toHaveBeenCalled();
  });

  it("getConversationTraceAction refuses a non-manager", async () => {
    requireManagerMock.mockResolvedValue(null);
    const result = await getConversationTraceAction("clinic-1", "conv-1");
    expect(result).toEqual({ error: expect.stringContaining("owners and admins") });
    expect(getConversationTraceMock).not.toHaveBeenCalled();
  });
});

describe("getDashboardSummaryAction: success", () => {
  it("returns the engine's data for an authorized manager", async () => {
    requireManagerMock.mockResolvedValue({ id: "user-1" });
    getDashboardSummaryMock.mockResolvedValue({ clinicId: "clinic-1", appointments: {} });

    const result = await getDashboardSummaryAction("clinic-1");

    expect(result).toEqual({ data: { clinicId: "clinic-1", appointments: {} } });
    expect(getDashboardSummaryMock).toHaveBeenCalledWith({ __fake: true }, { clinicId: "clinic-1", range: undefined });
  });

  it("forwards an explicit range through to the engine", async () => {
    requireManagerMock.mockResolvedValue({ id: "user-1" });
    getDashboardSummaryMock.mockResolvedValue({});
    const range = { from: "2026-07-01T00:00:00.000Z", to: "2026-07-27T00:00:00.000Z" };

    await getDashboardSummaryAction("clinic-1", range);

    expect(getDashboardSummaryMock).toHaveBeenCalledWith({ __fake: true }, { clinicId: "clinic-1", range });
  });
});

describe("getSystemHealthAction: success", () => {
  it("returns the engine's data for an authorized manager", async () => {
    requireManagerMock.mockResolvedValue({ id: "user-1" });
    getSystemHealthMock.mockResolvedValue({ status: "healthy" });

    const result = await getSystemHealthAction("clinic-1", 6);

    expect(result).toEqual({ data: { status: "healthy" } });
    expect(getSystemHealthMock).toHaveBeenCalledWith({ __fake: true }, { clinicId: "clinic-1", windowHours: 6 });
  });
});

describe("getConversationTraceAction: success and not-found", () => {
  it("returns the trace for an authorized manager", async () => {
    requireManagerMock.mockResolvedValue({ id: "user-1" });
    getConversationTraceMock.mockResolvedValue({ conversationId: "conv-1", steps: [] });

    const result = await getConversationTraceAction("clinic-1", "conv-1");

    expect(result).toEqual({ data: { conversationId: "conv-1", steps: [] } });
  });

  it("returns an error when the conversation trace is not found", async () => {
    requireManagerMock.mockResolvedValue({ id: "user-1" });
    getConversationTraceMock.mockResolvedValue(null);

    const result = await getConversationTraceAction("clinic-1", "missing");

    expect(result).toEqual({ error: "Conversation not found." });
  });
});
