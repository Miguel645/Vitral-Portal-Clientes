import { NextRequest, NextResponse } from "next/server";
import { runBirthdayCheck } from "@/lib/birthdayCodes";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runBirthdayCheck();
  // An error shows as a failed run in Vercel > Cron Jobs.
  return NextResponse.json(result, { status: result.error ? 500 : 200 });
}
