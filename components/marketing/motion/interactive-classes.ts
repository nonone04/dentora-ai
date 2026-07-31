/**
 * Shared hover/lift/glow treatments for marketing CTAs and cards -- kept
 * as plain class-string constants (composed via `cn()` at each call site)
 * rather than a new shared `<Button>`/`<Card>` component, since this
 * sprint is visual polish only and every call site already has its own
 * color/shape classes that shouldn't be restructured. Every effect here
 * only transitions `transform` (translate-y) and `box-shadow` -- no
 * layout-affecting properties, so no layout thrashing.
 */

/** For primary/secondary CTA links & buttons: a small lift + deeper shadow on hover, settling back on press. */
export const ctaHoverClass = "transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0";

/** Adds an ambient glow that intensifies on hover -- for the primary (filled, colored) CTA specifically. */
export const ctaGlowClass = "shadow-lg shadow-blue-600/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/30 active:translate-y-0";

/** For card containers (feature cards, testimonial cards, pricing cards): elevation + border glow on hover. */
export const cardHoverClass =
  "transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg dark:hover:border-white/20";

/**
 * Premium translucent surface -- the same recipe as
 * components/dashboard/glass-card.tsx (tinted `bg-foreground` wash, soft
 * ring, layered shadow), reused here so marketing panels/pills/cards share
 * one glass "material" instead of every component deriving its own
 * bg/blur/shadow combination. Deliberately tuned per-theme rather than a
 * naive inversion: the light-mode shadow is a soft, low-contrast elevation,
 * the dark-mode shadow reads as light escaping from behind the panel.
 */
export const glassPanelClass =
  "bg-foreground/[0.03] ring-1 ring-foreground/8 backdrop-blur-xl shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_12px_32px_-16px_rgba(0,0,0,0.12)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_20px_50px_-24px_rgba(0,0,0,0.65)]";
