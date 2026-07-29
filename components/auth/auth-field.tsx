import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Labelled input with a leading icon, sized for the auth pages' more
 * spacious, premium form rhythm than the default Input's dashboard-density
 * height. The surface/border/placeholder colors are hardcoded (rather than
 * relying on `dark:` utility variants) because the auth card is always a
 * dark glass surface regardless of the app's light/dark theme toggle -- see
 * `.auth-scope` in app/globals.css.
 */
export function AuthField({
  label,
  name,
  icon: Icon,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string; icon: LucideIcon }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-white/90">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-white/40" aria-hidden="true" />
        <Input
          id={name}
          name={name}
          className={cn(
            "h-12 rounded-xl border-white/10 bg-white/5 ps-10 text-[15px] text-white placeholder:text-white/35 focus-visible:border-blue-400/50 focus-visible:bg-white/[0.07] focus-visible:ring-blue-400/25",
            className,
          )}
          {...props}
        />
      </div>
    </div>
  );
}
