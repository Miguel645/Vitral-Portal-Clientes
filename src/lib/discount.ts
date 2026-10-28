const EURO = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

// A vale is either a percentage ("10%") or a fixed euro amount ("5,00 €").
export function formatDiscount(v: { percent: number | null; amount_eur: number | null }): string {
  if (v.amount_eur != null) return EURO.format(Number(v.amount_eur));
  return `${Number(v.percent)}%`;
}

export const KIND_LABEL: Record<string, string> = { birthday: "Aniversário", manual: "Manual" };
