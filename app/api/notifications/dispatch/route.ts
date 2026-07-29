import { NextResponse } from "next/server";
import { processDueNotificationDeliveries } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Counterpart to /api/notifications/process, but for the newer
// notification_deliveries pipeline (lib/notifications/engine.ts) rather
// than the original `notifications` table. Same CRON_SECRET-protected,
// externally-triggered shape -- see that route for the full rationale.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const result = await processDueNotificationDeliveries(supabase);
  return NextResponse.json(result);
}
