import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { emailFontStack } from "@/lib/email/brand";
import { escapeHtml } from "@/lib/email/wordmark";

/**
 * All color values here come from CSS classes defined once in
 * layout.ts's stylesheet (light rules by default, `!important`
 * dark-mode overrides under `@media (prefers-color-scheme: dark)`), not
 * inline hex -- that's what lets a single render() adapt to the
 * recipient's email client theme. Only non-color styling (font, size,
 * spacing) is inlined directly.
 */

/** Primary call-to-action button. Button text flips color per theme (white on light-mode brand teal, dark text on the lighter dark-mode brand teal) -- see brand.test.ts for why each pairing clears WCAG AA. */
export function renderButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td class="eml-button-bg" style="border-radius:8px;">
    <a href="${escapeHtml(href)}" class="eml-button-text" style="display:inline-block;padding:12px 24px;font-family:${emailFontStack};font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

export function renderDivider(): string {
  return `<hr class="eml-border-top" style="border:none;border-top-width:1px;border-top-style:solid;margin:24px 0;" />`;
}

/** A label/value row -- used for appointment details, invitation metadata, etc. */
export function renderInfoRow(label: string, value: string): string {
  return `<tr>
    <td class="eml-muted" style="padding:4px 0;font-family:${emailFontStack};font-size:14px;width:140px;vertical-align:top;">${escapeHtml(label)}</td>
    <td class="eml-text" style="padding:4px 0;font-family:${emailFontStack};font-size:14px;font-weight:500;">${escapeHtml(value)}</td>
  </tr>`;
}

export function renderInfoTable(rows: string[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">${rows.join("")}</table>`;
}

export function renderParagraph(text: string): string {
  return `<p class="eml-text" style="margin:0 0 16px;font-family:${emailFontStack};font-size:15px;line-height:1.6;">${escapeHtml(text)}</p>`;
}

export function renderHeading(text: string): string {
  return `<h1 class="eml-heading" style="margin:0 0 16px;font-family:${emailFontStack};font-size:22px;line-height:1.3;font-weight:700;">${escapeHtml(text)}</h1>`;
}

export function renderLink(label: string, href: string): string {
  return `<a href="${escapeHtml(href)}" class="eml-link" style="font-family:${emailFontStack};font-size:14px;text-decoration:underline;">${escapeHtml(label)}</a>`;
}

const FOOTER_COPY: Record<ResponseLanguage, { tagline: string; rights: (year: number) => string }> = {
  en: {
    tagline: "Dentora — AI-powered front desk software for dental clinics.",
    rights: (year) => `© ${year} Dentora. All rights reserved.`,
  },
  fr: {
    tagline: "Dentora — le logiciel d'accueil propulsé par l'IA pour les cabinets dentaires.",
    rights: (year) => `© ${year} Dentora. Tous droits réservés.`,
  },
  ar: {
    tagline: "Dentora — برنامج استقبال مدعوم بالذكاء الاصطناعي لعيادات الأسنان.",
    rights: (year) => `© ${year} Dentora. جميع الحقوق محفوظة.`,
  },
};

/** Consistent footer for every template -- tagline + copyright, both localized. `year` is injectable for deterministic tests. */
export function renderFooter(language: ResponseLanguage, year: number = new Date().getFullYear()): string {
  const copy = FOOTER_COPY[language];
  return `<p class="eml-muted" style="margin:16px 0 4px;font-family:${emailFontStack};font-size:12px;line-height:1.5;">${escapeHtml(copy.tagline)}</p>
  <p class="eml-muted" style="margin:0;font-family:${emailFontStack};font-size:12px;line-height:1.5;">${escapeHtml(copy.rights(year))}</p>`;
}
