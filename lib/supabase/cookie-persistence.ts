// @supabase/ssr's cookie adapter unconditionally overwrites `maxAge` with
// its own 400-day default whenever it sets a session cookie (see
// node_modules/@supabase/ssr/dist/main/cookies.js -- applyServerStorage
// spreads DEFAULT_COOKIE_OPTIONS *after* any caller-supplied cookieOptions,
// so passing cookieOptions.maxAge to createServerClient/createBrowserClient
// has no effect). Implementing "Remember me" therefore means stripping
// maxAge/expires ourselves, after @supabase/ssr has already set them, on
// every cookie it writes -- in both lib/supabase/server.ts's `setAll` and
// proxy.ts's `setAll` (the two places @supabase/ssr writes cookies here).
export const REMEMBER_ME_COOKIE = "dentora_remember_me";

export function applyRememberMe<T extends { maxAge?: number; expires?: Date }>(
  options: T,
  rememberMe: boolean,
): T {
  if (rememberMe) return options;
  return { ...options, maxAge: undefined, expires: undefined };
}
