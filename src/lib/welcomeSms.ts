import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSimulation, sendSms } from "./messaging";
import { generateUniqueCode } from "./codes";
import { lisbonToday } from "./date";
import { appUrlError, unsubscribeBaseUrl } from "./optOut";
import { sendWelcome, welcomeAction, type WelcomeClient, type WelcomeSettings } from "./welcome";

// Runs right after a client is saved. Returns a sentence to add to the "saved"
// message, or an error when the welcome SMS should have gone out but didn't
// (the client is saved either way). Null when there was nothing to do.
export async function welcomeAfterSave(
  db: SupabaseClient,
  clientId: string
): Promise<{ message: string } | { error: string } | null> {
  const [{ data: client }, { data: settings }] = await Promise.all([
    db
      .from("clients")
      .select("id, name, phone, consent, short_token, welcome_sent_at")
      .eq("id", clientId)
      .maybeSingle<WelcomeClient>(),
    db
      .from("welcome_settings")
      .select("active, sms_text, vale_percent, vale_amount_eur, vale_valid_days")
      .eq("id", 1)
      .maybeSingle<WelcomeSettings>(),
  ]);
  if (!client) return null;

  const action = welcomeAction(client, settings);
  if (action === "skip") return null;
  if (action === "mark") {
    await db.from("clients").update({ welcome_sent_at: new Date().toISOString() }).eq("id", clientId).is("welcome_sent_at", null);
    return null;
  }

  // Checked before claiming, so saving the client again sends it once APP_URL is set.
  const urlError = appUrlError();
  if (urlError) return { error: urlError };

  const result = await sendWelcome(db, client, settings!, {
    send: (to, text) => sendSms(to, text, { clientId, kind: "welcome", db }),
    newCode: () => generateUniqueCode(db),
    today: lisbonToday(),
    appUrl: unsubscribeBaseUrl(),
  });
  if (result.status === "already") return null;
  if (result.status === "sent") {
    return {
      message: isSimulation()
        ? "Mensagem de boas-vindas simulada (modo simulação, nada foi enviado de verdade)."
        : "Mensagem de boas-vindas enviada.",
    };
  }
  return {
    error: result.valeCode
      ? `${result.error} O vale de boas-vindas ${result.valeCode} ficou na ficha do cliente.`
      : result.error,
  };
}
