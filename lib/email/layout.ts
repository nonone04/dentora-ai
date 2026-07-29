import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { directionForLocale } from "@/lib/i18n/types";
import { emailColors, emailFontStack, type EmailColorScheme, type EmailPalette } from "@/lib/email/brand";
import { escapeHtml } from "@/lib/email/wordmark";

/**
 * Generates the `<style>` block shared by every template: unconditional
 * rules using `base` (always "light" for real sends -- the safe default
 * for clients that ignore `<style>`/media queries), plus a
 * `@media (prefers-color-scheme: dark)` block of `!important` overrides
 * using the dark palette, so clients that support it auto-adapt.
 *
 * `base` is only ever something other than "light" when the internal
 * preview page passes `forceColorScheme` -- that's how the preview can
 * deterministically show the dark variant without depending on the
 * viewer's actual OS/browser theme. Real sends (lib/notifications/email-html.ts)
 * never set it.
 */
function emailStyleSheet(base: EmailColorScheme): string {
  const light = emailColors.light;
  const dark = emailColors.dark;
  const baseColors = emailColors[base];

  const rules = (c: EmailPalette, important: boolean) => {
    const bang = important ? " !important" : "";
    return `
    .eml-page { background-color: ${c.pageBackground}${bang}; }
    .eml-card { background-color: ${c.cardBackground}${bang}; }
    .eml-heading, .eml-text { color: ${c.text}${bang}; }
    .eml-muted { color: ${c.textMuted}${bang}; }
    .eml-border-top { border-top-color: ${c.border}${bang}; }
    .eml-brand-accent { color: ${c.brandAccent}${bang}; }
    .eml-link { color: ${c.brand}${bang}; }
    .eml-button-bg { background-color: ${c.brand}${bang}; }
    .eml-button-text { color: ${base === "dark" && !important ? light.text : "#ffffff"}${bang}; }`;
  };

  return `<style>
    body { margin: 0; padding: 0; }
    ${rules(baseColors, false)}
    @media (prefers-color-scheme: dark) {
      ${rules(dark, true)}
      .eml-button-text { color: ${dark === baseColors ? "#ffffff" : light.text} !important; }
    }
  </style>`;
}

export type EmailShellParams = {
  subject: string;
  previewText: string;
  bodyHtml: string;
  footerHtml: string;
  language: ResponseLanguage;
  colorScheme?: EmailColorScheme;
};

/** Wraps a template's inner content in the full HTML document: doctype, responsive meta, dark-mode stylesheet, hidden preheader, branded card, footer. */
export function renderEmailShell(params: EmailShellParams): string {
  const dir = directionForLocale(params.language);
  const base = params.colorScheme ?? "light";

  return `<!doctype html>
<html lang="${params.language}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(params.subject)}</title>
${emailStyleSheet(base)}
</head>
<body class="eml-page" style="margin:0;padding:32px 16px;font-family:${emailFontStack};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.previewText)}</span>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;margin:0 auto;">
<tr><td class="eml-card" style="border-radius:12px;padding:32px;">
${params.bodyHtml}
</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;margin:24px auto 0;">
<tr><td style="padding-top:16px;" class="eml-border-top">
${params.footerHtml}
</td></tr>
</table>
</body>
</html>`;
}
