import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icon + label + control + helper-text layout shared by every field on the
 * single-page clinic-creation form. Styling (dark glass surface, white text)
 * is hardcoded rather than `dark:` variants for the same reason as
 * components/auth/auth-field.tsx: this form always sits inside `.auth-scope`
 * (see app/globals.css), so it reads as a fixed premium-dark surface
 * regardless of the app's light/dark theme toggle.
 */
export function ClinicFieldWrapper({
  label,
  helper,
  htmlFor,
  optional,
  className,
  children,
}: {
  label: string;
  helper?: string;
  htmlFor: string;
  optional?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-white/90">
        {label}
        {optional && <span className="ms-1.5 font-normal text-white/35">({optional})</span>}
      </label>
      {children}
      {helper && <p className="text-xs leading-relaxed text-white/45">{helper}</p>}
    </div>
  );
}

export const clinicFieldControlClass =
  "h-12 w-full rounded-xl border border-white/10 bg-white/5 ps-10 text-[15px] text-white placeholder:text-white/35 outline-none transition-colors focus-visible:border-blue-400/50 focus-visible:bg-white/[0.07] focus-visible:ring-3 focus-visible:ring-blue-400/25";

export const clinicFieldTextareaClass =
  "min-h-[112px] w-full resize-none rounded-xl border border-white/10 bg-white/5 py-3 ps-10 pe-3 text-[15px] leading-relaxed text-white placeholder:text-white/35 outline-none transition-colors focus-visible:border-blue-400/50 focus-visible:bg-white/[0.07] focus-visible:ring-3 focus-visible:ring-blue-400/25";

export function ClinicFieldIcon({ icon: Icon, top }: { icon: LucideIcon; top?: boolean }) {
  return (
    <Icon
      className={cn(
        "pointer-events-none absolute start-3.5 size-4 text-white/40",
        top ? "top-3.5" : "inset-y-0 my-auto",
      )}
      aria-hidden="true"
    />
  );
}
