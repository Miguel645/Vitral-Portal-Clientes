import { after, NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STEP_MS, type Job } from "@/lib/jobs";
import { runCampaignStep } from "@/app/campaigns/deliver";
import { runValeBatchStep } from "@/app/codes/valeBatch";

export const maxDuration = 60;

// One background sending step (see src/lib/jobs). Called by the site itself (startJob)
// with the CRON_SECRET. It answers straight away and sends after that, for up to STEP_MS;
// if clients are left, that step starts the next one.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = (await request.json().catch(() => null)) as Partial<Job> | null;
  if (!job || (job.kind !== "campaign" && job.kind !== "vales") || !/^[0-9a-f-]{36}$/i.test(job.id ?? "")) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const startedAt = Date.now();
  const { kind, id } = job as Job;
  after(async () => {
    const db = createAdminClient();
    const deadline = startedAt + STEP_MS;
    if (kind === "campaign") await runCampaignStep(db, id, deadline);
    else await runValeBatchStep(db, id, deadline);
  });
  return NextResponse.json({ started: true }, { status: 202 });
}
