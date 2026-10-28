// Whether a live campaign's daily run should send to this client (who receives messages
// and has nothing in the log for the campaign yet): yes if they were added after the
// campaign was first sent, or already received messages then (a first send that stopped
// half-way). No for older clients who only switched messages on afterwards.
// consent_at is empty for consents from before 28/10/2026, which count as "already then".
export function inLiveAudience(
  client: { created_at: string; consent_at: string | null },
  firstSentAt: string
): boolean {
  const since = new Date(firstSentAt).getTime();
  return (
    new Date(client.created_at).getTime() > since ||
    !client.consent_at ||
    new Date(client.consent_at).getTime() <= since
  );
}
