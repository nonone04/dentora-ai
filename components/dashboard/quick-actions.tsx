import Link from "next/link";
import { BookOpen, Inbox } from "lucide-react";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";
import { NewPatientDialog } from "@/components/patients/new-patient-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { serviceName } from "@/lib/format";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export function QuickActionsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-8 w-32 rounded-lg" />
      ))}
    </div>
  );
}

/** The fastest paths into the app's most common tasks -- reuses the existing New appointment / New patient dialogs unchanged, plus links to the two other places staff jump to most. */
export async function QuickActions({ clinicId }: { clinicId: string }) {
  const [supabase, t, locale] = await Promise.all([createClient(), getServerDictionary(), getServerLocale()]);
  const [{ data: patients }, { data: dentists }, { data: services }] = await Promise.all([
    supabase.from("patients").select("id, full_name").eq("clinic_id", clinicId).order("full_name").limit(200),
    supabase.from("dentists").select("id, full_name").eq("clinic_id", clinicId).eq("is_active", true).order("full_name"),
    supabase
      .from("services")
      .select("id, name_translations, default_duration_minutes")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
  ]);

  const serviceOptions = (services ?? []).map((service) => ({
    id: service.id as string,
    name: serviceName(service.name_translations as Record<string, string> | null, locale),
    defaultDurationMinutes: service.default_duration_minutes as number,
  }));

  const linkClass = cn(
    buttonVariants({ variant: "outline" }),
    "gap-1.5 rounded-full border-foreground/10 bg-foreground/[0.03] backdrop-blur-xl hover:bg-foreground/[0.07]",
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NewAppointmentDialog clinicId={clinicId} patients={patients ?? []} dentists={dentists ?? []} services={serviceOptions} />
      <NewPatientDialog clinicId={clinicId} />
      <Link href={`/clinic/${clinicId}/ai-inbox`} className={linkClass}>
        <Inbox className="size-4" aria-hidden="true" />
        {t.dashboard.quickActions.aiInbox}
      </Link>
      <Link href={`/clinic/${clinicId}/knowledge-base`} className={linkClass}>
        <BookOpen className="size-4" aria-hidden="true" />
        {t.dashboard.quickActions.knowledgeBase}
      </Link>
    </div>
  );
}
