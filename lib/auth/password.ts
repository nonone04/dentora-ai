// Top of the most commonly breached/guessed passwords -- a deliberately
// short, hardcoded list rather than a dependency like zxcvbn (which ships
// a multi-hundred-KB wordlist), consistent with this repo's minimal
// dependency footprint. It exists to catch the obvious cases only.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "123456", "12345678", "123456789", "qwerty",
  "111111", "abc123", "letmein", "iloveyou", "admin", "welcome",
  "monkey", "dragon", "football", "baseball", "sunshine", "princess",
  "qwertyuiop", "trustno1", "passw0rd", "starwars", "master", "login",
]);

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; code: "too_short" | "too_weak" | "common_password" | "matches_email" };

export function validatePassword(password: string, email?: string | null): PasswordValidationResult {
  if (password.length < 8) {
    return { ok: false, code: "too_short" };
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, code: "common_password" };
  }

  const emailLocalPart = email?.split("@")[0]?.toLowerCase();
  if (emailLocalPart && password.toLowerCase() === emailLocalPart) {
    return { ok: false, code: "matches_email" };
  }

  if (scorePasswordStrength(password) < 1) {
    return { ok: false, code: "too_weak" };
  }

  return { ok: true };
}

/** 0 (very weak) to 4 (very strong), for a strength meter. */
export function scorePasswordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;

  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (classes >= 3) score += 1;

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 0;
  }

  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}
