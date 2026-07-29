import { describe, expect, it } from "vitest";
import { parseCountableValue } from "@/components/marketing/motion/count-up";

describe("parseCountableValue", () => {
  it("parses a plain integer", () => {
    expect(parseCountableValue("92")).toEqual({ value: 92, suffix: "" });
  });

  it("parses a percentage", () => {
    expect(parseCountableValue("92%")).toEqual({ value: 92, suffix: "%" });
  });

  it("parses a decimal with an 'x' multiplier suffix", () => {
    expect(parseCountableValue("3.5x")).toEqual({ value: 3.5, suffix: "x" });
  });

  it("parses a '+' suffix", () => {
    expect(parseCountableValue("500+")).toEqual({ value: 500, suffix: "+" });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseCountableValue("  92% ")).toEqual({ value: 92, suffix: "%" });
  });

  it("rejects values with a non-countable trailing unit (e.g. '24/7')", () => {
    expect(parseCountableValue("24/7")).toBeNull();
  });

  it("rejects values with a space before a unit (e.g. '5 min')", () => {
    expect(parseCountableValue("5 min")).toBeNull();
  });

  it("rejects non-numeric text", () => {
    expect(parseCountableValue("Unlimited")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parseCountableValue("")).toBeNull();
  });
});
