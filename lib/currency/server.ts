/**
 * Server-only currency entry point. Deliberately separate from
 * lib/currency/index.ts: that barrel is imported by "use client" components
 * (useCurrency), and re-exporting getServerCurrency from it would pull
 * next/headers into the client bundle. Server Components and server
 * actions should import from here instead -- same split as
 * lib/i18n/server.ts.
 */
export * from "@/lib/currency";
export { getServerCurrency } from "@/lib/currency/get-currency";
