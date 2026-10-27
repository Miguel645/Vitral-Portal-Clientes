export type StatusKey = "active" | "expired" | "used_up" | "disabled";

export function codeStatus(c: {
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  times_used: number;
}): { key: StatusKey; label: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (!c.active) return { key: "disabled", label: "Desativado" };
  if (c.expires_at && c.expires_at < today) return { key: "expired", label: "Expirado" };
  if (c.max_uses != null && c.times_used >= c.max_uses) return { key: "used_up", label: "Esgotado" };
  return { key: "active", label: "Ativo" };
}
