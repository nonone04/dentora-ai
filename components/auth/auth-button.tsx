import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The auth pages' primary CTA -- full-width, Dentora's blue-to-indigo
 * gradient, with a hover glow + lift. Kept as its own component (rather
 * than a `variant` on the shared Button) since the gradient/glow treatment
 * is specific to these five pages and shouldn't leak into the shared
 * `buttonVariants` used across the rest of the app.
 */
export function AuthButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "h-12 w-full gap-2 rounded-xl border-0 bg-[linear-gradient(135deg,#2563EB_0%,#4F46E5_100%)] text-[15px] font-semibold text-white shadow-lg shadow-blue-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30 active:translate-y-0",
        className,
      )}
      {...props}
    />
  );
}
