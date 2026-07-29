import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "dta_live_";
const SECRET_BYTES = 24;
/** How many characters of the plaintext (prefix included) are safe to persist/display for at-a-glance identification. */
const VISIBLE_PREFIX_LENGTH = KEY_PREFIX.length + 6;

export type GeneratedApiKey = {
  /** Full plaintext secret -- returned to the caller exactly once at creation time, never persisted anywhere. */
  secret: string;
  /** Short, non-secret prefix stored alongside the hash so staff can identify a key in the UI without ever seeing the secret again. */
  prefix: string;
  /** SHA-256 hash of the full secret -- what actually gets persisted (clinic_api_keys.key_hash). */
  hash: string;
};

/** Cryptographically random API key secret + its storable (prefix, hash) pair. Pure aside from the CSPRNG call -- no I/O, no knowledge of Supabase. */
export function generateApiKey(): GeneratedApiKey {
  const token = randomBytes(SECRET_BYTES).toString("base64url");
  const secret = `${KEY_PREFIX}${token}`;
  return { secret, prefix: secret.slice(0, VISIBLE_PREFIX_LENGTH), hash: hashApiKeySecret(secret) };
}

export function hashApiKeySecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
