import { ParallaxLayer } from "@/components/marketing/motion/mouse-parallax";
import { cn } from "@/lib/utils";

/**
 * Zero-asset noise texture -- an inline SVG fractal-noise filter encoded
 * as a data URI, so there's no extra network request or next/image
 * optimization pass. Static (feTurbulence isn't cheaply animatable
 * without repainting), shown at very low opacity via the wrapping div's
 * class, never inline style opacity, so dark-mode can use a different
 * value.
 */
const NOISE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" /></filter><rect width="100%" height="100%" filter="url(#n)" /></svg>';
const NOISE_BACKGROUND_IMAGE = `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`;

type Intensity = "hero" | "subtle" | "gradient" | "auth" | "clinic";

/**
 * `position` (placement + size) and `paint` (color/opacity) are kept
 * separate so that, under `intensity="hero"`, `position` can live on the
 * outer `ParallaxLayer` element (which owns the pointer-driven transform)
 * while `paint` + the `drift` CSS animation live on an inner element --
 * a CSS `animation` and a framer-motion inline `transform` style fight
 * over the same property if applied to the *same* element, so the two
 * transform sources are always kept on separate nested elements.
 */
type Orb = { position: string; paint: string; drift: "drift-a" | "drift-b" | "drift-c"; strength: number };

const HERO_ORBS: Orb[] = [
  { position: "-top-24 start-[8%] size-72", paint: "bg-blue-300/45 dark:bg-blue-500/20", drift: "drift-a", strength: 18 },
  { position: "top-[15%] end-[4%] size-64", paint: "bg-teal-300/45 dark:bg-teal-500/20", drift: "drift-b", strength: 24 },
  { position: "bottom-[-10%] start-[30%] size-56", paint: "bg-blue-200/35 dark:bg-blue-400/15", drift: "drift-c", strength: 14 },
];

const SUBTLE_ORBS: Orb[] = [
  { position: "-top-16 end-[10%] size-56", paint: "bg-blue-200/30 dark:bg-blue-500/10", drift: "drift-a", strength: 0 },
  { position: "bottom-[-8%] start-[15%] size-48", paint: "bg-teal-200/30 dark:bg-teal-500/10", drift: "drift-b", strength: 0 },
];

const GRADIENT_ORBS: Orb[] = [
  { position: "-top-20 start-1/4 size-80", paint: "bg-white/25", drift: "drift-a", strength: 0 },
  { position: "bottom-[-15%] end-[10%] size-64", paint: "bg-white/15", drift: "drift-c", strength: 0 },
];

const AUTH_ORBS: Orb[] = [
  { position: "-top-24 start-[10%] size-80", paint: "bg-blue-500/25", drift: "drift-a", strength: 0 },
  { position: "top-[35%] end-[-6%] size-72", paint: "bg-indigo-400/20", drift: "drift-b", strength: 0 },
  { position: "bottom-[-12%] start-[20%] size-64", paint: "bg-sky-400/15", drift: "drift-c", strength: 0 },
];

const CLINIC_ORBS: Orb[] = [
  { position: "-top-32 start-[6%] size-96", paint: "bg-blue-300/40 dark:bg-blue-500/20", drift: "drift-a", strength: 0 },
  { position: "top-[10%] end-[-8%] size-80", paint: "bg-violet-300/35 dark:bg-violet-500/18", drift: "drift-b", strength: 0 },
  { position: "bottom-[-15%] start-[35%] size-72", paint: "bg-teal-300/30 dark:bg-teal-400/12", drift: "drift-c", strength: 0 },
];

const ORBS_BY_INTENSITY: Record<Intensity, Orb[]> = {
  hero: HERO_ORBS,
  subtle: SUBTLE_ORBS,
  gradient: GRADIENT_ORBS,
  auth: AUTH_ORBS,
  clinic: CLINIC_ORBS,
};

/**
 * `blur-2xl` (not `-3xl`): a smaller blur radius reads as a *crisper, more
 * visible* glow on a white background and is cheaper for the compositor to
 * sample -- unlike most perf/visibility tradeoffs, here both goals point
 * the same way.
 */
const ORB_BLUR_CLASS = "blur-2xl";

const WASH_BY_INTENSITY: Record<Intensity, string> = {
  hero: "bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(37,99,235,0.18),transparent_70%)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(37,99,235,0.14),transparent_70%)]",
  subtle:
    "bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,rgba(37,99,235,0.08),transparent_70%)] dark:bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,rgba(37,99,235,0.07),transparent_70%)]",
  gradient: "bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,255,255,0.12),transparent_70%)]",
  auth: "bg-[radial-gradient(ellipse_70%_55%_at_30%_0%,rgba(59,130,246,0.25),transparent_70%)]",
  clinic:
    "bg-[radial-gradient(ellipse_75%_60%_at_20%_-10%,rgba(99,102,241,0.20),transparent_65%),radial-gradient(ellipse_65%_55%_at_100%_0%,rgba(45,212,191,0.13),transparent_60%)] dark:bg-[radial-gradient(ellipse_75%_60%_at_20%_-10%,rgba(99,102,241,0.16),transparent_65%),radial-gradient(ellipse_65%_55%_at_100%_0%,rgba(45,212,191,0.10),transparent_60%)]",
};

/**
 * Layered decorative background: a radial-gradient wash, a static noise
 * texture, an animated "light wave" (hero only, an oversized gradient
 * translated back and forth), and a handful of drifting blurred orbs --
 * composed once here so every section gets a consistent depth treatment
 * instead of one-off blobs per file. Every layer is `pointer-events-none`
 * + `aria-hidden` and animates only `transform`/`opacity` -- never
 * `background-position`, which is paint-bound -- so every layer stays on
 * the compositor thread (see app/globals.css's `wave-drift`/`drift-a/b/c`
 * keyframes, which are disabled under prefers-reduced-motion in the same
 * block as the
 * existing `float-slow` keyframes).
 *
 * `intensity="hero"` additionally wraps each orb in a `ParallaxLayer` --
 * the caller must render this inside a `ParallaxProvider` when passing
 * "hero" (only hero-section.tsx does).
 */
export function SectionBackground({ intensity }: { intensity: Intensity }) {
  const orbs = ORBS_BY_INTENSITY[intensity];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className={cn("absolute inset-0", WASH_BY_INTENSITY[intensity])} />

      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay dark:opacity-[0.05]"
        style={{ backgroundImage: NOISE_BACKGROUND_IMAGE, backgroundSize: "220px 220px" }}
      />

      {intensity === "hero" && (
        <div
          className="wave-drift absolute inset-[-20%] bg-[linear-gradient(120deg,rgba(37,99,235,0.16),rgba(20,184,166,0.16),rgba(37,99,235,0.16))] dark:bg-[linear-gradient(120deg,rgba(37,99,235,0.10),rgba(20,184,166,0.10),rgba(37,99,235,0.10))]"
        />
      )}

      {orbs.map((orb, index) =>
        intensity === "hero" ? (
          <ParallaxLayer key={index} strength={orb.strength} className={cn("absolute", orb.position)}>
            <div className={cn("size-full rounded-full", ORB_BLUR_CLASS, orb.drift, orb.paint)} />
          </ParallaxLayer>
        ) : (
          <div key={index} className={cn("absolute rounded-full", ORB_BLUR_CLASS, orb.drift, orb.position, orb.paint)} />
        ),
      )}
    </div>
  );
}
