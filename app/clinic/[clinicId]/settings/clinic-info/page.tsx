import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ClinicInfoForm } from "@/components/clinic/clinic-info-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClinicWorkingHours } from "@/lib/clinic/working-hours";
import { DEFAULT_CLINIC_TIMEZONE } from "@/lib/onboarding/clinic-options";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

export default async function ClinicInfoPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);

  // Stricter than most Settings sub-pages (which allow owner+admin): only
  // the clinic owner can edit the clinic's core identity/contact profile.
  if (membership.role !== "owner") {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: clinic }, t] = await Promise.all([
    supabase
      .from("clinics")
      .select("name, logo_url, phone, email, website, address, city, country, timezone, settings")
      .eq("id", clinicId)
      .single(),
    getServerDictionary(),
  ]);

  const workingHours = getClinicWorkingHours(clinic?.settings as Record<string, unknown> | null | undefined);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/clinic/${clinicId}/settings`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t.settings.clinicInfo.back}
        </Link>
        <h1 className="mt-3 text-lg font-semibold">{t.settings.clinicInfo.page.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.settings.clinicInfo.page.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.clinicInfo.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ClinicInfoForm
            clinicId={clinicId}
            name={clinic?.name ?? ""}
            logoUrl={clinic?.logo_url ?? null}
            phone={clinic?.phone ?? null}
            email={clinic?.email ?? null}
            website={clinic?.website ?? null}
            address={clinic?.address ?? null}
            city={clinic?.city ?? null}
            country={clinic?.country ?? null}
            timezone={clinic?.timezone ?? DEFAULT_CLINIC_TIMEZONE}
            workingHours={workingHours}
          />
        </CardContent>
      </Card>
    </div>
  );
}
