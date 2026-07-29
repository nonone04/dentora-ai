import { notFound } from "next/navigation";
import { ConversationInspectorClient } from "@/components/ai-inspector/conversation-inspector-client";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";

export default async function AIInspectorPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);

  if (membership.role !== "owner" && membership.role !== "admin") {
    notFound();
  }

  return <ConversationInspectorClient clinicId={clinicId} />;
}
