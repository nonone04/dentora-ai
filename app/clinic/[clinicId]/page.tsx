import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, serviceName, STATUS_VARIANT } from "@/lib/format";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

type TodayAppointmentRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  patients: { full_name: string } | null;
  dentists: { full_name: string } | null;
  services: { name_translations: Record<string, string>; price: number | string | null; currency: string } | null;
};

type RevenueAppointmentRow = {
  id: string;
  services: { price: number | string | null; currency: string } | null;
};

function sumRevenue(rows: { services: { price: number | string | null; currency: string } | null }[]) {
  let total = 0;
  let currency = "MAD";
  for (const row of rows) {
    const price = row.services?.price;
    if (price != null) {
      total += Number(price);
      currency = row.services?.currency ?? currency;
    }
  }
  return { total, currency };
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function RevenueCard({ label, total, currency }: { label: string; total: number; currency: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">
          {total.toFixed(2)} {currency}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function ClinicOverviewPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const user = await requireUser();
  await requireClinicMembership(clinicId, user.id);

  const supabase = await createClient();

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [
    { count: patientCount },
    { count: dentistCount },
    { count: serviceCount },
    { data: todayData },
    { data: monthData },
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId),
    supabase
      .from("dentists")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    supabase
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    supabase
      .from("appointments")
      .select(
        "id, start_at, end_at, status, patients(full_name), dentists(full_name), services(name_translations, price, currency)",
      )
      .eq("clinic_id", clinicId)
      .gte("start_at", todayStart.toISOString())
      .lt("start_at", todayEnd.toISOString())
      .order("start_at"),
    supabase
      .from("appointments")
      .select("id, services(price, currency)")
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .gte("start_at", monthStart.toISOString())
      .lt("start_at", monthEnd.toISOString()),
  ]);

  const todayAppointments = (todayData ?? []) as unknown as TodayAppointmentRow[];
  const monthAppointments = (monthData ?? []) as unknown as RevenueAppointmentRow[];

  const todayAppointmentCount = todayAppointments.filter((a) => a.status !== "cancelled").length;
  const todayRevenue = sumRevenue(todayAppointments.filter((a) => a.status === "completed"));
  const monthRevenue = sumRevenue(monthAppointments);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Today&apos;s appointments and clinic activity.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total patients" value={patientCount ?? 0} />
        <StatCard label="Active dentists" value={dentistCount ?? 0} />
        <StatCard label="Active services" value={serviceCount ?? 0} />
        <StatCard label="Today's appointments" value={todayAppointmentCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RevenueCard label="Today's revenue" total={todayRevenue.total} currency={todayRevenue.currency} />
        <RevenueCard label="This month's revenue" total={monthRevenue.total} currency={monthRevenue.currency} />
      </div>

      <div>
        <h2 className="text-base font-semibold">Today&apos;s schedule</h2>
        {todayAppointments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No appointments scheduled for today.</p>
        ) : (
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Dentist</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todayAppointments.map((appt) => (
                <TableRow key={appt.id}>
                  <TableCell>{appt.patients?.full_name ?? "—"}</TableCell>
                  <TableCell>{appt.dentists?.full_name ?? "—"}</TableCell>
                  <TableCell>{serviceName(appt.services?.name_translations)}</TableCell>
                  <TableCell>{formatDateTime(appt.start_at)}</TableCell>
                  <TableCell>{formatDateTime(appt.end_at)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[appt.status] ?? "secondary"} className="capitalize">
                      {appt.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
