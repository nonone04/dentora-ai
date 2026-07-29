import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";
import { ar } from "@/lib/i18n/dictionaries/ar";

function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    collectKeyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("dictionary key parity", () => {
  const enKeys = collectKeyPaths(en).sort();

  it("fr.ts has exactly the same key paths as en.ts", () => {
    expect(collectKeyPaths(fr).sort()).toEqual(enKeys);
  });

  it("ar.ts has exactly the same key paths as en.ts", () => {
    expect(collectKeyPaths(ar).sort()).toEqual(enKeys);
  });
});
