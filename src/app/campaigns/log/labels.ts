// How an sms_log row is shown, on the send history and on a client's page.

export const STATUS_LABEL: Record<string, string> = {
  simulated: "Simulado",
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Ignorado",
  // The page stopped while the SMS was being sent (see INTERRUPTED_STATUS in messaging).
  sending: "Interrompido",
};

// Green when it went out, red when it didn't (or may not have); the tag always has a word.
export function statusTagClass(status: string): string {
  if (status === "sent") return "tag on";
  if (status === "failed" || status === "skipped" || status === "sending") return "tag warn";
  return "tag";
}

// Where the SMS came from: a test, a campaign (by name), the welcome SMS, or a vale
// (Criar vales or a birthday).
export function sourceLabel(r: { is_test: boolean; kind: string | null; campaigns: { name: string } | null }): string {
  if (r.is_test) return "Teste";
  if (r.campaigns?.name) return r.campaigns.name;
  return r.kind === "welcome" ? "Boas-vindas" : "Vale";
}
