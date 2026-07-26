import { notFound } from "next/navigation";
import { TimeOffManager } from "@/components/dentists/time-off-manager";
import { WorkingHoursManager } from "@/components/dentists/working-hours-manager";
import { DetailField } from "@/components/detail-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

export default async function DentistDetailPage({
  params,
}: {
  params: Promise<{ clinicId: string; dentistId: string }>;
}) {
  const { clinicId, dentistId } = await params;
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);
  const canManage = membership.role === "owner" || membership.role === "admin";

  const supabase = await createClient();

  const { data: dentist } = await supabase
    .from("dentists")
    .select("id, full_name, specialty, license_number, color, is_active")
    .eq("clinic_id", clinicId)
    .eq("id", dentistId)
    .maybeSingle();

  if (!dentist) {
    notFound();
  }

  const [{ data: workingHours }, { data: timeOff }] = await Promise.all([
    supabase
      .from("dentist_working_hours")
      .select("id, day_of_week, start_time, end_time")
      .eq("dentist_id", dentistId)
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("dentist_time_off")
      .select("id, start_at, end_at, reason")
      .eq("dentist_id", dentistId)
      .order("start_at"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">{dentist.full_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Dentist profile and schedule.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <DetailField label="Specialty" value={dentist.specialty} />
          <DetailField label="License number" value={dentist.license_number} />
          <div>
            <div className="text-muted-foreground">Status</div>
            <Badge variant={dentist.is_active ? "secondary" : "outline"}>
              {dentist.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <WorkingHoursManager
        clinicId={clinicId}
        dentistId={dentistId}
        workingHours={workingHours ?? []}
        canManage={canManage}
      />

      <TimeOffManager
        clinicId={clinicId}
        dentistId={dentistId}
        timeOff={timeOff ?? []}
        canManage={canManage}
      />
    </div>
  );
}
