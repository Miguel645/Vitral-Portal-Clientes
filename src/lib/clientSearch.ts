// Phone numbers are stored as typed ("912 345 678", "912345678", "+351…"), so a
// number search matches the digits in order with anything that isn't a digit between them.
export function digitsPattern(digits: string): string {
  return digits.split("").join("[^0-9]*");
}

// The `.or()` filter for a client search: the name or email contains the text, or,
// when the text is a number, the phone has those digits ("912 345" finds "912345678").
// Null when there's nothing to search for.
export function clientSearchFilter(raw: string): string | null {
  // Quotes and backslashes would break the filter; % and * are wildcards.
  const term = raw.trim().replace(/["\\%*]/g, "");
  if (!term) return null;
  const parts = [`name.ilike."%${term}%"`, `email.ilike."%${term}%"`];
  if (/^[\d\s+().-]+$/.test(term)) {
    const digits = term.replace(/\D/g, "");
    if (digits) parts.push(`phone.imatch.${digitsPattern(digits)}`);
  }
  return parts.join(",");
}

// The same rules as clientSearchFilter, checked in the browser: used to narrow the
// results already on screen while the database answers for the newer text.
export function matchesClientSearch(client: { name: string; phone: string; email?: string | null }, raw: string): boolean {
  const term = raw.trim().replace(/["\\%*]/g, "").toLowerCase();
  if (!term) return true;
  if (client.name.toLowerCase().includes(term) || (client.email ?? "").toLowerCase().includes(term)) return true;
  if (/^[\d\s+().-]+$/.test(term)) {
    const digits = term.replace(/\D/g, "");
    return digits !== "" && client.phone.replace(/\D/g, "").includes(digits);
  }
  return false;
}
