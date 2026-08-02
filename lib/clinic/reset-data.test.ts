import { beforeEach, describe, expect, it, vi } from "vitest";

let fakeSupabase: { from: (table: string) => unknown };
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeSupabase }));

const { resetClinicData } = await import("@/lib/clinic/reset-data");

function makeTables(clinicRow: { id: string; is_demo: boolean } | null) {
  const deletedTables: string[] = [];
  const from = (table: string) => {
    if (table === "clinics") {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = () => Promise.resolve({ data: clinicRow, error: null });
      return b;
    }
    const b: Record<string, unknown> = {};
    b.delete = () => b;
    b.eq = () => {
      deletedTables.push(table);
      return Promise.resolve({ data: null, error: null });
    };
    return b;
  };
  return { from, deletedTables };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("resetClinicData", () => {
  it("throws instead of wiping data when the clinic doesn't exist", async () => {
    const { from, deletedTables } = makeTables(null);
    fakeSupabase = { from };

    await expect(resetClinicData("missing-clinic")).rejects.toThrow("Clinic not found");
    expect(deletedTables).toHaveLength(0);
  });

  it("refuses to run against the shared demo clinic", async () => {
    const { from, deletedTables } = makeTables({ id: "demo-clinic", is_demo: true });
    fakeSupabase = { from };

    await expect(resetClinicData("demo-clinic")).rejects.toThrow(/demo/i);
    expect(deletedTables).toHaveLength(0);
  });

  it("deletes every transactional table for a real clinic, but never dentists/services/knowledge base", async () => {
    const { from, deletedTables } = makeTables({ id: "clinic-1", is_demo: false });
    fakeSupabase = { from };

    await resetClinicData("clinic-1");

    expect(deletedTables).toEqual(
      expect.arrayContaining([
        "ai_turn_events",
        "ai_decisions",
        "ai_nlu_extractions",
        "ai_availability_queries",
        "appointment_lifecycle_events",
        "notification_events",
        "appointment_drafts",
        "ai_conversations",
        "appointments",
        "patients",
      ]),
    );
    expect(deletedTables).not.toEqual(expect.arrayContaining(["dentists", "services", "clinic_knowledge_records"]));
  });
});
