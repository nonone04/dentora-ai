import { CalendarClock } from "lucide-react";
import { GlassCard } from "@/components/dashboard/glass-card";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime, serviceName, STATUS_VARIANT } from "@/lib/format";
import { getServerDictionary, interpolate } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type AppointmentRow = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  patients: { full_name: string } | null;
  dentists: { full_name: string } | null;
  services: { name_translations: Record<string, string> } | null;
};

const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-muted-foreground",
  confirmed: "bg-brand shadow-[0_0_10px_2px_theme(colors.blue.400/0.5)]",
  completed: "bg-success shadow-[0_0_10px_2px_theme(colors.emerald.400/0.5)]",
  cancelled: "bg-destructive",
  no_show: "bg-destructive",
};

export function AppointmentTimelineSkeleton() {
  return (
    <GlassCard className="h-full" aria-hidden="true">
      <div className="flex flex-col gap-1.5 border-b p-(--card-spacing)">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="size-2.5 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </CardContent>
    </GlassCard>
  );
}

/** Data-only -- kept separate from the component below so a fetch failure never risks being read as a "JSX might throw" case (see the react-hooks/error-boundaries lint rule). */
async function loadTodaysAppointments(clinicId: string): Promise<AppointmentRow[] | null> {
  try {
    const supabase = await createClient();
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("appointments")
      .select("id, start_at, end_at, status, patients(full_name), dentists(full_name), services(name_translations)")
      .eq("clinic_id", clinicId)
      .gte("start_at", todayStart.toISOString())
      .lt("start_at", todayEnd.toISOString())
      .order("start_at");

    if (error) throw error;
    return (data ?? []) as unknown as AppointmentRow[];
  } catch {
    return null;
  }
}

/** Today's appointments, RLS-scoped like the rest of the app -- visible to every clinic role. */
export async function AppointmentTimeline({ clinicId }: { clinicId: string }) {
  const [appointments, t] = await Promise.all([loadTodaysAppointments(clinicId), getServerDictionary()]);

  if (appointments === null) {
    return (
      <GlassCard className="h-full">
        <SectionHeader title={t.dashboard.schedule.title} />
        <ErrorState title={t.dashboard.schedule.error} />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="h-full">
      <SectionHeader
        title={t.dashboard.schedule.title}
        description={
          appointments.length === 1
            ? t.dashboard.schedule.appointmentCountOne
            : interpolate(t.dashboard.schedule.appointmentCountOther, { count: appointments.length })
        }
        href={`/clinic/${clinicId}/appointments`}
        hrefLabel={t.common.viewAll}
      />
      <CardContent>
        {appointments.length === 0 ? (
          <EmptyState icon={CalendarClock} title={t.dashboard.schedule.empty} description={t.dashboard.schedule.emptyDescription} />
        ) : (
          <ol className="flex flex-col">
            {appointments.map((appt, index) => (
              <li
                key={appt.id}
                style={{ animationDelay: `${index * 60}ms`, animationDuration: "450ms", animationFillMode: "backwards" }}
                className="flex gap-3 rounded-xl fade-in slide-in-from-bottom-1 animate-in"
              >
                <time
                  dateTime={appt.start_at}
                  className="w-14 shrink-0 pt-0.5 text-end text-xs font-medium text-muted-foreground tabular-nums"
                >
                  {formatTime(appt.start_at)}
                </time>
                <div className="flex w-2.5 shrink-0 flex-col items-center">
                  <span
                    aria-hidden="true"
                    className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", STATUS_DOT[appt.status] ?? "bg-muted-foreground")}
                  />
                  {index < appointments.length - 1 && (
                    <span aria-hidden="true" className="w-px flex-1 bg-gradient-to-b from-foreground/15 to-transparent" />
                  )}
                </div>
                <div className="flex flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-xl px-2 -mx-2 pb-5 transition-colors duration-150 hover:bg-foreground/[0.03]">
                  <div>
                    <div className="text-sm font-medium">{appt.patients?.full_name ?? t.dashboard.schedule.unknownPatient}</div>
                    <div className="text-xs text-muted-foreground">
                      {appt.dentists?.full_name ?? t.common.dash} · {serviceName(appt.services?.name_translations)}
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[appt.status] ?? "secondary"}>
                    {t.appointmentStatus[appt.status as keyof typeof t.appointmentStatus] ?? appt.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </GlassCard>
  );
}
