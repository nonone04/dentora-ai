import { describe, expect, it } from "vitest";
import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { listEmailTemplates } from "@/lib/email/registry";
import { EMAIL_TEMPLATE_IDS } from "@/lib/email/types";

const LANGUAGES: ResponseLanguage[] = ["en", "fr", "ar"];

/** Picks a probe string out of a template's sampleProps to confirm interpolation actually happened, rather than the template silently ignoring its props. */
function probeValue(sampleProps: unknown): string | null {
  if (typeof sampleProps !== "object" || sampleProps === null) return null;
  const record = sampleProps as Record<string, unknown>;
  for (const key of ["clinicName", "patientName", "recipientName", "newMemberName", "inviterName"]) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

describe("EMAIL_TEMPLATES registry", () => {
  it("contains exactly the 13 declared template ids", () => {
    const templates = listEmailTemplates();
    expect(templates).toHaveLength(13);
    expect(templates.map((t) => t.id).sort()).toEqual([...EMAIL_TEMPLATE_IDS].sort());
  });

  for (const template of listEmailTemplates()) {
    describe(template.id, () => {
      for (const language of LANGUAGES) {
        it(`renders non-empty subject/html/text for "${language}"`, () => {
          const result = template.render(template.sampleProps, language);
          expect(result.subject.length).toBeGreaterThan(0);
          expect(result.html.length).toBeGreaterThan(0);
          expect(result.text.length).toBeGreaterThan(0);
        });

        it(`produces a full HTML document for "${language}"`, () => {
          const result = template.render(template.sampleProps, language);
          expect(result.html).toContain("<!doctype html>");
          expect(result.html).toContain(`lang="${language}"`);
        });

        it(`ships dark-mode CSS for "${language}"`, () => {
          const result = template.render(template.sampleProps, language);
          expect(result.html).toContain("prefers-color-scheme: dark");
        });

        it(`interpolates sample data into the HTML for "${language}"`, () => {
          const probe = probeValue(template.sampleProps);
          if (!probe) return; // some templates (trial-ending) don't expose a top-level name field
          const result = template.render(template.sampleProps, language);
          expect(result.html).toContain(probe);
        });

        it(`plain-text version contains no HTML tags for "${language}"`, () => {
          const result = template.render(template.sampleProps, language);
          expect(result.text).not.toMatch(/<[a-z][\s\S]*>/i);
        });
      }

      it("forceColorScheme: dark inlines the dark palette directly (deterministic preview)", () => {
        const result = template.render(template.sampleProps, "en", { forceColorScheme: "dark" });
        expect(result.html).toContain("#0a0a0a");
      });
    });
  }
});
