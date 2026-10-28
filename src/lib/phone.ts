export type PhoneResult = { ok: true; value: string } | { ok: false; error: string };

const INVALID = "Número de telefone inválido. Verifique e tente novamente.";

export function normalizePhone(raw: string): PhoneResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: INVALID };

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return { ok: false, error: INVALID };
    return { ok: true, value: `+${digits}` };
  }

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (/^9\d{8}$/.test(digitsOnly)) {
    return { ok: true, value: `+351${digitsOnly}` };
  }

  return { ok: false, error: INVALID };
}

// For display only: "912345678" -> "912 345 678", "+351912345678" -> "+351 912 345 678".
// Anything else is shown as it was typed.
export function formatPhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+") && digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (trimmed.startsWith("+351") && digits.length === 12) {
    return `+351 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return trimmed;
}

// Same number written two different ways ("912 345 678" vs "+351912345678") counts as equal.
export function samePhone(a: string, b: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (na.ok && nb.ok) return na.value === nb.value;
  return a.replace(/\D/g, "") === b.replace(/\D/g, "");
}
