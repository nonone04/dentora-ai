"use server";

import { revalidatePath } from "next/cache";
import { applyDeliveryEvent, archiveDelivery } from "@/lib/notifications/store";
import { listNotificationCenterItems } from "@/lib/notifications/queries";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

export type NotificationActionResult = { success: boolean };

/** Any active clinic member may act on the shared, clinic-wide notification list -- there's no per-user recipient today, see docs/customer-communications.md. */
async function requireMember(clinicId: string) {
  const user = await requireUser();
  await requireClinicMembership(clinicId, user.id);
}

export async function markNotificationRead(clinicId: string, deliveryId: string): Promise<NotificationActionResult> {
  await requireMember(clinicId);
  const supabase = await createClient();
  const outcome = await applyDeliveryEvent(supabase, { clinicId, id: deliveryId, event: "mark_read" });
  revalidatePath(`/clinic/${clinicId}`);
  return { success: outcome.ok };
}

export async function archiveNotification(clinicId: string, deliveryId: string): Promise<NotificationActionResult> {
  await requireMember(clinicId);
  const supabase = await createClient();
  const ok = await archiveDelivery(supabase, { clinicId, id: deliveryId });
  revalidatePath(`/clinic/${clinicId}`);
  return { success: ok };
}

/** Best-effort: marks every currently-unread in_app delivery as read, skipping any that fail (already transitioned by someone else, etc.) rather than aborting the batch. */
export async function markAllNotificationsRead(clinicId: string): Promise<NotificationActionResult> {
  await requireMember(clinicId);
  const supabase = await createClient();

  const items = await listNotificationCenterItems(supabase, { clinicId, channel: "in_app" });
  const unread = (items ?? []).filter((item) => item.status === "sent" || item.status === "delivered");

  for (const item of unread) {
    await applyDeliveryEvent(supabase, { clinicId, id: item.id, event: "mark_read" });
  }

  revalidatePath(`/clinic/${clinicId}`);
  return { success: true };
}
