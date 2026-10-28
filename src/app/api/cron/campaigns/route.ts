import { NextRequest, NextResponse } from "next/server";
import { runLiveCampaigns } from "@/app/campaigns/live";
import { lisbonHour } from "@/lib/date";

export const maxDuration = 60;

// Vercel Cron runs in UTC, so vercel.json calls this at 09:00 and 10:00 UTC and only the
// run that falls in the 10:00 hour in Lisbon sends (summer time or not).
const SEND_HOUR = 10;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (lisbonHour() !== SEND_HOUR) return NextResponse.json({ skipped: `Só envia às ${SEND_HOUR}h de Lisboa.` });

  const result = await runLiveCampaigns();
  // An error shows as a failed run in Vercel > Cron Jobs.
  return NextResponse.json(result, { status: result.error ? 500 : 200 });
}
