import { Resend } from "resend";

/**
 * Single Resend SDK client, lazily constructed from RESEND_API_KEY. Every
 * real email send in the app goes through this one instance --
 * lib/notifications/providers/resend-email-provider.ts is the only
 * caller. Lazy (rather than a module-level `new Resend(...)`) so this
 * file can be imported safely even when RESEND_API_KEY isn't set (local
 * dev, tests) -- the provider factory in lib/notifications/provider.ts
 * only ever instantiates the provider that uses this when the key exists.
 */
let client: Resend | null = null;

export function getResendClient(apiKey: string): Resend {
  if (!client) client = new Resend(apiKey);
  return client;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lightweight sanity check, not full RFC 5322 -- catches missing "@", missing domain, whitespace, etc. before we ever call the Resend API. */
export function isValidEmailAddress(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
