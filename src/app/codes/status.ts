import { lisbonToday } from "@/lib/date";

export type StatusKey = "active" | "not_started" | "expired" | "used";

export function codeStatus(
  c: { valid_from: string; valid_to: string; used_at: string | null },
  today: string = lisbonToday()
): { key: StatusKey; label: string } {
  if (c.used_at) return { key: "used", label: "Usado" };
  if (today < c.valid_from) return { key: "not_started", label: "Por começar" };
  if (today > c.valid_to) return { key: "expired", label: "Expirado" };
  return { key: "active", label: "Ativo" };
}
