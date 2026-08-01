import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Browser-chrome frame around a real product screenshot (captured from the
 * live app, not a mockup) -- the fake traffic-light dots + address bar make
 * it unambiguous this is a styled frame, not an embedded live browser.
 *
 * `premium` adds the glow/gradient-border treatment used by the homepage
 * feature showcases; the hero and dark security-style contexts keep the
 * plainer default so they can supply their own background/shadow tokens.
 */
export function ProductFrame({
  src,
  alt,
  className,
  priority,
  address = "app.dentora.ai",
  premium = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  address?: string;
  premium?: boolean;
}) {
  const frame = (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40",
        premium && "rounded-[1.75rem] shadow-[0_30px_70px_-25px_rgba(15,23,42,0.35)] dark:shadow-[0_30px_70px_-25px_rgba(0,0,0,0.6)]",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-white/5 dark:bg-white/[0.03]">
        <span className="size-2.5 rounded-full bg-slate-300 dark:bg-white/15" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-slate-300 dark:bg-white/15" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-slate-300 dark:bg-white/15" aria-hidden="true" />
        <span
          dir="ltr"
          className="ms-2 truncate rounded-full bg-slate-200/70 px-3 py-0.5 text-[11px] text-slate-400 dark:bg-white/5 dark:text-white/40"
        >
          {address}
        </span>
      </div>
      {/*
       * Always the full, uncropped screenshot at every breakpoint -- scaled by
       * width/height, never `object-cover` fill-cropped -- so the image keeps
       * its real aspect ratio and nothing is stretched or squeezed on phones.
       * `sizes` matches this frame's actual rendered width (hero: up to
       * ~640px; feature-showcase's 2-col grid: ~560px; mobile stack: full
       * viewport width) -- without it Next.js can't tell the image scales
       * down from its 1568px intrinsic width and ships that size to every
       * device.
       */}
      <Image
        src={src}
        alt={alt}
        width={1568}
        height={762}
        priority={priority}
        sizes="(min-width: 1280px) 640px, (min-width: 1024px) 560px, 100vw"
        className="h-auto w-full"
      />
    </div>
  );

  if (!premium) return frame;

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-blue-200/50 via-teal-100/40 to-transparent blur-2xl dark:from-blue-500/10 dark:via-teal-500/10"
        aria-hidden="true"
      />
      <div className="rounded-[1.85rem] bg-gradient-to-br from-slate-200/80 via-white/40 to-slate-200/80 p-px dark:from-white/15 dark:via-white/5 dark:to-white/10">
        {frame}
      </div>
    </div>
  );
}
