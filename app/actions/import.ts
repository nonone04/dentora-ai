"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit/log";
import {
  validateDentistRow,
  validatePatientRow,
  validateServiceRow,
  type RowValidationError,
} from "@/lib/import/schemas";
import { requireUser } from "@/lib/supabase/auth";
import { requireManager } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/telemetry";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ImportRowOutcome = {
  index: number;
  status: "imported" | "skipped" | "error";
  reason?: string;
  fieldErrors?: RowValidationError[];
};

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: number;
  rows: ImportRowOutcome[];
};

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = "23505";

function emptyResult(): ImportResult {
  return { imported: 0, skipped: 0, errors: 0, rows: [] };
}

function record(result: ImportResult, outcome: ImportRowOutcome) {
  result.rows.push(outcome);
  if (outcome.status === "imported") result.imported++;
  else if (outcome.status === "skipped") result.skipped++;
  else result.errors++;
}

export async function importPatientsAction(clinicId: string, rows: Record<string, string>[]): Promise<ImportResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const result = emptyResult();

  await track({ name: "CSV Import Started", userId: user.id, clinicId, properties: { subject: "patients" } });

  for (let index = 0; index < rows.length; index++) {
    const validated = validatePatientRow(rows[index]);
    if (!validated.ok) {
      record(result, { index, status: "error", reason: "invalid_row", fieldErrors: validated.errors });
      continue;
    }

    const { value } = validated;
    const { error } = await supabase.from("patients").insert({
      clinic_id: clinicId,
      full_name: value.fullName,
      phone: value.phone,
      email: value.email,
      date_of_birth: value.dateOfBirth,
      gender: value.gender,
      preferred_language: value.preferredLanguage,
      notes: value.notes,
      created_via: "staff",
    });

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        record(result, { index, status: "skipped", reason: "duplicate_phone" });
      } else {
        record(result, { index, status: "error", reason: error.message });
      }
      continue;
    }

    record(result, { index, status: "imported" });
  }

  await finishImport(supabase, clinicId, user.id, "patients_imported", "patients", result, "/patients");
  return result;
}


export async function importDentistsAction(clinicId: string, rows: Record<string, string>[]): Promise<ImportResult> {
  const user = await requireManager(clinicId);
  const result = emptyResult();
  if (!user) {
    record(result, { index: 0, status: "error", reason: "not_authorized" });
    return result;
  }

  const supabase = await createClient();

  await track({ name: "CSV Import Started", userId: user.id, clinicId, properties: { subject: "dentists" } });

  for (let index = 0; index < rows.length; index++) {
    const validated = validateDentistRow(rows[index]);
    if (!validated.ok) {
      record(result, { index, status: "error", reason: "invalid_row", fieldErrors: validated.errors });
      continue;
    }

    const { value } = validated;
    const { error } = await supabase.from("dentists").insert({
      clinic_id: clinicId,
      full_name: value.fullName,
      specialty: value.specialty,
      license_number: value.licenseNumber,
    });

    if (error) {
      record(result, { index, status: "error", reason: error.message });
      continue;
    }

    record(result, { index, status: "imported" });
  }

  await finishImport(supabase, clinicId, user.id, "dentists_imported", "dentists", result, "/dentists");
  return result;
}

export async function importServicesAction(clinicId: string, rows: Record<string, string>[]): Promise<ImportResult> {
  const user = await requireManager(clinicId);
  const result = emptyResult();
  if (!user) {
    record(result, { index: 0, status: "error", reason: "not_authorized" });
    return result;
  }

  const supabase = await createClient();

  await track({ name: "CSV Import Started", userId: user.id, clinicId, properties: { subject: "services" } });

  for (let index = 0; index < rows.length; index++) {
    const validated = validateServiceRow(rows[index]);
    if (!validated.ok) {
      record(result, { index, status: "error", reason: "invalid_row", fieldErrors: validated.errors });
      continue;
    }

    const { value } = validated;
    const { error } = await supabase.from("services").insert({
      clinic_id: clinicId,
      name_translations: { fr: value.name },
      default_duration_minutes: value.defaultDurationMinutes,
      price: value.price,
      currency: value.currency,
    });

    if (error) {
      record(result, { index, status: "error", reason: error.message });
      continue;
    }

    record(result, { index, status: "imported" });
  }

  await finishImport(supabase, clinicId, user.id, "services_imported", "services", result, "/services");
  return result;
}

async function finishImport(
  supabase: SupabaseClient,
  clinicId: string,
  actorId: string,
  action: "patients_imported" | "dentists_imported" | "services_imported",
  entityType: "patients" | "dentists" | "services",
  result: ImportResult,
  path: string,
) {
  await track({
    name: "CSV Import Completed",
    userId: actorId,
    clinicId,
    properties: { subject: entityType, imported: result.imported, skipped: result.skipped },
  });

  if (result.imported > 0) {
    await logAuditEvent(supabase, {
      clinicId,
      actorId,
      action,
      entityType,
      metadata: { imported: result.imported, skipped: result.skipped, errors: result.errors },
    });
    revalidatePath(`/clinic/${clinicId}${path}`);
  }
}
