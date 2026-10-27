import { lisbonToday } from "@/lib/date";

export type PromotionStatusKey = "running" | "not_started" | "ended" | "paused";

export function promotionStatus(
  p: { active: boolean; reward_valid_from: string; reward_valid_to: string },
  today: string = lisbonToday()
): { key: PromotionStatusKey; label: string } {
  if (!p.active) return { key: "paused", label: "Pausada" };
  if (today < p.reward_valid_from) return { key: "not_started", label: "Ainda não começou" };
  if (today > p.reward_valid_to) return { key: "ended", label: "Terminou" };
  return { key: "running", label: "A decorrer" };
}
