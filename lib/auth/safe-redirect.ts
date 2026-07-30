/**
 * Validates a user-controlled post-auth redirect target (the `next` query
 * param/form field threaded through login, signup, OAuth, and email
 * confirmation) so it can't be turned into an open redirect -- values like
 * `//evil.com` or `/\evil.com` are parsed as protocol-relative URLs by
 * browsers even though `new URL()` on the server would reject them. Only a
 * same-origin, root-relative path is accepted; anything else falls back to
 * the caller's default.
 */
export function getSafeNextPath(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== "string" || value === "") {
    return null;
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }

  return value;
}
