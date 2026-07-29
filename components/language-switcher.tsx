"use client";

import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";
import { LOCALES, type Locale } from "@/lib/i18n";

/** English/Français/العربية switcher -- reused in both the clinic header (icon-only) and the Settings page (labelled). Switching updates the locale cookie and refreshes so every Server Component picks up the new dictionary (see lib/i18n/locale-provider.tsx). */
export function LanguageSwitcher({ variant = "icon" }: { variant?: "icon" | "labelled" }) {
  const { locale, dictionary: t, setLocale } = useLocale();

  const label = { en: t.language.english, fr: t.language.french, ar: t.language.arabic }[locale];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          variant === "icon" ? (
            <Button variant="ghost" size="icon-sm" aria-label={t.language.select} />
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5" />
          )
        }
      >
        <Globe className="size-4" aria-hidden="true" />
        {variant === "labelled" && <span>{label}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={locale} onValueChange={(value) => setLocale(value as Locale)}>
          {LOCALES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {{ en: t.language.english, fr: t.language.french, ar: t.language.arabic }[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
