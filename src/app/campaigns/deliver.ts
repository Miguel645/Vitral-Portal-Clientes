import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "@/lib/messaging";
import { sendInGroups } from "@/lib/messaging/groups";
import { normalizePhone } from "@/lib/phone";
import { appUrlError, unsubscribeBaseUrl } from "@/lib/optOut";
import { generateUniqueCodes } from "@/lib/codes";
import { fetchAll } from "@/lib/fetchAll";
import { lisbonToday } from "@/lib/date";
import { clientFirstName, composeCampaignMessage } from "@/lib/smsText";
import { claimLease, releaseLease, startJob, type Job } from "@/lib/jobs";
import { pendingRecipients, type Recipient } from "./recipients";

// Sending a campaign: one step of it. Used by "Enviar campanha" (a first step of a few
// seconds, while the page waits) and by the background steps (/api/cron/send), which
// carry on by themselves until every client has it.

export type CampaignRow = {
  name: string;
  sms_text: string;
  vale_percent: number | null;
  vale_amount_eur: number | null;
  vale_valid_from: string | null;
  vale_valid_to: string | null;
};

export type StepResult =
  // Another step is sending it right now, or it's not being sent any more (stopped,
  // deleted, past its "Fim"): nothing done.
  | { status: "busy" | "inactive" }
  // `left`: clients still to get it; a background step was started for them.
  | { status: "done"; ok: number; failed: number; skipped: number; left: number }
  // `nothingSent`: no vale was created and no SMS went out in this step.
  | { status: "error"; error: string; nothingSent: boolean };

// Sends the campaign to the clients still missing until `deadline` (a time in ms), then
// hands over to a background step if anyone is left. Only one step at a time (the
// campaign's sending_until), and a client with a log row for it is never sent it again.
export async function runCampaignStep(db: SupabaseClient, id: string, deadline: number): Promise<StepResult> {
  const job: Job = { kind: "campaign", id };
  const lease = await claimLease(db, job);
  if (!lease) return { status: "busy" };
  const result = await step(db, id, deadline);
  if (result.status === "error") {
    await db.from("campaigns").update({ send_error: result.error }).eq("id", id);
  } else if (result.status === "done") {
    await db.from("campaigns").update({ send_error: null }).eq("id", id);
  }
  await releaseLease(db, job, lease);
  // Hand over: the next step starts in its own function, with its own time.
  if (result.status === "done" && result.left > 0) await startJob(job);
  return result;
}

const SELECT = "name, sms_text, status, stopped_at, live_until, vale_percent, vale_amount_eur, vale_valid_from, vale_valid_to";

// Sent, not stopped, and not past its "Fim".
async function stillSending(db: SupabaseClient, id: string): Promise<(CampaignRow & { status: string }) | null> {
  const { data } = await db.from("campaigns").select(SELECT).eq("id", id).maybeSingle();
  if (!data || data.status !== "sent" || data.stopped_at) return null;
  if (data.live_until && data.live_until < lisbonToday()) return null;
  return data;
}

async function step(db: SupabaseClient, id: string, deadline: number): Promise<StepResult> {
  const campaign = await stillSending(db, id);
  if (!campaign) return { status: "inactive" };
  const urlError = appUrlError();
  if (urlError) return { status: "error", error: urlError, nothingSent: true };

  let recipients: Recipient[];
  try {
    recipients = await pendingRecipients(db, id);
  } catch {
    return { status: "error", error: "Não foi possível ler a lista de clientes.", nothingSent: true };
  }
  if (recipients.length === 0) return { status: "done", ok: 0, failed: 0, skipped: 0, left: 0 };

  // A vale only for the clients whose number can receive the SMS. Vales created by an
  // earlier step are reused, never created twice.
  const valeByClient = new Map<string, string>();
  if (campaign.vale_valid_from && campaign.vale_valid_to) {
    const made = await createMissingVales(db, id, campaign, recipients, valeByClient);
    if (made) return made;
  }

  const appUrl = unsubscribeBaseUrl();
  const counts = await sendInGroups(
    recipients,
    deadline,
    (c) =>
      sendSms(
        c.phone,
        composeCampaignMessage(
          campaign.sms_text,
          { firstName: clientFirstName(c.name), vale: valeByClient.get(c.id) ?? "" },
          appUrl,
          c.short_token
        ),
        { clientId: c.id, campaignId: id, db }
      ),
    // "Parar campanha" (or deleting it) stops it between two groups.
    async () => !(await stillSending(db, id))
  );
  if (counts.stopped) return { status: "inactive" };
  return { status: "done", ok: counts.ok, failed: counts.failed, skipped: counts.skipped, left: recipients.length - counts.reached };
}

// Fills `valeByClient` with each recipient's vale, creating the missing ones.
// Returns an error result if that wasn't possible (then nothing is sent).
async function createMissingVales(
  db: SupabaseClient,
  id: string,
  campaign: CampaignRow,
  recipients: Recipient[],
  valeByClient: Map<string, string>
): Promise<StepResult | null> {
  let existing: { client_id: string | null; code: string }[];
  try {
    existing = await fetchAll<{ client_id: string | null; code: string }>((from, to) =>
      db.from("discount_codes").select("client_id, code").eq("campaign_id", id).order("id").range(from, to)
    );
  } catch {
    return { status: "error", error: "Não foi possível ler os vales da campanha, por isso nada foi enviado.", nothingSent: true };
  }
  for (const v of existing) if (v.client_id && !valeByClient.has(v.client_id)) valeByClient.set(v.client_id, v.code);

  const needVale = recipients.filter((c) => normalizePhone(c.phone).ok && !valeByClient.has(c.id));
  let codes: string[];
  try {
    codes = await generateUniqueCodes(db, needVale.length);
  } catch {
    return { status: "error", error: "Não foi possível criar os vales, por isso nada foi enviado.", nothingSent: existing.length === 0 };
  }
  const vales = needVale.map((c, i) => ({
    code: codes[i],
    kind: "manual",
    percent: campaign.vale_percent,
    amount_eur: campaign.vale_amount_eur,
    note: `Campanha: ${campaign.name}`.slice(0, 80),
    client_id: c.id,
    campaign_id: id,
    valid_from: campaign.vale_valid_from,
    valid_to: campaign.vale_valid_to,
  }));
  for (let i = 0; i < vales.length; i += 500) {
    const chunk = vales.slice(i, i + 500);
    const { error } = await db.from("discount_codes").insert(chunk);
    if (error) {
      return {
        status: "error",
        error: "Não foi possível criar os vales, por isso nada foi enviado nesta tentativa.",
        nothingSent: i === 0 && existing.length === 0,
      };
    }
    for (const v of chunk) valeByClient.set(v.client_id, v.code);
  }
  return null;
}
