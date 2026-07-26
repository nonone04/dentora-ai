import { ServiceDialog } from "@/components/services/service-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { serviceName } from "@/lib/format";
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
  const { data: servicesData } = await supabase
    .from("services")
    .select("id, name_translations, default_duration_minutes, price, currency, is_active")
    .eq("clinic_id", clinicId)
    .order("created_at");

  const services = (servicesData ?? []) as unknown as ServiceRow[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">Services offered at this clinic.</p>
        </div>
        {canManage && <ServiceDialog clinicId={clinicId} triggerLabel="New service" />}
      </div>

      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">No services yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell>{serviceName(service.name_translations)}</TableCell>
                <TableCell>{service.default_duration_minutes} min</TableCell>
                <TableCell>
                  {service.price != null ? `${service.price} ${service.currency}` : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={service.is_active ? "secondary" : "outline"}>
                    {service.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <ServiceDialog
                      clinicId={clinicId}
                      service={service}
                      triggerLabel="Edit"
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
