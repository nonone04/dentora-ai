"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Password AuthField with a show/hide toggle -- the one field on the auth
 * pages that needs client state, so it's split out from the plain
 * AuthField. Colors are hardcoded for the same reason as AuthField: the
 * auth card is always a dark glass surface, independent of the app's
 * light/dark theme toggle.
 */
export function PasswordField({
  label,
  name,
  className,
  onChange,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  const t = useTranslations();
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-white/90">
        {label}
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-white/40" aria-hidden="true" />
        <Input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          onChange={onChange}
          className={cn(
            "h-12 rounded-xl border-white/10 bg-white/5 ps-10 pe-10 text-[15px] text-white placeholder:text-white/35 focus-visible:border-blue-400/50 focus-visible:bg-white/[0.07] focus-visible:ring-blue-400/25",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? t.common.hidePassword : t.common.showPassword}
          className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-white/40 transition-colors hover:text-white/80"
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
