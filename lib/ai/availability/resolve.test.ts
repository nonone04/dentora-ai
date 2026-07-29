import { describe, expect, it } from "vitest";
import { resolveDentistId, resolveServiceId } from "@/lib/ai/availability/resolve";

type TableResult = { data: unknown; error: unknown };

function makeFakeSupabase(tableData: Record<string, TableResult>) {
  return {
    from: (table: string) => {
      const result = tableData[table] ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "order", "limit"]) {
        builder[method] = () => builder;
      }
      builder.single = () => Promise.resolve(result);
      builder.maybeSingle = () => Promise.resolve(result);
      builder.then = (onFulfilled: (v: TableResult) => unknown, onRejected?: (r: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected);
      return builder;
    },
  };
}

describe("resolveServiceId", () => {
  it("resolves a matching service, correctly reading the snake_case name_translations column", async () => {
    const supabase = makeFakeSupabase({
      services: {
        data: [
          { id: "svc-1", name_translations: { en: "Cleaning", fr: "Nettoyage" } },
          { id: "svc-2", name_translations: { en: "Root canal" } },
        ],
        error: null,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveServiceId(supabase as any, "clinic-1", "cleaning")).toBe("svc-1");
  });

  it("returns null when nothing matches", async () => {
    const supabase = makeFakeSupabase({ services: { data: [{ id: "svc-1", name_translations: { en: "Cleaning" } }], error: null } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveServiceId(supabase as any, "clinic-1", "whitening")).toBeNull();
  });

  it("returns null without querying when no service text is given", async () => {
    const supabase = makeFakeSupabase({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveServiceId(supabase as any, "clinic-1", null)).toBeNull();
  });

  it("returns null (not throw) when the query itself returns no data", async () => {
    const supabase = makeFakeSupabase({ services: { data: null, error: { message: "boom" } } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveServiceId(supabase as any, "clinic-1", "cleaning")).toBeNull();
  });
});

describe("resolveDentistId", () => {
  it("resolves a matching dentist, stripping NLU's 'Dr.' prefix", async () => {
    const supabase = makeFakeSupabase({
      dentists: { data: [{ id: "dentist-1", full_name: "Amrani Youssef" }], error: null },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveDentistId(supabase as any, "clinic-1", "Dr. Amrani")).toBe("dentist-1");
  });

  it("returns null when nothing matches", async () => {
    const supabase = makeFakeSupabase({ dentists: { data: [{ id: "dentist-1", full_name: "Amrani Youssef" }], error: null } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveDentistId(supabase as any, "clinic-1", "Dr. Nobody")).toBeNull();
  });

  it("returns null without querying when no dentist text is given", async () => {
    const supabase = makeFakeSupabase({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveDentistId(supabase as any, "clinic-1", undefined)).toBeNull();
  });
});
