// Whether a campaign may still be sent to this client (who receives messages, existed
// when it was first sent, and has nothing in the log for it): yes if they already
// received messages when it was first sent, no if they only switched messages on afterwards.
// consent_at is empty for consents from before 28/10/2026, which count as "already then".
export function consentedByFirstSend(client: { consent_at: string | null }, firstSentAt: string): boolean {
  return !client.consent_at || new Date(client.consent_at).getTime() <= new Date(firstSentAt).getTime();
}
