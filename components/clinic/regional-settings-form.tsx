"use client";

import { useActionState } from "react";
import { updateRegionalSettings, type UpdateRegionalSettingsFormState } from "@/app/actions/clinics";
import { Button } from "@/components/ui/button";
import { COUNTRY_CODES, COUNTRY_NAMES, CURRENCY_CODES } from "@/lib/currency";
import { LOCALES, useTranslations } from "@/lib/i18n";
import { DATE_FORMAT_OPTIONS, NUMBER_FORMAT_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/onboarding/clinic-options";

const initialState: UpdateRegionalSettingsFormState = undefined;

const selectClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

export function RegionalSettingsForm({
  clinicId,
  country,
  currency,
  language,
  timezone,
  dateFormat,
  numberFormat,
}: {
  clinicId: string;
  country: string | null;
  currency: string;
  language: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
}) {
  const [state, action, pending] = useActionState(updateRegionalSettings.bind(null, clinicId), initialState);
  const t = useTranslations();
  const p = t.settings.regional.page;
  const languageLabels = { en: t.language.english, fr: t.language.french, ar: t.language.arabic };

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={p.countryLabel} htmlFor="country">
          <select id="country" name="country" defaultValue={country ?? ""} className={selectClass}>
            <option value="" />
            {COUNTRY_CODES.map((code) => (
              <option key={code} value={code}>
                {COUNTRY_NAMES[code]}
              </option>
            ))}
          </select>
        </Field>

        <Field label={p.currencyLabel} htmlFor="currency">
          <select id="currency" name="currency" defaultValue={currency} className={selectClass}>
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </Field>

        <Field label={p.languageLabel} htmlFor="language">
          <select id="language" name="language" defaultValue={language} className={selectClass}>
            {LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {languageLabels[locale]}
              </option>
            ))}
          </select>
        </Field>

        <Field label={p.timezoneLabel} htmlFor="timezone">
          <select id="timezone" name="timezone" defaultValue={timezone} className={selectClass}>
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label={p.dateFormatLabel} htmlFor="dateFormat">
          <select id="dateFormat" name="dateFormat" defaultValue={dateFormat} className={selectClass}>
            {DATE_FORMAT_OPTIONS.map((format) => (
              <option key={format.value} value={format.value}>
                {format.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label={p.numberFormatLabel} htmlFor="numberFormat">
          <select id="numberFormat" name="numberFormat" defaultValue={numberFormat} className={selectClass}>
            {NUMBER_FORMAT_OPTIONS.map((format) => (
              <option key={format.value} value={format.value}>
                {format.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-muted-foreground">{t.common.saved}</p>}
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? t.common.saving : t.common.save}
      </Button>
    </form>
  );
}
