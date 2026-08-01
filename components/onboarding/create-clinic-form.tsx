"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, Banknote, Building2, CalendarDays, ChevronDown, Clock, FileText, Globe, Loader2, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import { createClinic, type CreateClinicFormState } from "@/app/actions/clinics";
import { ClinicFieldIcon, ClinicFieldWrapper, clinicFieldControlClass, clinicFieldTextareaClass } from "@/components/onboarding/clinic-field";
import { LogoUploadField } from "@/components/onboarding/logo-upload-field";
import { Button } from "@/components/ui/button";
import { CLINIC_TYPE_KEYS, DATE_FORMAT_OPTIONS, DEFAULT_CLINIC_DATE_FORMAT, DEFAULT_CLINIC_TIMEZONE, TIMEZONE_OPTIONS } from "@/lib/onboarding/clinic-options";
import { COUNTRY_CODES, COUNTRY_NAMES, COUNTRY_TO_CURRENCY, CURRENCY_CODES, DEFAULT_CURRENCY } from "@/lib/currency";
import { useTranslations } from "@/lib/i18n";

const initialState: CreateClinicFormState = undefined;

export function CreateClinicForm() {
  const [state, action, pending] = useActionState(createClinic, initialState);
  const t = useTranslations();

  const [clinicName, setClinicName] = useState("");
  const [clinicType, setClinicType] = useState("");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  // Currency auto-defaults from Country but stays independently editable --
  // once the clinic owner picks a currency directly, further country
  // changes stop overwriting their choice.
  function handleCountryChange(value: string) {
    setCountry(value);
    if (!currencyTouched) {
      setCurrency(COUNTRY_TO_CURRENCY[value] ?? DEFAULT_CURRENCY);
    }
  }

  function handleLogoSelect(file: File | null) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (!file) {
      setLogoPreviewUrl(null);
      setLogoFileName(null);
      return;
    }

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setLogoPreviewUrl(url);
    setLogoFileName(file.name);
  }

  const typeLabel = clinicType
    ? t.onboarding.clinicTypes[clinicType as keyof typeof t.onboarding.clinicTypes]
    : "";

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#2563EB_0%,#4F46E5_100%)] text-white ring-1 ring-white/15">
          {logoPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL preview, next/image needs a remote loader it doesn't have
            <img src={logoPreviewUrl} alt="" className="size-full object-cover" />
          ) : (
            <Building2 className="size-7" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-white/60">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-300 opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-300" />
            </span>
            {t.onboarding.preview.badge}
          </span>
          <p className="mt-1.5 truncate text-lg font-semibold text-white">{clinicName || t.onboarding.preview.namePlaceholder}</p>
          <p className="truncate text-sm text-white/50">{typeLabel || t.onboarding.preview.typePlaceholder}</p>
        </div>
      </div>

      <LogoUploadField
        label={t.onboarding.form.logoLabel}
        helper={t.onboarding.form.logoHelper}
        dragHint={t.onboarding.form.logoDragHint}
        changeLabel={t.onboarding.form.logoChange}
        removeLabel={t.onboarding.form.logoRemove}
        invalidTypeMessage={t.validation.clinicLogoInvalidType}
        tooLargeMessage={t.validation.clinicLogoTooLarge}
        previewUrl={logoPreviewUrl}
        fileName={logoFileName}
        onFileSelect={handleLogoSelect}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <ClinicFieldWrapper
          label={t.onboarding.clinicNameLabel}
          helper={t.onboarding.form.nameHelper}
          htmlFor="name"
          className="sm:col-span-2"
        >
          <div className="relative">
            <ClinicFieldIcon icon={Building2} />
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="organization"
              required
              placeholder={t.onboarding.form.namePlaceholder}
              value={clinicName}
              onChange={(event) => setClinicName(event.target.value)}
              className={clinicFieldControlClass}
            />
          </div>
        </ClinicFieldWrapper>

        <ClinicFieldWrapper label={t.onboarding.form.typeLabel} helper={t.onboarding.form.typeHelper} htmlFor="clinicType">
          <div className="relative">
            <ClinicFieldIcon icon={Sparkles} />
            <select
              id="clinicType"
              name="clinicType"
              value={clinicType}
              onChange={(event) => setClinicType(event.target.value)}
              className={`${clinicFieldControlClass} appearance-none pe-9`}
            >
              <option value="" className="bg-[#0c111d] text-white/50">
                {t.onboarding.form.typePlaceholder}
              </option>
              {CLINIC_TYPE_KEYS.map((key) => (
                <option key={key} value={key} className="bg-[#0c111d] text-white">
                  {t.onboarding.clinicTypes[key]}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute inset-y-0 end-3.5 my-auto size-4 text-white/40"
              aria-hidden="true"
            />
          </div>
        </ClinicFieldWrapper>

        <ClinicFieldWrapper label={t.onboarding.form.timezoneLabel} helper={t.onboarding.form.timezoneHelper} htmlFor="timezone">
          <div className="relative">
            <ClinicFieldIcon icon={Clock} />
            <select
              id="timezone"
              name="timezone"
              defaultValue={DEFAULT_CLINIC_TIMEZONE}
              className={`${clinicFieldControlClass} appearance-none pe-9`}
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value} className="bg-[#0c111d] text-white">
                  {tz.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute inset-y-0 end-3.5 my-auto size-4 text-white/40"
              aria-hidden="true"
            />
          </div>
        </ClinicFieldWrapper>

        <div className="sm:col-span-2">
          <p className="text-sm font-semibold text-white/90">{t.onboarding.businessSettingsTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/45">{t.onboarding.businessSettingsDescription}</p>
        </div>

        <ClinicFieldWrapper label={t.onboarding.form.countryLabel} helper={t.onboarding.form.countryHelper} htmlFor="country">
          <div className="relative">
            <ClinicFieldIcon icon={Globe} />
            <select
              id="country"
              name="country"
              value={country}
              onChange={(event) => handleCountryChange(event.target.value)}
              className={`${clinicFieldControlClass} appearance-none pe-9`}
            >
              <option value="" className="bg-[#0c111d] text-white/50">
                {t.onboarding.form.countryPlaceholder}
              </option>
              {COUNTRY_CODES.map((code) => (
                <option key={code} value={code} className="bg-[#0c111d] text-white">
                  {COUNTRY_NAMES[code]}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute inset-y-0 end-3.5 my-auto size-4 text-white/40"
              aria-hidden="true"
            />
          </div>
        </ClinicFieldWrapper>

        <ClinicFieldWrapper label={t.onboarding.form.currencyLabel} helper={t.onboarding.form.currencyHelper} htmlFor="currency">
          <div className="relative">
            <ClinicFieldIcon icon={Banknote} />
            <select
              id="currency"
              name="currency"
              value={currency}
              onChange={(event) => {
                setCurrency(event.target.value as typeof currency);
                setCurrencyTouched(true);
              }}
              className={`${clinicFieldControlClass} appearance-none pe-9`}
            >
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code} className="bg-[#0c111d] text-white">
                  {code}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute inset-y-0 end-3.5 my-auto size-4 text-white/40"
              aria-hidden="true"
            />
          </div>
        </ClinicFieldWrapper>

        <ClinicFieldWrapper label={t.onboarding.form.dateFormatLabel} helper={t.onboarding.form.dateFormatHelper} htmlFor="dateFormat">
          <div className="relative">
            <ClinicFieldIcon icon={CalendarDays} />
            <select
              id="dateFormat"
              name="dateFormat"
              defaultValue={DEFAULT_CLINIC_DATE_FORMAT}
              className={`${clinicFieldControlClass} appearance-none pe-9`}
            >
              {DATE_FORMAT_OPTIONS.map((format) => (
                <option key={format.value} value={format.value} className="bg-[#0c111d] text-white">
                  {format.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute inset-y-0 end-3.5 my-auto size-4 text-white/40"
              aria-hidden="true"
            />
          </div>
        </ClinicFieldWrapper>

        <ClinicFieldWrapper
          label={t.onboarding.form.addressLabel}
          helper={t.onboarding.form.addressHelper}
          htmlFor="address"
          className="sm:col-span-2"
        >
          <div className="relative">
            <ClinicFieldIcon icon={MapPin} />
            <input
              id="address"
              name="address"
              type="text"
              autoComplete="street-address"
              placeholder={t.onboarding.form.addressPlaceholder}
              className={clinicFieldControlClass}
            />
          </div>
        </ClinicFieldWrapper>

        <ClinicFieldWrapper label={t.onboarding.form.phoneLabel} helper={t.onboarding.form.phoneHelper} htmlFor="phone">
          <div className="relative">
            <ClinicFieldIcon icon={Phone} />
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder={t.onboarding.form.phonePlaceholder}
              className={clinicFieldControlClass}
            />
          </div>
        </ClinicFieldWrapper>

        <ClinicFieldWrapper label={t.onboarding.form.emailLabel} helper={t.onboarding.form.emailHelper} htmlFor="email">
          <div className="relative">
            <ClinicFieldIcon icon={Mail} />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t.onboarding.form.emailPlaceholder}
              className={clinicFieldControlClass}
            />
          </div>
        </ClinicFieldWrapper>

        <ClinicFieldWrapper
          label={t.onboarding.form.websiteLabel}
          helper={t.onboarding.form.websiteHelper}
          htmlFor="website"
          optional={t.common.optional}
        >
          <div className="relative">
            <ClinicFieldIcon icon={Globe} />
            <input
              id="website"
              name="website"
              type="url"
              autoComplete="url"
              placeholder={t.onboarding.form.websitePlaceholder}
              className={clinicFieldControlClass}
            />
          </div>
        </ClinicFieldWrapper>

        <ClinicFieldWrapper
          label={t.onboarding.form.descriptionLabel}
          helper={t.onboarding.form.descriptionHelper}
          htmlFor="description"
          className="sm:col-span-2"
        >
          <div className="relative">
            <ClinicFieldIcon icon={FileText} top />
            <textarea
              id="description"
              name="description"
              rows={4}
              placeholder={t.onboarding.form.descriptionPlaceholder}
              className={clinicFieldTextareaClass}
            />
          </div>
        </ClinicFieldWrapper>
      </div>

      {state?.error && (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      <div className="flex flex-col items-center gap-2 pt-2">
        <Button
          type="submit"
          disabled={pending}
          className="h-14 w-full gap-2 rounded-xl border-0 bg-[linear-gradient(135deg,#2563EB_0%,#4F46E5_100%)] text-base font-semibold text-white shadow-lg shadow-blue-950/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30 active:translate-y-0"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t.onboarding.creatingClinic}
            </>
          ) : (
            t.onboarding.createClinicButton
          )}
        </Button>
        <p className="text-xs text-white/40">{t.onboarding.submitHint}</p>
      </div>
    </form>
  );
}
