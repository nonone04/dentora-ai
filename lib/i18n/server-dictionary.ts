import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/get-locale";
import type { Dictionary } from "@/lib/i18n/types";

/**
 * The one call server actions need for locale-aware validation
 * messages: `const t = await getServerDictionary(); return { error: t.validation.fullNameRequired };`
 * Reads the same cookie Server Components read (lib/i18n/get-locale.ts)
 * -- never changes what an action validates or does, only which
 * language its user-facing error strings come back in.
 */
export async function getServerDictionary(): Promise<Dictionary> {
  return getDictionary(await getServerLocale());
}
