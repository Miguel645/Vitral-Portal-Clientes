import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Background sending. A big send (a campaign, or "Criar vales" with SMS) runs in short
// steps of about 35 seconds, each in its own Vercel function (/api/cron/send). When a step
// runs out of time with clients left, it starts the next step itself, until nobody is
// left. Nobody has to press anything. The daily 10:00 job (and opening the campaign's
// summary or the Vales page) starts a step again if a hand-off was ever lost.
export type Job = { kind: "campaign" | "vales"; id: string };

// How long one background step may send before handing over (its function may run 60 s;
// a group of SMS can take up to 20 s if the provider is slow).
export const STEP_MS = 35_000;
// While a step runs, the row's sending_until is set this far ahead: no other step can
// start meanwhile. If a step dies, the next one can start once it has passed.
const LEASE_MS = 2 * 60_000;

// The address of this same site, for a step to start the next one.
function selfUrl(): string | null {
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const appUrl = (process.env.APP_URL ?? "").trim().replace(/\/$/, "");
  return appUrl || "http://localhost:3000";
}

// Starts a background step for `job`. The step's address answers straight away and does
// the sending after, so this only waits a moment. False if it couldn't be started (the
// daily job tries again).
export async function startJob(job: Job): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const base = selfUrl();
  if (!secret || !base) return false;
  try {
    const res = await fetch(`${base}/api/cron/send`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify(job),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const TABLE = { campaign: "campaigns", vales: "vale_batches" } as const;

// Takes the job's "one step at a time" marker. Returns the marker's value (needed to
// give it back), or null when another step is sending right now.
export async function claimLease(db: SupabaseClient, job: Job): Promise<string | null> {
  const now = new Date();
  const until = new Date(now.getTime() + LEASE_MS).toISOString();
  const { data } = await db
    .from(TABLE[job.kind])
    .update({ sending_until: until })
    .eq("id", job.id)
    // Quoted: the time has "." and ":", which have a meaning inside .or().
    .or(`sending_until.is.null,sending_until.lt."${now.toISOString()}"`)
    .select("id");
  return data?.length ? until : null;
}

// Gives the marker back (only if it's still this step's), so the next step can start.
export async function releaseLease(db: SupabaseClient, job: Job, lease: string): Promise<void> {
  await db.from(TABLE[job.kind]).update({ sending_until: null }).eq("id", job.id).eq("sending_until", lease);
}

// True while a step holds the marker (it's sending now).
export function isSending(sendingUntil: string | null): boolean {
  return !!sendingUntil && new Date(sendingUntil).getTime() > Date.now();
}
