"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { useHydrated } from "@/lib/use-hydrated";

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/**
 * Light/Dark/System switcher -- persisted by next-themes itself
 * (localStorage, attribute="class" on <html>, matching app/globals.css's
 * existing `.dark` strategy). Reused as-is in both the clinic header
 * (icon-only trigger) and the Settings page (labelled trigger).
 */
export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "labelled" }) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations();
  const hydrated = useHydrated();
  // next-themes resolves the real theme synchronously on the client
  // (via its own inline script, to avoid a flash of the wrong theme),
  // but the server has no way to know it -- rendering "system" until
  // hydrated keeps the first client render pass identical to the
  // server's, then swaps to the real value the instant React commits.
  const current = hydrated ? (theme ?? "system") : "system";
  const Icon = THEME_ICONS[current as keyof typeof THEME_ICONS] ?? Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          variant === "icon" ? (
            <Button variant="ghost" size="icon-sm" aria-label={t.theme.toggle} />
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5" />
          )
        }
      >
        <Icon className="size-4" aria-hidden="true" />
        {variant === "labelled" && <span>{t.theme[current as keyof typeof THEME_ICONS] ?? t.theme.system}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={current} onValueChange={(value) => setTheme(value as string)}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" aria-hidden="true" />
            {t.theme.light}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" aria-hidden="true" />
            {t.theme.dark}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" aria-hidden="true" />
            {t.theme.system}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
