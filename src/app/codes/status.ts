import { lisbonToday } from "@/lib/date";

export type StatusKey = "active" | "not_started" | "expired" | "used";

export function codeStatus(
  c: { valid_from: string; valid_to: string; used_at: string | null },
  today: string = lisbonToday()
): { key: StatusKey; label: string } {
  if (c.used_at) return { key: "used", label: "Já usado" };
  if (today < c.valid_from) return { key: "not_started", label: "Por começar" };
  if (today > c.valid_to) return { key: "expired", label: "Expirado" };
  return { key: "active", label: "Ativo" };
}

// Tag colour is only reinforcement (the label always has a word): active = green, anything else = red.
export function tagClass(key: StatusKey): string {
  return key === "active" ? "tag on" : "tag warn";
}

// Where to go back to after confirming: the vales list or a client's page, nothing else.
export function safeBack(back: string | undefined): string {
  return back && /^\/clients\/[\w-]+$/.test(back) ? back : "/codes";
}
