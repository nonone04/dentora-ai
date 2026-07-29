import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateLLMSummaryMock, buildRuleBasedSummaryMock } = vi.hoisted(() => ({
  generateLLMSummaryMock: vi.fn(),
  buildRuleBasedSummaryMock: vi.fn(),
}));

vi.mock("@/lib/ai/patient/llm-summary", () => ({
  generateLLMSummary: generateLLMSummaryMock,
}));

vi.mock("@/lib/ai/patient/rule-summary", () => ({
  buildRuleBasedSummary: buildRuleBasedSummaryMock,
}));

const { generatePatientSummary } = await import("@/lib/ai/patient/summary");

const INPUTS = {
  patientName: "Sara Idrissi",
  reliability: { score: 0.8, label: "good" as const, completedCount: 4, noShowCount: 1, cancelledCount: 0, sampleSize: 5 },
  communication: { preferredChannel: null, sampleSize: 0 },
  scheduling: { preferredTimeOfDay: null, preferredDentistId: null, sampleSize: 0 },
  recentActivity: [],
};

const originalApiKey = process.env.ANTHROPIC_API_KEY;
const originalModel = process.env.ANTHROPIC_MODEL;

beforeEach(() => {
  generateLLMSummaryMock.mockReset();
  buildRuleBasedSummaryMock.mockReset();
  buildRuleBasedSummaryMock.mockReturnValue("rule-based summary");
});

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalApiKey;
  if (originalModel === undefined) delete process.env.ANTHROPIC_MODEL;
  else process.env.ANTHROPIC_MODEL = originalModel;
});

describe("generatePatientSummary", () => {
  it("uses the rule-based summary when no API key is configured, without even calling the LLM path", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await generatePatientSummary(INPUTS);

    expect(result).toEqual({ summary: "rule-based summary", source: "rule_based" });
    expect(generateLLMSummaryMock).not.toHaveBeenCalled();
  });

  it("prefers the LLM summary when an API key is configured and the call succeeds", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    generateLLMSummaryMock.mockResolvedValue("a natural-language summary");

    const result = await generatePatientSummary(INPUTS);

    expect(result).toEqual({ summary: "a natural-language summary", source: "llm" });
    expect(buildRuleBasedSummaryMock).not.toHaveBeenCalled();
  });

  it("falls back to the rule-based summary when the LLM call returns null", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    generateLLMSummaryMock.mockResolvedValue(null);

    const result = await generatePatientSummary(INPUTS);

    expect(result).toEqual({ summary: "rule-based summary", source: "rule_based" });
  });

  it("passes the configured model through to the LLM summary generator", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test-model";
    generateLLMSummaryMock.mockResolvedValue("summary");

    await generatePatientSummary(INPUTS);

    expect(generateLLMSummaryMock).toHaveBeenCalledWith("test-key", "claude-test-model", INPUTS);
  });
});
