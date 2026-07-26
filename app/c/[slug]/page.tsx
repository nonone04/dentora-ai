import { notFound } from "next/navigation";
import { ChatWidget } from "@/components/patient-chat/chat-widget";
import { getPublicClinicForChat } from "@/lib/ai/public-clinic";

export default async function PublicChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clinic = await getPublicClinicForChat(slug);

  if (!clinic) {
    notFound();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col p-4">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">{clinic.name}</h1>
        <p className="text-sm text-muted-foreground">Chat with our assistant.</p>
      </div>
      <ChatWidget slug={clinic.slug} />
    </div>
  );
}
