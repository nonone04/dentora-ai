import { CsvImportWizard } from "@/components/import/csv-import-wizard";
import { ServiceDialog } from "@/components/services/service-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEFAULT_CURRENCY, formatCurrency, isCurrencyCode } from "@/lib/currency";
import { serviceName, INTL_LOCALE } from "@/lib/format";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

type ServiceRow = {
  id: string;
  name_translations: Record<string, string>;
  default_duration_minutes: number;
  price: number | string | null;
  currency: string;
  is_active: boolean;
};

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);
  const canManage = membership.role === "owner" || membership.role === "admin";

  const supabase = await createClient();
  const [{ data: servicesData }, { data: clinic }, t, locale] = await Promise.all([
    supabase
      .from("services")
      .select("id, name_translations, default_duration_minutes, price, currency, is_active")
      .eq("clinic_id", clinicId)
      .order("created_at"),
    supabase.from("clinics").select("currency").eq("id", clinicId).single(),
    getServerDictionary(),
    getServerLocale(),
  ]);

  const services = (servicesData ?? []) as unknown as ServiceRow[];
  const clinicCurrency = isCurrencyCode(clinic?.currency) ? clinic.currency : DEFAULT_CURRENCY;
  const localeTag = INTL_LOCALE[locale];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t.services.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.services.description}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <CsvImportWizard clinicId={clinicId} entity="services" />
            <ServiceDialog clinicId={clinicId} defaultCurrency={clinicCurrency} triggerLabel={t.services.dialog.newTrigger} />
          </div>
        )}
      </div>

      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.services.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.services.name}</TableHead>
              <TableHead>{t.services.duration}</TableHead>
              <TableHead>{t.services.price}</TableHead>
              <TableHead>{t.services.status}</TableHead>
              {canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell>{serviceName(service.name_translations, locale)}</TableCell>
                <TableCell>
                  {service.default_duration_minutes} {t.services.minutesSuffix}
                </TableCell>
                <TableCell>
                  {service.price != null
                    ? formatCurrency(Number(service.price), isCurrencyCode(service.currency) ? service.currency : clinicCurrency, localeTag)
                    : t.common.dash}
                </TableCell>
                <TableCell>
                  <Badge variant={service.is_active ? "secondary" : "outline"}>
                    {service.is_active ? t.common.active : t.common.inactive}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <ServiceDialog
                      clinicId={clinicId}
                      service={service}
                      defaultCurrency={clinicCurrency}
                      triggerLabel={t.services.dialog.editTrigger}
                      triggerVariant="ghost"
                      triggerSize="sm"
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
