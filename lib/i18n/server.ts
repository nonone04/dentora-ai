/**
 * Server-only i18n entry point. Deliberately separate from
 * lib/i18n/index.ts: that barrel is imported by "use client" components
 * (useTranslations/useLocale), and re-exporting getServerLocale/
 * getServerDictionary from it would pull next/headers into the client
 * bundle (Next.js hard-errors on this at build time). Server Components
 * and server actions should import from here instead.
 */
export * from "@/lib/i18n";
export { getServerLocale } from "@/lib/i18n/get-locale";
export { getServerDictionary } from "@/lib/i18n/server-dictionary";
