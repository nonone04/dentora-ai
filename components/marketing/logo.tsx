import Link from "next/link";
import { Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: { badge: "size-7 rounded-lg", icon: "size-4", text: "text-[15px]" },
  md: { badge: "size-8 rounded-xl", icon: "size-4.5", text: "text-[17px]" },
  lg: { badge: "size-9 rounded-xl", icon: "size-5", text: "text-lg" },
} as const;

type LogoSize = keyof typeof SIZE_CLASSES;

/**
 * Single source of truth for the Dentora AI mark (gradient badge +
 * Stethoscope + wordmark) -- was previously hand-copied with small drifts
 * (different gradient angle, different mobile-vs-desktop treatment) across
 * marketing-header, marketing-footer, and auth-shell. `variant="glass"` is
 * for the mark sitting directly on a dark, already-colored surface (the
 * auth split-screen panel) where a second blue gradient would compete with
 * the background instead of reading as a badge.
 */
export function Logo({
  size = "md",
  variant = "gradient",
  showWordmark = true,
  href = "/",
  className,
}: {
  size?: LogoSize;
  variant?: "gradient" | "glass";
  showWordmark?: boolean;
  href?: string | false;
  className?: string;
}) {
  const { badge, icon, text } = SIZE_CLASSES[size];

  const mark = (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        badge,
        variant === "gradient"
          ? "bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-md shadow-blue-600/25"
          : "bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-sm",
      )}
    >
      <Stethoscope className={icon} aria-hidden="true" />
    </span>
  );

  const wordmark = showWordmark && (
    <span
      className={cn(
        "font-semibold tracking-tight",
        text,
        variant === "gradient" ? "text-slate-900 dark:text-white" : "text-white",
      )}
    >
      Dentora AI
    </span>
  );

  if (href === false) {
    return (
      <span className={cn("inline-flex items-center gap-2.5", className)}>
        {mark}
        {wordmark}
      </span>
    );
  }

  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)}>
      {mark}
      {wordmark}
    </Link>
  );
}
