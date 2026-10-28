// New messages use the client's short 8-character token; messages sent before
// that carry the long id (unsubscribe_token), and those links must keep working.
export function tokenColumn(token: string): "unsubscribe_token" | "short_token" | null {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return "unsubscribe_token";
  if (/^[a-z0-9]{8}$/.test(token)) return "short_token";
  return null;
}
