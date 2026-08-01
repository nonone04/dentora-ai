import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RegionalSettingsForm } from "@/components/clinic/regional-settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_CLINIC_DATE_FORMAT, DEFAULT_CLINIC_NUMBER_FORMAT, DEFAULT_CLINIC_TIMEZONE } from "@/lib/onboarding/clinic-options";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

export default async function RegionalSettingsPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);

  if (membership.role !== "owner" && membership.role !== "admin") {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: clinic }, t] = await Promise.all([
    supabase
      .from("clinics")
      .select("country, currency, default_language, timezone, date_format, number_format")
      .eq("id", clinicId)
      .single(),
    getServerDictionary(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/clinic/${clinicId}/settings`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t.settings.regional.back}
        </Link>
        <h1 className="mt-3 text-lg font-semibold">{t.settings.regional.page.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.settings.regional.page.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.regional.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <RegionalSettingsForm
            clinicId={clinicId}
            country={clinic?.country ?? null}
            currency={clinic?.currency ?? "MAD"}
            language={clinic?.default_language ?? DEFAULT_LOCALE}
            timezone={clinic?.timezone ?? DEFAULT_CLINIC_TIMEZONE}
            dateFormat={clinic?.date_format ?? DEFAULT_CLINIC_DATE_FORMAT}
            numberFormat={clinic?.number_format ?? DEFAULT_CLINIC_NUMBER_FORMAT}
          />
        </CardContent>
      </Card>
    </div>
  );
}
