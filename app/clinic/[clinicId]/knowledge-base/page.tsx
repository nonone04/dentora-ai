import { KnowledgeBaseDialog } from "@/components/knowledge-base/knowledge-base-dialog";
import { Badge } from "@/components/ui/badge";
import { getServerDictionary } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

type EntryRow = {
  id: string;
  category: string | null;
  question: string;
  answer: string;
  is_active: boolean;
};

export default async function KnowledgeBasePage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);
  const canManage = membership.role === "owner" || membership.role === "admin";

  const supabase = await createClient();
  const [{ data: entriesData }, t] = await Promise.all([
    supabase
      .from("knowledge_base_entries")
      .select("id, category, question, answer, is_active")
      .eq("clinic_id", clinicId)
      .order("created_at"),
    getServerDictionary(),
  ]);

  const entries = (entriesData ?? []) as EntryRow[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t.knowledgeBase.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.knowledgeBase.description}</p>
        </div>
        {canManage && <KnowledgeBaseDialog clinicId={clinicId} triggerLabel={t.knowledgeBase.newTrigger} />}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.knowledgeBase.empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {entry.category && (
                      <Badge variant="secondary" className="capitalize">
                        {entry.category}
                      </Badge>
                    )}
                    {!entry.is_active && <Badge variant="outline">{t.common.inactive}</Badge>}
                  </div>
                  <p className="mt-2 font-medium">{entry.question}</p>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                    {entry.answer}
                  </p>
                </div>
                {canManage && (
                  <KnowledgeBaseDialog
                    clinicId={clinicId}
                    entry={entry}
                    triggerLabel={t.knowledgeBase.editTrigger}
                    triggerVariant="ghost"
                    triggerSize="sm"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
