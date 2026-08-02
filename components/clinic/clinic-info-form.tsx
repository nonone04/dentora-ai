"use client";

import { useActionState, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { updateClinicInfo, type UpdateClinicInfoFormState } from "@/app/actions/clinics";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ClinicWorkingHours } from "@/lib/clinic/working-hours";
import { COUNTRY_CODES, COUNTRY_NAMES } from "@/lib/currency";
import { useTranslations } from "@/lib/i18n";
import { TIMEZONE_OPTIONS } from "@/lib/onboarding/clinic-options";
import { cn } from "@/lib/utils";

const initialState: UpdateClinicInfoFormState = undefined;

const selectClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

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

export function ClinicInfoForm({
  clinicId,
  name,
  logoUrl,
  phone,
  email,
  website,
  address,
  city,
  country,
  timezone,
  workingHours,
}: {
  clinicId: string;
  name: string;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  workingHours: ClinicWorkingHours;
}) {
  const [state, action, pending] = useActionState(updateClinicInfo.bind(null, clinicId), initialState);
  const t = useTranslations();
  const ci = t.settings.clinicInfo;

  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(logoUrl);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [closedDays, setClosedDays] = useState<Record<string, boolean>>(
    Object.fromEntries(workingHours.map((d) => [d.day, d.closed])),
  );

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !ACCEPTED_LOGO_TYPES.includes(file.type)) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
    setLogoRemoved(false);
  }

  function handleRemoveLogo() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (inputRef.current) inputRef.current.value = "";
    setPreviewUrl(null);
    setLogoRemoved(true);
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <Field label={ci.logoLabel} htmlFor="logo">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- object URL / remote logo preview
              <img src={previewUrl} alt="" className="size-full object-cover" />
            ) : (
              <ImagePlus className="size-5 text-muted-foreground" aria-hidden="true" />
            )}
          </span>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              id="logo"
              name="logo"
              type="file"
              accept={ACCEPTED_LOGO_TYPES.join(",")}
              className="hidden"
              onChange={handleFileChange}
            />
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => inputRef.current?.click()}>
              <Upload className="size-3.5" aria-hidden="true" />
              {ci.logoChange}
            </Button>
            {previewUrl && (
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleRemoveLogo}>
                <X className="size-3.5" aria-hidden="true" />
                {ci.logoRemove}
              </Button>
            )}
          </div>
          <input type="hidden" name="removeLogo" value={logoRemoved ? "on" : ""} />
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={ci.nameLabel} htmlFor="name">
          <Input id="name" name="name" type="text" required defaultValue={name} />
        </Field>
        <Field label={ci.phoneLabel} htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={phone ?? ""} />
        </Field>
        <Field label={ci.emailLabel} htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={email ?? ""} />
        </Field>
        <Field label={ci.websiteLabel} htmlFor="website">
          <Input id="website" name="website" type="url" defaultValue={website ?? ""} />
        </Field>
        <Field label={ci.addressLabel} htmlFor="address">
          <Input id="address" name="address" type="text" defaultValue={address ?? ""} />
        </Field>
        <Field label={ci.cityLabel} htmlFor="city">
          <Input id="city" name="city" type="text" defaultValue={city ?? ""} />
        </Field>
        <Field label={ci.countryLabel} htmlFor="country">
          <select id="country" name="country" defaultValue={country ?? ""} className={selectClass}>
            <option value="" />
            {COUNTRY_CODES.map((code) => (
              <option key={code} value={code}>
                {COUNTRY_NAMES[code]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={ci.timezoneLabel} htmlFor="timezone">
          <select id="timezone" name="timezone" defaultValue={timezone} className={selectClass}>
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <div>
          <h3 className="text-sm font-semibold">{ci.workingHoursTitle}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{ci.workingHoursDescription}</p>
        </div>
        <div className="flex flex-col gap-2">
          {workingHours.map((day) => {
            const isClosed = closedDays[day.day] ?? day.closed;
            return (
              <div key={day.day} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2">
                <span className="w-24 shrink-0 text-sm font-medium">{ci.weekdays[day.day]}</span>
                <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={isClosed}
                    onCheckedChange={(checked) => setClosedDays((current) => ({ ...current, [day.day]: checked === true }))}
                  />
                  {ci.closedLabel}
                </label>
                <input type="hidden" name={`workingHours.${day.day}.closed`} value={isClosed ? "on" : ""} />
                <div className={cn("flex flex-1 flex-wrap items-center gap-2", isClosed && "opacity-40")}>
                  <span className="text-xs text-muted-foreground">{ci.openLabel}</span>
                  <Input
                    type="time"
                    name={`workingHours.${day.day}.open`}
                    defaultValue={day.openTime}
                    disabled={isClosed}
                    className="w-28"
                  />
                  <span className="text-xs text-muted-foreground">{ci.closeLabel}</span>
                  <Input
                    type="time"
                    name={`workingHours.${day.day}.close`}
                    defaultValue={day.closeTime}
                    disabled={isClosed}
                    className="w-28"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-muted-foreground">{t.common.saved}</p>}
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? t.common.saving : t.common.save}
      </Button>
    </form>
  );
}
