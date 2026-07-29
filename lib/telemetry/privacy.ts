/**
 * Defense-in-depth backstop. AnalyticsEvent's payload types (see events.ts)
 * should already make it impossible to pass free text, but this catches
 * anything that slips through -- e.g. a future event type or a call site
 * that spreads an unrelated object into `properties`.
 *
 * Never track: patient notes, medical records, conversation contents,
 * passwords, tokens, email verification tokens, API keys, or other
 * sensitive healthcare information (see docs/product-analytics.md).
 */
const DENYLISTED_KEYS = [
  "note",
  "notes",
  "message",
  "content",
  "body",
  "transcript",
  "diagnosis",
  "treatment",
  "medicalRecord",
  "medicalRecords",
  "password",
  "token",
  "secret",
  "apiKey",
  "email",
  "phone",
  "address",
  "ssn",
  "dob",
  "dateOfBirth",
];

const DENYLIST = new Set(DENYLISTED_KEYS.map((key) => key.toLowerCase()));

function isDenylisted(key: string): boolean {
  const normalized = key.toLowerCase();
  return DENYLIST.has(normalized);
}

/**
 * Strips denylisted keys from an event's property bag before it's
 * persisted. In development/test, a denylisted key throws instead of
 * being silently dropped -- a bad call site should fail loudly and get
 * fixed, not ship to production quietly missing data. In production it
 * drops the key and logs a warning: analytics must never break a
 * user-facing request.
 */
export function sanitizeProperties<T extends Record<string, unknown>>(properties: T): Partial<T> {
  const offending = Object.keys(properties).filter(isDenylisted);

  if (offending.length === 0) {
    return properties;
  }

  if (process.env.NODE_ENV !== "production") {
    throw new Error(`lib/telemetry: refusing to track denylisted propert${offending.length === 1 ? "y" : "ies"}: ${offending.join(", ")}`);
  }

  console.warn(`lib/telemetry: stripped denylisted propert${offending.length === 1 ? "y" : "ies"} before tracking: ${offending.join(", ")}`);

  const sanitized = { ...properties };
  for (const key of offending) {
    delete sanitized[key];
  }
  return sanitized;
}
