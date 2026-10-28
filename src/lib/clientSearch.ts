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
