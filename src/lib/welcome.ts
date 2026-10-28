import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./date";
import { clientFirstName, composeCampaignMessage } from "./smsText";
import type { SendResult } from "./messaging/types";

// The welcome SMS ("Mensagem de boas-vindas" on Definições): sent once to a client
// who is saved with "Recebe mensagens" ticked. The sending itself is in
// welcomeSms.ts (server-only); this part has no server imports so it can be tested.

// No accents that cost extra (see SmsCostWarning). Same as the database default.
export const DEFAULT_WELCOME_TEXT = "Boas-vindas à Vitral, {nome}! Vai passar a receber as nossas novidades por SMS.";

export type WelcomeSettings = {
  active: boolean;
  sms_text: string;
  // Both null, or one of them with vale_valid_days: the vale is optional.
  vale_percent: number | null;
  vale_amount_eur: number | null;
  vale_valid_days: number | null;
};

export type WelcomeClient = {
  id: string;
  name: string;
  phone: string;
  consent: boolean;
  short_token: string;
  // Set the moment a welcome SMS is claimed (and for every client who existed
  // before welcome SMS were added, see the migration), so it's never sent twice.
  welcome_sent_at: string | null;
};

// What to do after a client is saved:
// - "skip": they don't receive messages, or already had (or never get) a welcome SMS.
// - "mark": welcome SMS are switched off, so they're marked as welcomed without one;
//   switching it on later only welcomes clients who join after that.
// - "send": send it now.
export function welcomeAction(
  client: Pick<WelcomeClient, "consent" | "welcome_sent_at">,
  settings: Pick<WelcomeSettings, "active"> | null
): "skip" | "mark" | "send" {
  if (!client.consent || client.welcome_sent_at) return "skip";
  return settings?.active ? "send" : "mark";
}

// Sets welcome_sent_at only if nobody else has, and only while the client still
// receives messages. True when this call got it.
export async function claimWelcome(db: SupabaseClient, clientId: string): Promise<boolean> {
  const { data } = await db
    .from("clients")
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq("id", clientId)
    .is("welcome_sent_at", null)
    .eq("consent", true)
    .select("id");
  return !!data?.length;
}

export type WelcomeResult =
  // Someone else already claimed it (a double tap, or it was sent before): nothing done.
  | { status: "already" }
  | { status: "sent" }
  // `valeCode`: the vale was created before the SMS failed, so it's on the client's record.
  | { status: "failed"; error: string; valeCode?: string };

// Claims the client first, then creates the vale (if the settings include one),
// then sends one SMS. If the vale can't be created nothing was sent, so the claim
// is given back and the next save tries again. Once the SMS was attempted the
// claim stays, even if it failed: it may have reached the phone anyway.
export async function sendWelcome(
  db: SupabaseClient,
  client: WelcomeClient,
  settings: WelcomeSettings,
  deps: {
    send: (to: string, text: string) => Promise<SendResult>;
    newCode: () => Promise<string>;
    today: string;
    // Base of the unsubscribe link, null when it's switched off.
    appUrl: string | null;
  }
): Promise<WelcomeResult> {
  if (!(await claimWelcome(db, client.id))) return { status: "already" };

  let code = "";
  if (settings.vale_valid_days) {
    let created = false;
    try {
      code = await deps.newCode();
      const { error } = await db.from("discount_codes").insert({
        code,
        kind: "manual",
        percent: settings.vale_percent,
        amount_eur: settings.vale_amount_eur,
        note: "Boas-vindas",
        client_id: client.id,
        valid_from: deps.today,
        valid_to: addDays(deps.today, settings.vale_valid_days),
      });
      created = !error;
    } catch {
      // No unique code could be found: same as the insert failing.
    }
    if (!created) {
      await db.from("clients").update({ welcome_sent_at: null }).eq("id", client.id);
      return {
        status: "failed",
        error: "Não foi possível criar o vale de boas-vindas, por isso a mensagem não foi enviada. Guarde o cliente outra vez para tentar de novo.",
      };
    }
  }

  const text = composeCampaignMessage(
    settings.sms_text,
    { firstName: clientFirstName(client.name), vale: code },
    deps.appUrl,
    client.short_token
  );
  const result = await deps.send(client.phone, text);
  if (result.ok) return { status: "sent" };
  return {
    status: "failed",
    error: result.error ?? "O fornecedor de SMS não aceitou a mensagem.",
    ...(code ? { valeCode: code } : {}),
  };
}
