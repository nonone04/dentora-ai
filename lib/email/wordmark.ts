import { emailFontStack } from "@/lib/email/brand";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Text-based wordmark -- no logo asset exists anywhere in the repo today
 * (public/ has no logo/icon file), so the brand mark is a styled text
 * span. `clinicName` is an unused-today slot for future per-clinic
 * branding (e.g. "Dentora for {clinicName}" or eventually a clinic logo
 * URL) -- see docs/customer-communications.md "Future work".
 */
export function renderWordmark(clinicName?: string | null): string {
  const suffix = clinicName
    ? ` <span class="eml-muted" style="font-weight:400;">for ${escapeHtml(clinicName)}</span>`
    : "";
  return `<span class="eml-brand-accent" style="font-family:${emailFontStack};font-size:24px;font-weight:700;letter-spacing:-0.02em;">Dentora</span>${suffix}`;
}
