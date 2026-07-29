import { CalendarPageClient } from "@/components/calendar/calendar-page-client";
import { FeatureUsageBeacon } from "@/components/telemetry/feature-usage-beacon";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;

  return (
    <>
      <FeatureUsageBeacon feature="calendar" clinicId={clinicId} />
      <CalendarPageClient clinicId={clinicId} />
    </>
  );
}
