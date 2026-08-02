import { CommunicationHistoryTable } from "@/components/communications/communication-history-table";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { listCommunicationHistory } from "@/lib/notifications/queries";
import { createClient } from "@/lib/supabase/server";

export default async function CommunicationsPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const { clinicId } = await params;
  const supabase = await createClient();

  const [items, t, locale] = await Promise.all([
    listCommunicationHistory(supabase, { clinicId }),
    getServerDictionary(),
    getServerLocale(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">{t.communications.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.communications.description}</p>
      </div>

      <CommunicationHistoryTable items={items ?? []} t={t} locale={locale} />
    </div>
  );
}
