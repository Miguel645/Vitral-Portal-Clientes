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
