import { toCsvText } from "@/lib/import/csv";

export type ImportEntity = "patients" | "dentists" | "services";

export type ImportFieldSpec = {
  key: string;
  required: boolean;
  type: "text" | "number";
};

const PATIENT_FIELDS: ImportFieldSpec[] = [
  { key: "fullName", required: true, type: "text" },
  { key: "phone", required: false, type: "text" },
  { key: "email", required: false, type: "text" },
  { key: "dateOfBirth", required: false, type: "text" },
  { key: "gender", required: false, type: "text" },
  { key: "preferredLanguage", required: false, type: "text" },
  { key: "notes", required: false, type: "text" },
];

const DENTIST_FIELDS: ImportFieldSpec[] = [
  { key: "fullName", required: true, type: "text" },
  { key: "specialty", required: false, type: "text" },
  { key: "licenseNumber", required: false, type: "text" },
];

const SERVICE_FIELDS: ImportFieldSpec[] = [
  { key: "name", required: true, type: "text" },
  { key: "defaultDurationMinutes", required: true, type: "number" },
  { key: "price", required: false, type: "number" },
  { key: "currency", required: false, type: "text" },
];

export const IMPORT_FIELDS: Record<ImportEntity, ImportFieldSpec[]> = {
  patients: PATIENT_FIELDS,
  dentists: DENTIST_FIELDS,
  services: SERVICE_FIELDS,
};

const TEMPLATE_EXAMPLE_ROW: Record<ImportEntity, string[]> = {
  patients: ["Sara Amrani", "0600000000", "sara@example.com", "1990-04-12", "female", "fr", "Prefers morning slots"],
  dentists: ["Dr. Youssef Benali", "Orthodontics", "DEN-12345"],
  services: ["Dental Cleaning", "30", "300", "MAD"],
};

/** CSV text with a header row + one filled-in example row, for the wizard's "Download template" action. */
export function buildTemplateCsv(entity: ImportEntity): string {
  const fields = IMPORT_FIELDS[entity];
  return toCsvText([fields.map((f) => f.key), TEMPLATE_EXAMPLE_ROW[entity]]);
}

export type FieldErrorCode =
  | "required"
  | "invalid_number"
  | "invalid_duration"
  | "invalid_price"
  | "invalid_language";

export type RowValidationError = { field: string; code: FieldErrorCode };

function optional(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

export type ValidatedPatientRow = {
  fullName: string;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  preferredLanguage: "ar" | "fr" | "en";
  notes: string | null;
};

export function validatePatientRow(
  raw: Record<string, string>,
): { ok: true; value: ValidatedPatientRow } | { ok: false; errors: RowValidationError[] } {
  const errors: RowValidationError[] = [];

  const fullName = (raw.fullName ?? "").trim();
  if (!fullName) errors.push({ field: "fullName", code: "required" });

  const languageRaw = (raw.preferredLanguage ?? "").trim().toLowerCase();
  let preferredLanguage: "ar" | "fr" | "en" = "fr";
  if (languageRaw) {
    if (languageRaw === "ar" || languageRaw === "fr" || languageRaw === "en") {
      preferredLanguage = languageRaw;
    } else {
      errors.push({ field: "preferredLanguage", code: "invalid_language" });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      fullName,
      phone: optional(raw.phone),
      email: optional(raw.email),
      dateOfBirth: optional(raw.dateOfBirth),
      gender: optional(raw.gender),
      preferredLanguage,
      notes: optional(raw.notes),
    },
  };
}

export type ValidatedDentistRow = {
  fullName: string;
  specialty: string | null;
  licenseNumber: string | null;
};

export function validateDentistRow(
  raw: Record<string, string>,
): { ok: true; value: ValidatedDentistRow } | { ok: false; errors: RowValidationError[] } {
  const fullName = (raw.fullName ?? "").trim();
  if (!fullName) return { ok: false, errors: [{ field: "fullName", code: "required" }] };

  return {
    ok: true,
    value: {
      fullName,
      specialty: optional(raw.specialty),
      licenseNumber: optional(raw.licenseNumber),
    },
  };
}

export type ValidatedServiceRow = {
  name: string;
  defaultDurationMinutes: number;
  price: number | null;
  currency: string;
};

export function validateServiceRow(
  raw: Record<string, string>,
): { ok: true; value: ValidatedServiceRow } | { ok: false; errors: RowValidationError[] } {
  const errors: RowValidationError[] = [];

  const name = (raw.name ?? "").trim();
  if (!name) errors.push({ field: "name", code: "required" });

  const durationRaw = (raw.defaultDurationMinutes ?? "").trim();
  const duration = Number(durationRaw);
  if (!durationRaw) {
    errors.push({ field: "defaultDurationMinutes", code: "required" });
  } else if (!Number.isFinite(duration) || duration <= 0) {
    errors.push({ field: "defaultDurationMinutes", code: "invalid_duration" });
  }

  const priceRaw = (raw.price ?? "").trim();
  let price: number | null = null;
  if (priceRaw) {
    price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      errors.push({ field: "price", code: "invalid_price" });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      defaultDurationMinutes: duration,
      price,
      currency: optional(raw.currency) ?? "MAD",
    },
  };
}
