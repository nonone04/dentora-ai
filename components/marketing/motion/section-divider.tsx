/** Thin gradient-fade divider dropped between sections in home-content.tsx for a soft visual transition -- purely decorative, static. */
export function SectionDivider() {
  return (
    <div
      className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10"
      aria-hidden="true"
    />
  );
}
