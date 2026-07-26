import { NextResponse } from "next/server";
import { processDueNotifications } from "@/lib/notifications/process";

export const dynamic = "force-dynamic";

// Triggered by Vercel Cron (see vercel.json) or any external scheduler that
// can present the shared secret. Not a user-facing route -- there is no
// user session for an automated trigger, so this is protected by
// CRON_SECRET rather than Supabase auth. Vercel's own cron jobs send this
// exact `Authorization: Bearer <CRON_SECRET>` header by convention.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDueNotifications();
  return NextResponse.json(result);
}
