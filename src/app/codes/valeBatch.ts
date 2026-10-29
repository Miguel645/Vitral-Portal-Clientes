import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "@/lib/messaging";
import { sendInGroups } from "@/lib/messaging/groups";
import { fetchAll } from "@/lib/fetchAll";
import { formatDiscount } from "@/lib/discount";
import { formatDate, lisbonToday } from "@/lib/date";
import { appUrlError, unsubscribeBaseUrl } from "@/lib/optOut";
import { clientFirstName, composeValeMessage } from "@/lib/smsText";
import { claimLease, releaseLease, startJob, type Job } from "@/lib/jobs";

// The SMS of one "Criar vales" run (a vale_batches row): the vales are all created first,
// then the SMS go out in steps, like campaigns. Used by "Criar vales" (a first step of a
// few seconds, while the page waits) and by the background steps (/api/cron/send).

type Vale = { client_id: string | null; code: string; percent: number | null; amount_eur: number | null; valid_to: string };
type Pending = { id: string; name: string; phone: string; short_token: string; vales: Vale[] };

export type BatchStepResult =
  | { status: "busy" | "inactive" }
  | { status: "done"; ok: number; failed: number; skipped: number; left: number }
  | { status: "error"; error: string };

// Clients of the run who still receive messages, still have a vale from it, and haven't
// had its SMS yet (a log row for the run means it was sent, or tried: never again).
async function pendingForBatch(db: SupabaseClient, batchId: string): Promise<Pending[]> {
  const [vales, logged] = await Promise.all([
    fetchAll<Vale>((from, to) =>
      db
        .from("discount_codes")
        .select("client_id, code, percent, amount_eur, valid_to")
        .eq("batch_id", batchId)
        .order("id")
        .range(from, to)
    ),
    fetchAll<{ client_id: string | null }>((from, to) =>
      db.from("sms_log").select("client_id").eq("batch_id", batchId).order("id").range(from, to)
    ),
  ]);
  const done = new Set(logged.map((r) => r.client_id));
  const byClient = new Map<string, Vale[]>();
  for (const v of vales) {
    if (!v.client_id || done.has(v.client_id)) continue;
    byClient.set(v.client_id, [...(byClient.get(v.client_id) ?? []), v]);
  }

  // 200 ids per request, so it never gets too long.
  const ids = [...byClient.keys()];
  const out: Pending[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from("clients")
      .select("id, name, phone, short_token")
      .in("id", ids.slice(i, i + 200))
      .eq("consent", true);
    if (error) throw new Error(error.message);
    for (const c of data ?? []) out.push({ ...c, vales: byClient.get(c.id) ?? [] });
  }
  return out;
}

// How many clients of the run still have to get the SMS (for the Vales page).
export async function batchLeft(db: SupabaseClient, batchId: string): Promise<number> {
  return (await pendingForBatch(db, batchId)).length;
}

// Sends the run's SMS to the clients still missing until `deadline` (a time in ms), then
// hands over to a background step if anyone is left, or marks the run finished.
export async function runValeBatchStep(db: SupabaseClient, batchId: string, deadline: number): Promise<BatchStepResult> {
  const job: Job = { kind: "vales", id: batchId };
  const lease = await claimLease(db, job);
  if (!lease) return { status: "busy" };
  const result = await step(db, batchId, deadline);
  if (result.status === "error") {
    await db.from("vale_batches").update({ send_error: result.error }).eq("id", batchId);
  } else if (result.status === "done") {
    await db
      .from("vale_batches")
      .update({ send_error: null, ...(result.left === 0 ? { finished_at: new Date().toISOString() } : {}) })
      .eq("id", batchId);
  }
  await releaseLease(db, job, lease);
  if (result.status === "done" && result.left > 0) await startJob(job);
  return result;
}

async function step(db: SupabaseClient, batchId: string, deadline: number): Promise<BatchStepResult> {
  const { data: batch } = await db
    .from("vale_batches")
    .select("sms_text, valid_to, finished_at")
    .eq("id", batchId)
    .maybeSingle<{ sms_text: string; valid_to: string; finished_at: string | null }>();
  if (!batch || batch.finished_at) return { status: "inactive" };
  // Too late: an SMS with an expired vale would only confuse the client.
  if (batch.valid_to < lisbonToday()) {
    await db
      .from("vale_batches")
      .update({ finished_at: new Date().toISOString(), send_error: "Os vales expiraram antes de todos os SMS saírem; os que faltavam não foram enviados." })
      .eq("id", batchId);
    return { status: "inactive" };
  }
  const urlError = appUrlError();
  if (urlError) return { status: "error", error: urlError };

  let pending: Pending[];
  try {
    pending = await pendingForBatch(db, batchId);
  } catch {
    return { status: "error", error: "Não foi possível ler a lista de clientes." };
  }

  const appUrl = unsubscribeBaseUrl();
  const counts = await sendInGroups(pending, deadline, (c) =>
    sendSms(
      c.phone,
      composeValeMessage(
        batch.sms_text,
        {
          firstName: clientFirstName(c.name),
          codes: c.vales.map((v) => v.code),
          discount: formatDiscount(c.vales[0]),
          validTo: formatDate(c.vales[0].valid_to),
        },
        appUrl,
        c.short_token
      ),
      { clientId: c.id, batchId, db }
    )
  );
  return { status: "done", ok: counts.ok, failed: counts.failed, skipped: counts.skipped, left: pending.length - counts.reached };
}
